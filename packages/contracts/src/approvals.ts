/**
 * @terrarium/contracts - approvals.ts
 *
 * Consequential action authorization, approval gates, state transitions, and validation.
 * Aligns strictly with PLAN_CONTEXT.md Section 7 and PLAN.md Section 17 (Security & Human Control).
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError, InvalidStateTransitionError, type ValidationIssue } from "./errors.ts";
import {
  isRecord,
  validateEnum,
  validateIsoDateTime,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

export const APPROVAL_ACTION_TYPES = [
  "file_write",
  "file_delete",
  "shell_execution",
  "git_commit",
  "git_push",
  "package_install",
  "paid_api_call",
  "production_deploy",
  "external_publish",
  "message_send",
  "destructive_operation",
  "budget_override",
] as const;

export type ApprovalActionType = (typeof APPROVAL_ACTION_TYPES)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "expired", "cancelled"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_STATE_TRANSITIONS: Readonly<Record<ApprovalStatus, readonly ApprovalStatus[]>> = {
  pending: ["approved", "rejected", "expired", "cancelled"],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

export interface ApprovalRequest extends BaseEntity {
  readonly taskId: string;
  readonly executionId?: string;
  readonly actionType: ApprovalActionType;
  readonly description: string;
  readonly status: ApprovalStatus;
  readonly requestedByAgentId: string;
  readonly reviewedByUserId?: string;
  readonly decisionReason?: string;
  readonly requestedAt: string;
  readonly decidedAt?: string;
  readonly expiresAt?: string;
  readonly toolId?: string;
  readonly riskLevel?: string;
  readonly payloadHash?: string;
  readonly isExecuted?: boolean;
  readonly executedAt?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export function isValidApprovalTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  if (from === to) return true;
  const allowed = APPROVAL_STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertApprovalTransition(
  from: ApprovalStatus,
  to: ApprovalStatus
): Result<ApprovalStatus, InvalidStateTransitionError> {
  if (isValidApprovalTransition(from, to)) {
    return ok(to);
  }
  const allowed = APPROVAL_STATE_TRANSITIONS[from] ?? [];
  return fail(new InvalidStateTransitionError("ApprovalRequest", from, to, allowed));
}

export function validateApprovalRequest(
  value: unknown,
  path = "approvalRequest"
): Result<ApprovalRequest, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const taskId = collector.check(validateString(value.taskId, `${path}.taskId`, { minLength: 1, maxLength: 100 }));
  const actionType = collector.check(
    validateEnum(value.actionType, `${path}.actionType`, APPROVAL_ACTION_TYPES)
  );
  const description = collector.check(
    validateString(value.description, `${path}.description`, { minLength: 1, maxLength: 2000 })
  );
  const status = collector.check(validateEnum(value.status, `${path}.status`, APPROVAL_STATUSES));
  const requestedByAgentId = collector.check(
    validateString(value.requestedByAgentId, `${path}.requestedByAgentId`, { minLength: 1, maxLength: 100 })
  );
  const requestedAt = collector.check(validateIsoDateTime(value.requestedAt, `${path}.requestedAt`));
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));

  if (
    collector.hasIssues() ||
    id === undefined ||
    taskId === undefined ||
    actionType === undefined ||
    description === undefined ||
    status === undefined ||
    requestedByAgentId === undefined ||
    requestedAt === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return fail(collector.toError("ApprovalRequest validation failed"));
  }

  return ok({
    id,
    taskId,
    executionId: typeof value.executionId === "string" ? value.executionId : undefined,
    actionType,
    description,
    status,
    requestedByAgentId,
    reviewedByUserId: typeof value.reviewedByUserId === "string" ? value.reviewedByUserId : undefined,
    decisionReason: typeof value.decisionReason === "string" ? value.decisionReason : undefined,
    requestedAt,
    decidedAt: typeof value.decidedAt === "string" ? value.decidedAt : undefined,
    expiresAt: typeof value.expiresAt === "string" ? value.expiresAt : undefined,
    toolId: typeof value.toolId === "string" ? value.toolId : undefined,
    riskLevel: typeof value.riskLevel === "string" ? value.riskLevel : undefined,
    payloadHash: typeof value.payloadHash === "string" ? value.payloadHash : undefined,
    isExecuted: typeof value.isExecuted === "boolean" ? value.isExecuted : undefined,
    executedAt: typeof value.executedAt === "string" ? value.executedAt : undefined,
    payload: value.payload as Record<string, unknown> | undefined,
    createdAt,
    updatedAt,
  });
}
