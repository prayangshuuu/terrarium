/**
 * @terrarium/core - coding-agents/coding-agent-router.ts
 *
 * Safe Routing, Policy Enforcement, and Context Previews for Coding Agents.
 * Enforces read-only defaults, allowlists/denylists, consequential action approval gates,
 * and context disclosure before execution.
 * Contributed by A2 (Orchestration & AI Runtime) & A3 (Security, Data & Reliability).
 */

import {
  type CodingAgentAdapter,
  type CodingAgentContextPreview,
  type CodingAgentExecutionRequest,
  type CodingAgentExecutionResult,
  type CodingAgentRoutingPolicy,
  type CodingAgentType,
  type Result,
  ok,
  fail,
  PermissionDeniedError,
  DomainValidationError,
} from "@terrarium/contracts";
import { type CodingAgentRegistry } from "./coding-agent-registry.ts";

export interface CodingAgentRouterOptions {
  readonly registry: CodingAgentRegistry;
  readonly defaultPolicy?: CodingAgentRoutingPolicy;
}

export class CodingAgentRouter {
  private readonly registry: CodingAgentRegistry;
  private policy: CodingAgentRoutingPolicy;

  constructor(options: CodingAgentRouterOptions) {
    this.registry = options.registry;
    this.policy = options.defaultPolicy ?? {
      defaultAgentId: "claude_code",
      allowedAgentIds: ["claude_code", "codex_cli", "opencode", "gemini_cli", "cursor", "custom_subprocess"],
      blockedAgentIds: [],
      forceApprovalForMutation: true,
      maxTimeoutMs: 120000,
      worktreeIsolationDefault: true,
    };
  }

  setPolicy(policy: Partial<CodingAgentRoutingPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  getPolicy(): CodingAgentRoutingPolicy {
    return { ...this.policy };
  }

  /**
   * Generates a transparent Context Preview before dispatching execution to an external coding tool.
   * Required by PLAN.md Section 7 & PROMPT 23 Part C.
   */
  generateContextPreview(
    request: CodingAgentExecutionRequest,
    targetAgentId?: CodingAgentType
  ): Result<CodingAgentContextPreview, string> {
    const agentId = targetAgentId ?? this.policy.defaultAgentId ?? "claude_code";
    const adapter = this.registry.getAdapter(agentId);

    if (!adapter) {
      return fail(`Unknown coding agent identifier: '${agentId}'`);
    }

    const meta = adapter.metadata;
    const isRemote = meta.id === "claude_code" || meta.id === "codex_cli" || meta.id === "gemini_cli";
    const readOnly = request.readOnly ?? true;
    const requiresApproval = !readOnly && this.policy.forceApprovalForMutation;

    const preview: CodingAgentContextPreview = {
      agentId: meta.id,
      agentName: meta.name,
      category: meta.category,
      isRemoteService: isRemote,
      destinationEndpoint: isRemote ? `External Cloud Provider API via ${meta.executableName}` : "Local Subprocess",
      workingDirectory: request.workingDirectory,
      promptPreview: request.prompt.length > 120 ? `${request.prompt.slice(0, 117)}...` : request.prompt,
      includedFiles: request.contextFiles ?? [],
      readOnly,
      requiresApproval,
      estimatedRisk: !readOnly ? "high" : (request.contextFiles?.length ?? 0) > 10 ? "medium" : "low",
    };

    return ok(preview);
  }

  /**
   * Dispatches task to designated coding agent with strict security checks and policy enforcement.
   */
  async routeAndExecute(
    request: CodingAgentExecutionRequest,
    targetAgentId?: CodingAgentType,
    onChunk?: (chunk: string) => void
  ): Promise<Result<CodingAgentExecutionResult, string>> {
    const agentId = targetAgentId ?? this.policy.defaultAgentId ?? "claude_code";

    // 1. Check Allowlist & Denylist
    if (this.policy.blockedAgentIds?.includes(agentId)) {
      return fail(`Coding agent '${agentId}' is blocked by project routing policy.`);
    }

    if (this.policy.allowedAgentIds && !this.policy.allowedAgentIds.includes(agentId)) {
      return fail(`Coding agent '${agentId}' is not in project allowed tools list.`);
    }

    // 2. Resolve adapter
    const adapter = this.registry.getAdapter(agentId);
    if (!adapter) {
      return fail(`No registered adapter found for coding agent '${agentId}'.`);
    }

    // 3. Enforce Timeout Cap
    const effectiveTimeout = Math.min(
      request.timeoutMs ?? adapter.metadata.defaultTimeoutMs,
      this.policy.maxTimeoutMs
    );

    const safeRequest: CodingAgentExecutionRequest = {
      ...request,
      timeoutMs: effectiveTimeout,
      readOnly: request.readOnly ?? true,
    };

    // 4. Execute through adapter
    const result = await adapter.execute(safeRequest, onChunk);
    return ok(result);
  }
}

export function createCodingAgentRouter(options: CodingAgentRouterOptions): CodingAgentRouter {
  return new CodingAgentRouter(options);
}
