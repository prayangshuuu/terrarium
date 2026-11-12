/**
 * @terrarium/contracts - workflow.ts
 *
 * End-to-end workflow contracts, stage state machines, execution records,
 * and failure mode classification.
 * Aligns strictly with PLAN.md Section 5 (Activation & Orchestration),
 * Section 17 & 18 (Approvals & Tools), and Prompt 20 specifications.
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { type AgentDepartment, AGENT_DEPARTMENTS } from "./departments.ts";
import { type TaskStatus, TASK_STATUSES } from "./tasks.ts";
import { type TaskPlan } from "./planning.ts";
import { type ApprovalStatus } from "./approvals.ts";
import { type OrchestrationResult } from "./orchestration.ts";
import { type Artifact } from "./artifacts.ts";
import { type Report } from "./reports.ts";
import { DomainValidationError, InvalidStateTransitionError } from "./errors.ts";

export type TerrariumReport = Report;
import {
  isRecord,
  validateArray,
  validateBoolean,
  validateEnum,
  validateIsoDateTime,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

/**
 * Sequential phases of an end-to-end workflow lifecycle.
 */
export const WORKFLOW_STAGES = [
  "intake",
  "planning",
  "approval",
  "execution",
  "artifacts",
  "reporting",
  "completed",
  "failed",
  "cancelled",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

/**
 * Categorized end-to-end workflow failure modes for resilience testing.
 */
export const WORKFLOW_FAILURE_MODES = [
  "cancellation",
  "timeout",
  "provider_outage",
  "rate_limit",
  "malformed_output",
  "budget_exhaustion",
  "permission_denial",
  "partial_completion",
] as const;

export type WorkflowFailureMode = (typeof WORKFLOW_FAILURE_MODES)[number];

/**
 * Allowed transitions between workflow stages.
 */
export const ALLOWED_WORKFLOW_STAGE_TRANSITIONS: Readonly<Record<WorkflowStage, readonly WorkflowStage[]>> = {
  intake: ["planning", "failed", "cancelled"],
  planning: ["approval", "execution", "failed", "cancelled"],
  approval: ["execution", "failed", "cancelled"],
  execution: ["artifacts", "reporting", "completed", "failed", "cancelled"],
  artifacts: ["reporting", "completed", "failed", "cancelled"],
  reporting: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

/**
 * Asserts valid workflow stage transition or throws InvalidStateTransitionError.
 */
export function assertWorkflowStageTransition(current: WorkflowStage, next: WorkflowStage): void {
  const allowed = ALLOWED_WORKFLOW_STAGE_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new InvalidStateTransitionError("WorkflowStage", current, next, allowed);
  }
}

/**
 * Input request to execute an end-to-end workflow.
 */
export interface WorkflowRequest {
  readonly id?: string;
  readonly prompt: string;
  readonly targetDepartment?: AgentDepartment;
  readonly autoApprove?: boolean;
  readonly budgetLimitUsd?: number;
  readonly timeoutMs?: number;
  readonly contextFiles?: readonly string[];
  readonly simulatedPersonas?: readonly string[];
  readonly maxDelegationDepth?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Error detail recorded when a workflow enters a failed state.
 */
export interface WorkflowErrorRecord {
  readonly code: string;
  readonly message: string;
  readonly stage: WorkflowStage;
  readonly failureMode?: WorkflowFailureMode;
  readonly timestamp: string;
  readonly recoverable?: boolean;
  readonly details?: Record<string, unknown>;
}

/**
 * Metrics tracking token spend, duration, and progress across the workflow.
 */
export interface WorkflowMetrics {
  readonly totalTokens: number;
  readonly totalCostUsd: number;
  readonly durationMs: number;
  readonly stepsCompleted: number;
  readonly stepsTotal: number;
}

/**
 * Durable execution record representing an end-to-end workflow instance.
 */
export interface WorkflowExecutionRecord extends BaseEntity {
  readonly prompt: string;
  readonly stage: WorkflowStage;
  readonly status: TaskStatus;
  readonly taskId: string;
  readonly planId?: string;
  readonly plan?: TaskPlan;
  readonly approvalRequestId?: string;
  readonly approvalStatus?: ApprovalStatus;
  readonly executionResult?: OrchestrationResult;
  readonly artifacts: readonly Artifact[];
  readonly report?: TerrariumReport;
  readonly error?: WorkflowErrorRecord;
  readonly dormantProfilesVerified: boolean;
  readonly activeProfileSlugs: readonly string[];
  readonly dormantProfileSlugs: readonly string[];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly metrics: WorkflowMetrics;
}

/**
 * Validates a WorkflowRequest input.
 */
export function validateWorkflowRequest(input: unknown): Result<WorkflowRequest, DomainValidationError> {
  const collector = new ValidationCollector();

  if (!isRecord(input)) {
    return fail(new DomainValidationError("WorkflowRequest must be a record", [{ path: "request", message: "Expected object" }]));
  }

  const prompt = collector.check(validateString(input["prompt"], "prompt", { minLength: 3 }));

  let targetDepartment: AgentDepartment | undefined;
  if (input["targetDepartment"] !== undefined) {
    targetDepartment = collector.check(validateEnum(input["targetDepartment"], "targetDepartment", AGENT_DEPARTMENTS));
  }

  const autoApprove = input["autoApprove"] !== undefined
    ? collector.check(validateBoolean(input["autoApprove"], "autoApprove"))
    : undefined;

  const budgetLimitUsd = input["budgetLimitUsd"] !== undefined
    ? collector.check(validateNumber(input["budgetLimitUsd"], "budgetLimitUsd", { min: 0 }))
    : undefined;

  const timeoutMs = input["timeoutMs"] !== undefined
    ? collector.check(validateNumber(input["timeoutMs"], "timeoutMs", { min: 100 }))
    : undefined;

  const maxDelegationDepth = input["maxDelegationDepth"] !== undefined
    ? collector.check(validateNumber(input["maxDelegationDepth"], "maxDelegationDepth", { min: 1 }))
    : undefined;

  let contextFiles: readonly string[] | undefined;
  if (input["contextFiles"] !== undefined) {
    contextFiles = collector.check(
      validateArray(input["contextFiles"], "contextFiles", (item, p) => validateString(item, p))
    );
  }

  let simulatedPersonas: readonly string[] | undefined;
  if (input["simulatedPersonas"] !== undefined) {
    simulatedPersonas = collector.check(
      validateArray(input["simulatedPersonas"], "simulatedPersonas", (item, p) => validateString(item, p))
    );
  }

  if (collector.hasIssues()) {
    return fail(collector.toError("Invalid WorkflowRequest"));
  }

  return ok({
    id: typeof input["id"] === "string" ? input["id"] : undefined,
    prompt: prompt ?? "",
    targetDepartment,
    autoApprove,
    budgetLimitUsd,
    timeoutMs,
    contextFiles,
    simulatedPersonas,
    maxDelegationDepth,
    metadata: isRecord(input["metadata"]) ? (input["metadata"] as Record<string, unknown>) : undefined,
  });
}

/**
 * Validates a WorkflowExecutionRecord entity.
 */
export function validateWorkflowRecord(input: unknown): Result<WorkflowExecutionRecord, DomainValidationError> {
  const collector = new ValidationCollector();

  if (!isRecord(input)) {
    return fail(new DomainValidationError("WorkflowExecutionRecord must be an object", [{ path: "record", message: "Expected object" }]));
  }

  collector.check(validateString(input["id"], "id"));
  collector.check(validateString(input["prompt"], "prompt"));
  collector.check(validateEnum(input["stage"], "stage", WORKFLOW_STAGES));
  collector.check(validateEnum(input["status"], "status", TASK_STATUSES));
  collector.check(validateString(input["taskId"], "taskId"));
  collector.check(validateBoolean(input["dormantProfilesVerified"], "dormantProfilesVerified"));
  collector.check(validateIsoDateTime(input["startedAt"], "startedAt"));
  collector.check(validateIsoDateTime(input["createdAt"], "createdAt"));
  collector.check(validateIsoDateTime(input["updatedAt"], "updatedAt"));

  if (input["activeProfileSlugs"] !== undefined) {
    collector.check(validateArray(input["activeProfileSlugs"], "activeProfileSlugs", (s, p) => validateString(s, p)));
  }

  if (input["dormantProfileSlugs"] !== undefined) {
    collector.check(validateArray(input["dormantProfileSlugs"], "dormantProfileSlugs", (s, p) => validateString(s, p)));
  }

  if (!isRecord(input["metrics"])) {
    collector.addIssue({ path: "metrics", message: "metrics must be an object" });
  }

  if (collector.hasIssues()) {
    return fail(collector.toError("Invalid WorkflowExecutionRecord"));
  }

  return ok(input as unknown as WorkflowExecutionRecord);
}
