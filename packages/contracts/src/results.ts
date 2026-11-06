/**
 * @terrarium/contracts - results.ts
 *
 * Structured task and agent outcomes, evidence citations, and preserved disagreements.
 * Aligns strictly with PLAN.md Section 2 (Core Principles: Evidence Over Confidence, Disagreement is Useful)
 * and Section 9 (Agent-to-Agent Debate & Decision Output).
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError, type ValidationIssue } from "./errors.ts";
import { type ExecutionMetrics } from "./execution.ts";
import {
  isRecord,
  validateArray,
  validateBoolean,
  validateEnum,
  validateIsoDateTime,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

export type EvidenceConfidence = "verified" | "sourced" | "inferred" | "simulated";
export const EVIDENCE_CONFIDENCE_LEVELS = ["verified", "sourced", "inferred", "simulated"] as const;

export interface EvidenceItem {
  readonly claim: string;
  readonly confidence: EvidenceConfidence;
  readonly sourceReference?: string;
  readonly excerpt?: string;
}

export interface AgentDebatePosition {
  readonly agentId: string;
  readonly role: string;
  readonly stance: string;
  readonly argument: string;
  readonly evidence?: string;
}

export interface DisagreementItem {
  readonly topic: string;
  readonly positions: readonly AgentDebatePosition[];
  readonly resolutionStatus: "open" | "reconciled" | "accepted_as_unresolved";
  readonly synthesisNotes?: string;
}

export interface UnresolvedQuestion {
  readonly question: string;
  readonly impact: string;
  readonly recommendedAction: string;
}

export interface TaskResult extends BaseEntity {
  readonly taskId: string;
  readonly executionId?: string;
  readonly leadAgentId: string;
  readonly success: boolean;
  readonly summary: string;
  readonly evidence: readonly EvidenceItem[];
  readonly disagreements: readonly DisagreementItem[];
  readonly unresolvedQuestions: readonly UnresolvedQuestion[];
  readonly artifactIds: readonly string[];
  readonly metrics: ExecutionMetrics;
  readonly completedAt: string;
}

export function validateTaskResult(
  value: unknown,
  path = "taskResult"
): Result<TaskResult, DomainValidationError> {
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
  const leadAgentId = collector.check(
    validateString(value.leadAgentId, `${path}.leadAgentId`, { minLength: 1, maxLength: 100 })
  );
  const success = collector.check(validateBoolean(value.success, `${path}.success`));
  const summary = collector.check(
    validateString(value.summary, `${path}.summary`, { minLength: 1, maxLength: 5000 })
  );
  const completedAt = collector.check(validateIsoDateTime(value.completedAt, `${path}.completedAt`));
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));

  if (!isRecord(value.metrics)) {
    collector.addIssue({ path: `${path}.metrics`, message: "Expected metrics object", received: value.metrics });
  }

  if (
    collector.hasIssues() ||
    id === undefined ||
    taskId === undefined ||
    leadAgentId === undefined ||
    success === undefined ||
    summary === undefined ||
    completedAt === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return fail(collector.toError("TaskResult validation failed"));
  }

  return ok({
    id,
    taskId,
    executionId: typeof value.executionId === "string" ? value.executionId : undefined,
    leadAgentId,
    success,
    summary,
    evidence: (value.evidence as EvidenceItem[]) ?? [],
    disagreements: (value.disagreements as DisagreementItem[]) ?? [],
    unresolvedQuestions: (value.unresolvedQuestions as UnresolvedQuestion[]) ?? [],
    artifactIds: (value.artifactIds as string[]) ?? [],
    metrics: value.metrics as ExecutionMetrics,
    completedAt,
    createdAt,
    updatedAt,
  });
}
