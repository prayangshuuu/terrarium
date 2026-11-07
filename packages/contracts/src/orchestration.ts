/**
 * @terrarium/contracts - orchestration.ts
 *
 * Demand-based selection and bounded orchestration contracts, limits, events, and validation.
 * Aligns strictly with PLAN.md Section 5 (Demand-Based Activation and Orchestration)
 * and PLAN_CONTEXT.md Section 5 (Product Behavior Rules).
 */

import { type Result, ok, fail } from "./base.ts";
import { type DomainValidationError, type ValidationIssue } from "./errors.ts";
import { type AgentDepartment } from "./departments.ts";
import { type AgentMatchScore, type AgentProfile } from "./agent.ts";
import { type PlanStep, type RiskLevel, type TaskPlan, type TaskType, type UncertaintyLevel } from "./planning.ts";
import { type StepStatus, type Task, type TaskStatus } from "./tasks.ts";
import { type ExecutionMetrics } from "./execution.ts";
import { type DisagreementItem, type EvidenceItem, type TaskResult, type UnresolvedQuestion } from "./results.ts";
import {
  isRecord,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

/**
 * Strict bounds limiting delegation depth, concurrency, retries, timeouts, and spend.
 */
export interface OrchestrationLimits {
  readonly maxDelegationDepth: number;
  readonly maxConcurrency: number;
  readonly maxRounds: number;
  readonly maxRetries: number;
  readonly stepTimeoutMs: number;
  readonly totalTimeoutMs: number;
  readonly budgetCapUsd: number;
  readonly maxTotalTokens: number;
}

/**
 * Default safe bounds aligned with product invariants.
 */
export const DEFAULT_ORCHESTRATION_LIMITS: OrchestrationLimits = {
  maxDelegationDepth: 2,
  maxConcurrency: 3,
  maxRounds: 5,
  maxRetries: 2,
  stepTimeoutMs: 15000,
  totalTimeoutMs: 60000,
  budgetCapUsd: 1.0,
  maxTotalTokens: 50000,
};

/**
 * Criteria passed to demand-based profile selector for a step.
 */
export interface ProfileSelectionCriteria {
  readonly step: PlanStep;
  readonly taskType: TaskType;
  readonly department: AgentDepartment;
  readonly requiredCapabilities: readonly string[];
  readonly requiredPermissions?: readonly string[];
  readonly riskLevel: RiskLevel;
  readonly uncertaintyLevel: UncertaintyLevel;
  readonly budgetRemainingUsd: number;
}

/**
 * Inspectable profile selection decision recording rationale and dormant profiles.
 */
export interface ProfileSelectionDecision {
  readonly stepId: string;
  readonly selectedProfile: AgentProfile;
  readonly candidateScores: readonly AgentMatchScore[];
  readonly rationale: string;
  readonly dormantProfileCount: number;
}

/**
 * Outcome of executing a single step within a plan.
 */
export interface StepExecutionResult {
  readonly stepId: string;
  readonly executionId: string;
  readonly agentProfileId: string;
  readonly agentSlug: string;
  readonly status: StepStatus;
  readonly output: string;
  readonly metrics: ExecutionMetrics;
  readonly evidence: readonly EvidenceItem[];
  readonly disagreements: readonly DisagreementItem[];
  readonly unresolvedQuestions: readonly UnresolvedQuestion[];
  readonly error?: string;
  readonly attempts: number;
  readonly startedAt: string;
  readonly completedAt: string;
}

/**
 * Real-time event emitted during bounded orchestration execution.
 */
export interface OrchestrationEvent {
  readonly type:
    | "task_started"
    | "profile_selected"
    | "step_started"
    | "step_retry"
    | "step_completed"
    | "step_failed"
    | "step_skipped"
    | "approval_required"
    | "budget_exceeded"
    | "timeout"
    | "cancelled"
    | "task_completed"
    | "task_failed";
  readonly timestamp: string;
  readonly taskId: string;
  readonly stepId?: string;
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

/**
 * Options for executing an approved plan under bounded orchestration.
 */
export interface OrchestrationRunOptions {
  readonly plan: TaskPlan;
  readonly limits?: Partial<OrchestrationLimits>;
  readonly idempotencyKey?: string;
  readonly abortSignal?: AbortSignal;
  readonly autoApproveGates?: boolean;
  readonly onEvent?: (event: OrchestrationEvent) => void;
}

/**
 * Comprehensive outcome returned by the execution coordinator.
 */
export interface OrchestrationResult {
  readonly task: Task;
  readonly plan: TaskPlan;
  readonly stepResults: readonly StepExecutionResult[];
  readonly taskResult: TaskResult;
  readonly metrics: ExecutionMetrics;
  readonly status: TaskStatus;
  readonly isPartial: boolean;
  readonly failureReason?: string;
  readonly selectionDecisions: readonly ProfileSelectionDecision[];
  readonly activeProfiles: readonly AgentProfile[];
  readonly dormantProfiles: readonly AgentProfile[];
}

/**
 * Validates an OrchestrationLimits configuration.
 */
export function validateOrchestrationLimits(
  value: unknown,
  path = "orchestrationLimits"
): Result<OrchestrationLimits, ValidationIssue> {
  if (!isRecord(value)) {
    return fail({ path, message: "Expected object for OrchestrationLimits", received: value });
  }

  const depthRes = validateNumber(value.maxDelegationDepth, `${path}.maxDelegationDepth`, {
    min: 0,
    max: 10,
    integer: true,
  });
  if (!depthRes.success) return depthRes;

  const concRes = validateNumber(value.maxConcurrency, `${path}.maxConcurrency`, {
    min: 1,
    max: 20,
    integer: true,
  });
  if (!concRes.success) return concRes;

  const retriesRes = validateNumber(value.maxRetries, `${path}.maxRetries`, {
    min: 0,
    max: 5,
    integer: true,
  });
  if (!retriesRes.success) return retriesRes;

  const stepTimeoutRes = validateNumber(value.stepTimeoutMs, `${path}.stepTimeoutMs`, {
    min: 100,
    integer: true,
  });
  if (!stepTimeoutRes.success) return stepTimeoutRes;

  const totalTimeoutRes = validateNumber(value.totalTimeoutMs, `${path}.totalTimeoutMs`, {
    min: 100,
    integer: true,
  });
  if (!totalTimeoutRes.success) return totalTimeoutRes;

  const budgetRes = validateNumber(value.budgetCapUsd, `${path}.budgetCapUsd`, { min: 0 });
  if (!budgetRes.success) return budgetRes;

  const tokensRes = validateNumber(value.maxTotalTokens, `${path}.maxTotalTokens`, {
    min: 100,
    integer: true,
  });
  if (!tokensRes.success) return tokensRes;

  return ok({
    maxDelegationDepth: depthRes.data,
    maxConcurrency: concRes.data,
    maxRounds: typeof value.maxRounds === "number" ? Math.max(1, value.maxRounds) : 5,
    maxRetries: retriesRes.data,
    stepTimeoutMs: stepTimeoutRes.data,
    totalTimeoutMs: totalTimeoutRes.data,
    budgetCapUsd: budgetRes.data,
    maxTotalTokens: tokensRes.data,
  });
}
