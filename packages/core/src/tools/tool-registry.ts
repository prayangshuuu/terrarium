/**
 * @terrarium/core - tools/tool-registry.ts
 *
 * Tool registry, typed invocation runtime, input/output schema validation,
 * least-privilege permission gating, human approval enforcement, and audit event dispatching.
 * Aligns strictly with PLAN.md Section 17 & 18 and Prompt 10 instructions.
 */

import { randomUUID } from "node:crypto";
import {
  type DomainEvent,
  type EventRepository,
  type Result,
  type TerrariumError,
  type ToolDefinition,
  type ToolFilter,
  type ToolInvocationRequest,
  type ToolInvocationResult,
  type ToolRegistry,
  validateToolDefinition,
  validateToolInput,
  validateToolOutput,
  ok,
  fail,
  ApprovalRequiredError,
  ToolNotFoundError,
  ToolTimeoutError,
} from "@terrarium/contracts";
import { ApprovalManager } from "../approvals/approval-manager.ts";
import { ToolSecurityEnforcer } from "./security-enforcer.ts";

export interface ToolRegistryOptions {
  readonly approvalManager?: ApprovalManager;
  readonly securityEnforcer?: ToolSecurityEnforcer;
  readonly eventRepository?: EventRepository;
}

export class DefaultToolRegistry implements ToolRegistry {
  private readonly tools: Map<string, ToolDefinition<any, any>> = new Map();
  private readonly approvalManager: ApprovalManager;
  private readonly securityEnforcer: ToolSecurityEnforcer;
  private readonly eventRepository?: EventRepository;

  constructor(options: ToolRegistryOptions = {}) {
    this.approvalManager = options.approvalManager ?? new ApprovalManager();
    this.securityEnforcer = options.securityEnforcer ?? new ToolSecurityEnforcer();
    this.eventRepository = options.eventRepository;
  }

  getApprovalManager(): ApprovalManager {
    return this.approvalManager;
  }

  getSecurityEnforcer(): ToolSecurityEnforcer {
    return this.securityEnforcer;
  }

  register(tool: ToolDefinition<any, any>): void {
    const validRes = validateToolDefinition(tool);
    if (!validRes.success) {
      throw validRes.error;
    }
    this.tools.set(tool.id, tool);
  }

  unregister(toolId: string): boolean {
    return this.tools.delete(toolId);
  }

  get(toolId: string): ToolDefinition<any, any> | undefined {
    return this.tools.get(toolId);
  }

  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  list(filter: ToolFilter = {}): readonly ToolDefinition<any, any>[] {
    let list = Array.from(this.tools.values());

    if (filter.category) {
      list = list.filter((t) => t.category.toLowerCase() === filter.category!.toLowerCase());
    }
    if (filter.riskLevel) {
      list = list.filter((t) => t.riskLevel === filter.riskLevel);
    }
    if (filter.permission) {
      list = list.filter((t) => t.requiredPermissions.includes(filter.permission!));
    }
    if (filter.requiresApproval !== undefined) {
      list = list.filter((t) => Boolean(t.requiresApproval) === filter.requiresApproval);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    return list;
  }

  private async recordAuditEvent(
    eventType: "tool:invoked" | "tool:succeeded" | "tool:failed" | "tool:blocked",
    toolId: string,
    callerId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (!this.eventRepository) return;

    const event: DomainEvent = {
      id: `evt-${randomUUID()}`,
      eventType,
      source: "orchestrator",
      entityType: "Tool",
      entityId: toolId,
      timestamp: new Date().toISOString(),
      payload: {
        toolId,
        callerId,
        ...payload,
      },
    };

    try {
      await this.eventRepository.record(event);
    } catch {
      // Non-blocking observability
    }
  }

  /**
   * Invokes a registered tool with typed input/output validation,
   * least-privilege permission checks, approval gate verification, and timeouts.
   */
  async invoke<TInput = Record<string, unknown>, TOutput = unknown>(
    request: ToolInvocationRequest<TInput>
  ): Promise<Result<ToolInvocationResult<TOutput>, TerrariumError>> {
    const startTime = Date.now();
    const { toolId, input, context } = request;

    // 1. Tool Lookup
    const tool = this.tools.get(toolId);
    if (!tool) {
      return fail(new ToolNotFoundError(toolId));
    }

    // 2. Permission and Least-Privilege Gate
    const permRes = this.securityEnforcer.checkPermission(tool, context);
    if (!permRes.success) {
      await this.recordAuditEvent("tool:blocked", toolId, context.agentId, {
        reason: "permission_denied",
        error: permRes.error.message,
      });
      return fail(permRes.error);
    }

    // 3. Input Schema Validation
    const inputRes = validateToolInput<TInput>(toolId, tool.inputSchema, input);
    if (!inputRes.success) {
      await this.recordAuditEvent("tool:blocked", toolId, context.agentId, {
        reason: "validation_failed",
        issues: inputRes.error.issues,
      });
      return fail(inputRes.error);
    }
    const validatedInput = inputRes.data;

    // 4. Human Approval Gate for Consequential Operations
    const needsApproval = Boolean(
      tool.requiresApproval === true ||
        (typeof tool.requiresApproval === "function" &&
          (await tool.requiresApproval(validatedInput as Record<string, unknown>, context))) ||
        (await this.securityEnforcer.isConsequentialAction(
          tool,
          validatedInput as Record<string, unknown>,
          context
        ))
    );

    if (needsApproval) {
      if (!context.approvalId) {
        // No approval token provided: Create pending ApprovalRequest and pause/block
        const actionType = this.securityEnforcer.mapToolToApprovalAction(
          tool,
          validatedInput as Record<string, unknown>
        );

        const approvalRes = await this.approvalManager.createRequest({
          taskId: context.taskId,
          executionId: context.executionId,
          actionType,
          description: `Action '${tool.name}' (${tool.id}) requested by agent '${context.agentId}'`,
          toolId: tool.id,
          riskLevel: tool.riskLevel,
          requestedByAgentId: context.agentId,
          payload: validatedInput as Record<string, unknown>,
        });

        if (!approvalRes.success) {
          return fail(approvalRes.error);
        }

        const approval = approvalRes.data;
        await this.recordAuditEvent("tool:blocked", toolId, context.agentId, {
          reason: "approval_required",
          approvalId: approval.id,
          actionType,
        });

        const appError = new ApprovalRequiredError(approval.id, tool.id, actionType);
        return ok({
          toolId,
          success: false,
          durationMs: Date.now() - startTime,
          approvalRequired: true,
          approvalRequest: approval,
          error: appError,
        });
      }

      // Approval token provided: Verify authenticity, state, non-tampering, non-expiration, single-use
      const verifyRes = await this.approvalManager.verifyApprovalForAction(
        context.approvalId,
        tool.id,
        validatedInput as Record<string, unknown>,
        context
      );

      if (!verifyRes.success) {
        await this.recordAuditEvent("tool:blocked", toolId, context.agentId, {
          reason: verifyRes.error.name,
          approvalId: context.approvalId,
          error: verifyRes.error.message,
        });
        return fail(verifyRes.error);
      }
    }

    // 5. Check Cancellation Signal
    if (context.signal?.aborted) {
      return fail(new ToolTimeoutError(toolId, 0));
    }

    // 6. Timeout Setup
    const timeoutMs = Math.min(tool.maxTimeoutMs, tool.defaultTimeoutMs);
    const timeoutController = new AbortController();

    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        timeoutController.abort();
        reject(new ToolTimeoutError(toolId, timeoutMs));
      }, timeoutMs);
    });

    // Merge parent signal if provided
    if (context.signal) {
      context.signal.addEventListener("abort", () => {
        timeoutController.abort();
      });
    }

    await this.recordAuditEvent("tool:invoked", toolId, context.agentId, {
      taskId: context.taskId,
      approvalId: context.approvalId,
    });

    try {
      // Execute tool race against timeout
      const executionPromise = tool.execute(validatedInput, {
        ...context,
        signal: timeoutController.signal,
      });

      const rawResult = await Promise.race([executionPromise, timeoutPromise]);
      if (timeoutTimer) clearTimeout(timeoutTimer);

      if (!rawResult.success) {
        const durationMs = Date.now() - startTime;
        await this.recordAuditEvent("tool:failed", toolId, context.agentId, {
          durationMs,
          error: rawResult.error.message,
        });
        return ok({
          toolId,
          success: false,
          durationMs,
          error: rawResult.error,
        });
      }

      // 7. Output Schema Validation
      const outputRes = validateToolOutput<TOutput>(toolId, tool.outputSchema, rawResult.data);
      if (!outputRes.success) {
        const durationMs = Date.now() - startTime;
        await this.recordAuditEvent("tool:failed", toolId, context.agentId, {
          durationMs,
          reason: "output_validation_failed",
          issues: outputRes.error.issues,
        });
        return fail(outputRes.error);
      }

      // 8. Consume Approval Token (Replay / Duplicate Execution Protection)
      if (context.approvalId) {
        await this.approvalManager.markExecuted(context.approvalId);
      }

      const durationMs = Date.now() - startTime;
      await this.recordAuditEvent("tool:succeeded", toolId, context.agentId, {
        durationMs,
      });

      return ok({
        toolId,
        success: true,
        output: outputRes.data,
        durationMs,
      });
    } catch (err: unknown) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      const durationMs = Date.now() - startTime;

      if (err instanceof ToolTimeoutError) {
        await this.recordAuditEvent("tool:failed", toolId, context.agentId, {
          durationMs,
          reason: "timeout",
          timeoutMs,
        });
        return fail(err);
      }

      await this.recordAuditEvent("tool:failed", toolId, context.agentId, {
        durationMs,
        error: String(err),
      });
      return fail(err as TerrariumError);
    }
  }
}
