/**
 * @terrarium/contracts - code.ts
 *
 * Core domain contracts for Engineering Studio, safe code workflows,
 * diff representations, repository analysis, review findings, and bounded test execution.
 * Aligns strictly with PLAN.md Section 10 & 17, PLAN_CONTEXT.md Section 7, and PROMPT 17.
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError } from "./errors.ts";
import {
  isRecord,
  validateEnum,
  validateIsoDateTime,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

export const CODE_PATCH_STATUSES = [
  "proposed",
  "approved",
  "applied",
  "rejected",
  "failed",
  "rolled_back",
] as const;

export type CodePatchStatus = (typeof CODE_PATCH_STATUSES)[number];

export const PATCH_CHANGE_TYPES = ["create", "modify", "delete"] as const;

export type PatchChangeType = (typeof PATCH_CHANGE_TYPES)[number];

export const CODE_REVIEW_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type CodeReviewSeverity = (typeof CODE_REVIEW_SEVERITIES)[number];

export const CODE_REVIEW_CATEGORIES = [
  "correctness",
  "maintainability",
  "security",
  "performance",
  "reliability",
  "accessibility",
  "privacy",
  "testability",
] as const;

export type CodeReviewCategory = (typeof CODE_REVIEW_CATEGORIES)[number];

/**
 * A single hunk within a unified diff.
 */
export interface CodeDiffHunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly header: string;
  readonly lines: readonly string[];
}

/**
 * Structured code patch representing an inspectable, reversible change proposal.
 */
export interface CodeFilePatch extends BaseEntity {
  readonly taskId?: string;
  readonly filePath: string;
  readonly changeType: PatchChangeType;
  readonly originalContent?: string;
  readonly originalHash?: string;
  readonly proposedContent: string;
  readonly proposedHash: string;
  readonly diffUnified: string;
  readonly hunks: readonly CodeDiffHunk[];
  readonly rationale: string;
  readonly status: CodePatchStatus;
  readonly requiresApproval: boolean;
  readonly approvalRequestId?: string;
  readonly appliedAt?: string;
  readonly rolledBackAt?: string;
  readonly rollbackGuidance?: string;
}

/**
 * Repository analysis metadata detailing languages, frameworks, entry points, and sensitive files.
 */
export interface CodeAnalysisSummary {
  readonly repoPath: string;
  readonly branch?: string;
  readonly isClean: boolean;
  readonly languages: readonly {
    readonly name: string;
    readonly percentage: number;
    readonly filesCount: number;
  }[];
  readonly frameworks: readonly string[];
  readonly entryPoints: readonly string[];
  readonly dependencies: readonly {
    readonly name: string;
    readonly version: string;
    readonly isDev: boolean;
  }[];
  readonly testFrameworks: readonly string[];
  readonly sensitiveFiles: readonly {
    readonly path: string;
    readonly reason: string;
    readonly isProtected: boolean;
  }[];
  readonly analyzedAt: string;
}

/**
 * Code review finding detailing architectural, security, or logic issues with remediation.
 */
export interface CodeReviewFinding extends BaseEntity {
  readonly taskId?: string;
  readonly filePath: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly severity: CodeReviewSeverity;
  readonly category: CodeReviewCategory;
  readonly title: string;
  readonly explanation: string;
  readonly suggestedRemediation?: string;
  readonly confidence: number; // 0.0 - 1.0
  readonly isVerified: boolean;
}

/**
 * Result of a bounded test execution run.
 */
export interface BoundedTestRunResult {
  readonly id: string;
  readonly command: string;
  readonly passed: boolean;
  readonly exitCode: number;
  readonly totalTests: number;
  readonly passedTests: number;
  readonly failedTests: number;
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly executedAt: string;
  readonly timedOut?: boolean;
}

/**
 * Result of patch application operation.
 */
export interface PatchApplicationResult {
  readonly success: boolean;
  readonly patchId: string;
  readonly filePath: string;
  readonly appliedHash?: string;
  readonly rollbackGuidance: string;
  readonly error?: string;
  readonly partialFailure?: boolean;
}

/**
 * Result of patch rollback operation.
 */
export interface PatchRollbackResult {
  readonly success: boolean;
  readonly patchId: string;
  readonly filePath: string;
  readonly restoredHash?: string;
  readonly error?: string;
}

/**
 * Validates a CodeFilePatch object.
 */
export function validateCodeFilePatch(
  value: unknown,
  path = "codeFilePatch"
): Result<CodeFilePatch, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const id = collector.check(validateString(value.id, `${path}.id`));
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));
  const filePath = collector.check(validateString(value.filePath, `${path}.filePath`));
  const changeType = collector.check(
    validateEnum(value.changeType, `${path}.changeType`, PATCH_CHANGE_TYPES)
  );
  const proposedContent = collector.check(
    validateString(value.proposedContent, `${path}.proposedContent`)
  );
  const proposedHash = collector.check(
    validateString(value.proposedHash, `${path}.proposedHash`)
  );
  const diffUnified = collector.check(
    validateString(value.diffUnified, `${path}.diffUnified`)
  );
  const rationale = collector.check(validateString(value.rationale, `${path}.rationale`));
  const status = collector.check(validateEnum(value.status, `${path}.status`, CODE_PATCH_STATUSES));

  if (!Array.isArray(value.hunks)) {
    collector.addIssue({ path: `${path}.hunks`, message: "Hunks must be an array" });
  }

  if (
    collector.hasIssues() ||
    !id ||
    !createdAt ||
    !updatedAt ||
    !filePath ||
    !changeType ||
    !proposedContent ||
    !proposedHash ||
    !diffUnified ||
    !rationale ||
    !status
  ) {
    return fail(collector.toError("CodeFilePatch validation failed"));
  }

  return ok({
    id,
    createdAt,
    updatedAt,
    taskId: typeof value.taskId === "string" ? value.taskId : undefined,
    filePath,
    changeType,
    originalContent: typeof value.originalContent === "string" ? value.originalContent : undefined,
    originalHash: typeof value.originalHash === "string" ? value.originalHash : undefined,
    proposedContent,
    proposedHash,
    diffUnified,
    hunks: (value.hunks as any) ?? [],
    rationale,
    status,
    requiresApproval: Boolean(value.requiresApproval),
    approvalRequestId: typeof value.approvalRequestId === "string" ? value.approvalRequestId : undefined,
    appliedAt: typeof value.appliedAt === "string" ? value.appliedAt : undefined,
    rolledBackAt: typeof value.rolledBackAt === "string" ? value.rolledBackAt : undefined,
    rollbackGuidance: typeof value.rollbackGuidance === "string" ? value.rollbackGuidance : undefined,
  });
}
