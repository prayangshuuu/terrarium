/**
 * @terrarium/core - approvals/approval-manager.ts
 *
 * Consequential action authorization manager, approval gates, state machine enforcement,
 * payload hashing (tamper detection), and replay/duplicate execution prevention.
 * Aligns strictly with PLAN.md Section 17 & 18 and PLAN_CONTEXT.md Section 7.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  type ApprovalActionType,
  type ApprovalQueryOptions,
  type ApprovalRepository,
  type ApprovalRequest,
  type ApprovalStatus,
  type DomainEvent,
  type EventRepository,
  type Result,
  type TerrariumError,
  type ToolExecutionContext,
  type ToolRiskLevel,
  assertApprovalTransition,
  ok,
  fail,
  ApprovalCancelledError,
  ApprovalExpiredError,
  ApprovalRejectedError,
  ApprovalRequiredError,
  DatabaseError,
  DuplicateExecutionError,
  NotFoundError,
  PermissionDeniedError,
} from "@terrarium/contracts";

export interface CreateApprovalInput {
  readonly taskId: string;
  readonly executionId?: string;
  readonly actionType: ApprovalActionType;
  readonly description: string;
  readonly toolId?: string;
  readonly riskLevel?: ToolRiskLevel;
  readonly requestedByAgentId: string;
  readonly payload?: Record<string, unknown>;
  readonly expiresAt?: string;
}

export interface ApprovalManagerOptions {
  readonly repository?: ApprovalRepository;
  readonly eventRepository?: EventRepository;
  readonly defaultExpirationSeconds?: number;
}

/**
 * Deterministically computes SHA-256 hash of a JSON payload with sorted keys.
 * Used for tamper detection between approval grant and action execution.
 */
export function calculatePayloadHash(toolId: string, payload?: Record<string, unknown>): string {
  if (!payload || Object.keys(payload).length === 0) {
    return createHash("sha256").update(`${toolId}:{}`).digest("hex");
  }

  function sortObject(val: unknown): unknown {
    if (val === null || typeof val !== "object") {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(sortObject);
    }
    const sortedRecord: Record<string, unknown> = {};
    for (const key of Object.keys(val).sort()) {
      sortedRecord[key] = sortObject((val as Record<string, unknown>)[key]);
    }
    return sortedRecord;
  }

  const sortedJson = JSON.stringify(sortObject(payload));
  return createHash("sha256").update(`${toolId}:${sortedJson}`).digest("hex");
}

export class ApprovalManager {
  private readonly repository?: ApprovalRepository;
  private readonly eventRepository?: EventRepository;
  private readonly inMemoryStore: Map<string, ApprovalRequest> = new Map();
  private readonly defaultExpirationSeconds: number;

  constructor(options: ApprovalManagerOptions = {}) {
    this.repository = options.repository;
    this.eventRepository = options.eventRepository;
    this.defaultExpirationSeconds = options.defaultExpirationSeconds ?? 3600; // 1 hour default
  }

  private async recordAuditEvent(
    eventType:
      | "approval:requested"
      | "approval:resolved"
      | "approval:approved"
      | "approval:rejected"
      | "approval:expired"
      | "approval:cancelled",
    approval: ApprovalRequest,
    actorId = "system"
  ): Promise<void> {
    if (!this.eventRepository) return;

    const event: DomainEvent = {
      id: `evt-${randomUUID()}`,
      eventType,
      source: actorId === "system" ? "system" : "user",
      entityType: "ApprovalRequest",
      entityId: approval.id,
      timestamp: new Date().toISOString(),
      payload: {
        taskId: approval.taskId,
        toolId: approval.toolId,
        actionType: approval.actionType,
        status: approval.status,
        requestedByAgentId: approval.requestedByAgentId,
        reviewedByUserId: approval.reviewedByUserId,
        decisionReason: approval.decisionReason,
        payloadHash: approval.payloadHash,
      },
    };

    try {
      await this.eventRepository.record(event);
    } catch {
      // Audit event failures should not break the primary flow
    }
  }

  async get(id: string): Promise<Result<ApprovalRequest | null, DatabaseError>> {
    if (this.repository) {
      return this.repository.findById(id);
    }
    const inMem = this.inMemoryStore.get(id) ?? null;
    return ok(inMem);
  }

  async list(options: ApprovalQueryOptions = {}): Promise<Result<readonly ApprovalRequest[], DatabaseError>> {
    if (this.repository) {
      return this.repository.list(options);
    }

    let items = Array.from(this.inMemoryStore.values());
    if (options.status) {
      items = items.filter((a) => a.status === options.status);
    }
    if (options.taskId) {
      items = items.filter((a) => a.taskId === options.taskId);
    }
    if (options.requestedByAgentId) {
      items = items.filter((a) => a.requestedByAgentId === options.requestedByAgentId);
    }

    return ok(items);
  }

  async createRequest(input: CreateApprovalInput): Promise<Result<ApprovalRequest, TerrariumError>> {
    const now = new Date();
    const nowIso = now.toISOString();

    const expiresAt =
      input.expiresAt ??
      new Date(now.getTime() + this.defaultExpirationSeconds * 1000).toISOString();

    const toolId = input.toolId ?? "unknown";
    const payloadHash = calculatePayloadHash(toolId, input.payload);

    const approval: ApprovalRequest = {
      id: `appr-${randomUUID()}`,
      taskId: input.taskId,
      executionId: input.executionId,
      actionType: input.actionType,
      description: input.description,
      status: "pending",
      requestedByAgentId: input.requestedByAgentId,
      requestedAt: nowIso,
      expiresAt,
      toolId: input.toolId,
      riskLevel: input.riskLevel,
      payloadHash,
      isExecuted: false,
      payload: input.payload,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (this.repository) {
      const dbRes = await this.repository.create(approval);
      if (!dbRes.success) return fail(dbRes.error);
    } else {
      this.inMemoryStore.set(approval.id, approval);
    }

    await this.recordAuditEvent("approval:requested", approval, input.requestedByAgentId);
    return ok(approval);
  }

  async approve(
    approvalId: string,
    userId: string,
    reason?: string
  ): Promise<Result<ApprovalRequest, TerrariumError>> {
    const existingRes = await this.get(approvalId);
    if (!existingRes.success) return fail(existingRes.error);
    if (!existingRes.data) return fail(new NotFoundError("ApprovalRequest", approvalId));

    const current = existingRes.data;

    // Check expiration before transition
    if (current.expiresAt && new Date(current.expiresAt) < new Date()) {
      await this.expire(approvalId, "Approval window elapsed prior to decision");
      return fail(new ApprovalExpiredError(approvalId));
    }

    const transitionRes = assertApprovalTransition(current.status, "approved");
    if (!transitionRes.success) return fail(transitionRes.error);

    const nowIso = new Date().toISOString();
    const updated: ApprovalRequest = {
      ...current,
      status: "approved",
      reviewedByUserId: userId,
      decisionReason: reason,
      decidedAt: nowIso,
      updatedAt: nowIso,
    };

    if (this.repository) {
      const updateRes = await this.repository.update(updated);
      if (!updateRes.success) return fail(updateRes.error);
    } else {
      this.inMemoryStore.set(approvalId, updated);
    }

    await this.recordAuditEvent("approval:approved", updated, userId);
    await this.recordAuditEvent("approval:resolved", updated, userId);
    return ok(updated);
  }

  async reject(
    approvalId: string,
    userId: string,
    reason?: string
  ): Promise<Result<ApprovalRequest, TerrariumError>> {
    const existingRes = await this.get(approvalId);
    if (!existingRes.success) return fail(existingRes.error);
    if (!existingRes.data) return fail(new NotFoundError("ApprovalRequest", approvalId));

    const current = existingRes.data;
    const transitionRes = assertApprovalTransition(current.status, "rejected");
    if (!transitionRes.success) return fail(transitionRes.error);

    const nowIso = new Date().toISOString();
    const updated: ApprovalRequest = {
      ...current,
      status: "rejected",
      reviewedByUserId: userId,
      decisionReason: reason,
      decidedAt: nowIso,
      updatedAt: nowIso,
    };

    if (this.repository) {
      const updateRes = await this.repository.update(updated);
      if (!updateRes.success) return fail(updateRes.error);
    } else {
      this.inMemoryStore.set(approvalId, updated);
    }

    await this.recordAuditEvent("approval:rejected", updated, userId);
    await this.recordAuditEvent("approval:resolved", updated, userId);
    return ok(updated);
  }

  async expire(approvalId: string, reason?: string): Promise<Result<ApprovalRequest, TerrariumError>> {
    const existingRes = await this.get(approvalId);
    if (!existingRes.success) return fail(existingRes.error);
    if (!existingRes.data) return fail(new NotFoundError("ApprovalRequest", approvalId));

    const current = existingRes.data;
    const transitionRes = assertApprovalTransition(current.status, "expired");
    if (!transitionRes.success) return fail(transitionRes.error);

    const nowIso = new Date().toISOString();
    const updated: ApprovalRequest = {
      ...current,
      status: "expired",
      decisionReason: reason ?? "Approval request timed out",
      decidedAt: nowIso,
      updatedAt: nowIso,
    };

    if (this.repository) {
      const updateRes = await this.repository.update(updated);
      if (!updateRes.success) return fail(updateRes.error);
    } else {
      this.inMemoryStore.set(approvalId, updated);
    }

    await this.recordAuditEvent("approval:expired", updated, "system");
    await this.recordAuditEvent("approval:resolved", updated, "system");
    return ok(updated);
  }

  async cancel(
    approvalId: string,
    actorId: string,
    reason?: string
  ): Promise<Result<ApprovalRequest, TerrariumError>> {
    const existingRes = await this.get(approvalId);
    if (!existingRes.success) return fail(existingRes.error);
    if (!existingRes.data) return fail(new NotFoundError("ApprovalRequest", approvalId));

    const current = existingRes.data;
    const transitionRes = assertApprovalTransition(current.status, "cancelled");
    if (!transitionRes.success) return fail(transitionRes.error);

    const nowIso = new Date().toISOString();
    const updated: ApprovalRequest = {
      ...current,
      status: "cancelled",
      decisionReason: reason ?? `Approval request cancelled by ${actorId}`,
      decidedAt: nowIso,
      updatedAt: nowIso,
    };

    if (this.repository) {
      const updateRes = await this.repository.update(updated);
      if (!updateRes.success) return fail(updateRes.error);
    } else {
      this.inMemoryStore.set(approvalId, updated);
    }

    await this.recordAuditEvent("approval:cancelled", updated, actorId);
    await this.recordAuditEvent("approval:resolved", updated, actorId);
    return ok(updated);
  }

  /**
   * Verifies that an approved authorization token/ID is valid for the specified tool and payload.
   * Guarantees that:
   * 1. The approval exists.
   * 2. The approval is in 'approved' status (rejected, expired, or cancelled approvals block execution).
   * 3. The approval has not expired by wall-clock time.
   * 4. The caller's task matches the approval's taskId.
   * 5. The payload has not been modified/tampered with since user authorization (hash match).
   * 6. The approval has not already been executed (replay / duplicate execution prevention).
   */
  async verifyApprovalForAction(
    approvalId: string,
    toolId: string,
    payload: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<Result<ApprovalRequest, TerrariumError>> {
    const res = await this.get(approvalId);
    if (!res.success) return fail(res.error);
    if (!res.data) return fail(new NotFoundError("ApprovalRequest", approvalId));

    const approval = res.data;

    // Check status
    if (approval.status === "rejected") {
      return fail(new ApprovalRejectedError(approvalId, approval.decisionReason));
    }
    if (approval.status === "cancelled") {
      return fail(new ApprovalCancelledError(approvalId, approval.decisionReason));
    }
    if (approval.status === "expired") {
      return fail(new ApprovalExpiredError(approvalId));
    }
    if (approval.status === "pending") {
      return fail(new ApprovalRequiredError(approvalId, toolId, approval.actionType));
    }

    // Check expiration by wall-clock time
    if (approval.expiresAt && new Date(approval.expiresAt) < new Date()) {
      await this.expire(approvalId, "Approval expired before execution");
      return fail(new ApprovalExpiredError(approvalId));
    }

    // Check task boundary isolation
    if (approval.taskId !== context.taskId) {
      return fail(
        new PermissionDeniedError(
          "execute",
          toolId,
          `Approval '${approvalId}' was granted for taskId '${approval.taskId}', cannot be used for taskId '${context.taskId}'`
        )
      );
    }

    // Tamper detection: verify payload hash matches approved hash
    const currentHash = calculatePayloadHash(toolId, payload);
    if (approval.payloadHash && approval.payloadHash !== currentHash) {
      return fail(
        new PermissionDeniedError(
          "execute",
          toolId,
          `Approval payload tampering detected: computed hash '${currentHash}' does not match authorized hash '${approval.payloadHash}'`
        )
      );
    }

    // Duplicate execution protection (single-use token)
    if (approval.isExecuted) {
      return fail(
        new DuplicateExecutionError(
          `${approvalId}:${toolId}`,
          `Approval '${approvalId}' for tool '${toolId}' has already been executed at ${approval.executedAt ?? "unknown time"}. Duplicate execution blocked.`
        )
      );
    }

    return ok(approval);
  }

  /**
   * Marks an approval as consumed/executed following successful tool invocation.
   */
  async markExecuted(approvalId: string): Promise<Result<ApprovalRequest, TerrariumError>> {
    const existingRes = await this.get(approvalId);
    if (!existingRes.success) return fail(existingRes.error);
    if (!existingRes.data) return fail(new NotFoundError("ApprovalRequest", approvalId));

    const current = existingRes.data;
    const nowIso = new Date().toISOString();
    const updated: ApprovalRequest = {
      ...current,
      isExecuted: true,
      executedAt: nowIso,
      updatedAt: nowIso,
    };

    if (this.repository) {
      const updateRes = await this.repository.update(updated);
      if (!updateRes.success) return fail(updateRes.error);
    } else {
      this.inMemoryStore.set(approvalId, updated);
    }

    return ok(updated);
  }
}
