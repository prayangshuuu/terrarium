/**
 * @terrarium/contracts - execution.ts
 *
 * Bounded agent execution instance contracts, metrics, lifecycle transitions, and validation.
 * Aligns with PLAN.md Section 4.1 (Agent Execution) and Section 13 (Token & Cost Management).
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError, InvalidStateTransitionError, type ValidationIssue } from "./errors.ts";
import {
  isRecord,
  validateEnum,
  validateIsoDateTime,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

/**
 * Standard execution lifecycle status.
 */
export const EXECUTION_STATUSES = [
  "idle",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "blocked",
] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const EXECUTION_STATE_TRANSITIONS: Readonly<Record<ExecutionStatus, readonly ExecutionStatus[]>> = {
  idle: ["queued"],
  queued: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled", "blocked"],
  blocked: ["running", "cancelled", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
};

export interface ExecutionMetrics {
  readonly tokensPrompt: number;
  readonly tokensCompletion: number;
  readonly tokensTotal: number;
  readonly estimatedCostUsd: number;
  readonly durationMs: number;
}

export interface Execution extends BaseEntity {
  readonly taskId: string;
  readonly stepId?: string;
  readonly agentProfileId: string;
  readonly status: ExecutionStatus;
  readonly provider: string;
  readonly model: string;
  readonly metrics: ExecutionMetrics;
  readonly error?: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

export function isValidExecutionTransition(from: ExecutionStatus, to: ExecutionStatus): boolean {
  if (from === to) return true;
  const allowed = EXECUTION_STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertExecutionTransition(
  from: ExecutionStatus,
  to: ExecutionStatus
): Result<ExecutionStatus, InvalidStateTransitionError> {
  if (isValidExecutionTransition(from, to)) {
    return ok(to);
  }
  const allowed = EXECUTION_STATE_TRANSITIONS[from] ?? [];
  return fail(new InvalidStateTransitionError("Execution", from, to, allowed));
}

export function validateExecution(
  value: unknown,
  path = "execution"
): Result<Execution, DomainValidationError> {
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
  const agentProfileId = collector.check(
    validateString(value.agentProfileId, `${path}.agentProfileId`, { minLength: 1, maxLength: 100 })
  );
  const status = collector.check(validateEnum(value.status, `${path}.status`, EXECUTION_STATUSES));
  const provider = collector.check(
    validateString(value.provider, `${path}.provider`, { minLength: 1, maxLength: 50 })
  );
  const model = collector.check(validateString(value.model, `${path}.model`, { minLength: 1, maxLength: 100 }));
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));

  let metrics: ExecutionMetrics | undefined;
  if (!isRecord(value.metrics)) {
    collector.addIssue({ path: `${path}.metrics`, message: "Expected metrics object", received: value.metrics });
  } else {
    const tokensPrompt = collector.check(
      validateNumber(value.metrics.tokensPrompt, `${path}.metrics.tokensPrompt`, { min: 0 })
    );
    const tokensCompletion = collector.check(
      validateNumber(value.metrics.tokensCompletion, `${path}.metrics.tokensCompletion`, { min: 0 })
    );
    const tokensTotal = collector.check(
      validateNumber(value.metrics.tokensTotal, `${path}.metrics.tokensTotal`, { min: 0 })
    );
    const estimatedCostUsd = collector.check(
      validateNumber(value.metrics.estimatedCostUsd, `${path}.metrics.estimatedCostUsd`, { min: 0 })
    );
    const durationMs = collector.check(
      validateNumber(value.metrics.durationMs, `${path}.metrics.durationMs`, { min: 0 })
    );

    if (
      tokensPrompt !== undefined &&
      tokensCompletion !== undefined &&
      tokensTotal !== undefined &&
      estimatedCostUsd !== undefined &&
      durationMs !== undefined
    ) {
      metrics = {
        tokensPrompt,
        tokensCompletion,
        tokensTotal,
        estimatedCostUsd,
        durationMs,
      };
    }
  }

  if (
    collector.hasIssues() ||
    id === undefined ||
    taskId === undefined ||
    agentProfileId === undefined ||
    status === undefined ||
    provider === undefined ||
    model === undefined ||
    createdAt === undefined ||
    updatedAt === undefined ||
    metrics === undefined
  ) {
    return fail(collector.toError("Execution validation failed"));
  }

  return ok({
    id,
    taskId,
    stepId: typeof value.stepId === "string" ? value.stepId : undefined,
    agentProfileId,
    status,
    provider,
    model,
    metrics,
    error: typeof value.error === "string" ? value.error : undefined,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : undefined,
    finishedAt: typeof value.finishedAt === "string" ? value.finishedAt : undefined,
    createdAt,
    updatedAt,
  });
}
