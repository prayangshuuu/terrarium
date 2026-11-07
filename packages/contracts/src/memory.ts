/**
 * @terrarium/contracts - memory.ts
 *
 * Project context memory items, knowledge categories, confidence levels, provenance, freshness, and validation.
 * Aligns strictly with PLAN.md Section 14 (Memory & Knowledge Management) and PLAN_CONTEXT.md Section 6.
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError, type ValidationIssue } from "./errors.ts";
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

export const MEMORY_CATEGORIES = [
  "project_overview",
  "confirmed_requirement",
  "decision_rationale",
  "architecture_knowledge",
  "research_finding",
  "open_question",
  "known_risk",
  "agent_summary",
  "user_preference",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_CONFIDENCE_LEVELS = [
  "confirmed",
  "hypothesis",
  "inferred",
  "simulated",
] as const;

export type MemoryConfidence = (typeof MEMORY_CONFIDENCE_LEVELS)[number];

export const MEMORY_FRESHNESS_STATUSES = [
  "fresh",
  "stale",
  "expired",
  "superseded",
] as const;

export type MemoryFreshnessStatus = (typeof MEMORY_FRESHNESS_STATUSES)[number];

export const MEMORY_CONFLICT_RESOLUTIONS = [
  "unresolved",
  "superseded",
  "reconciled",
  "preserved_disagreement",
] as const;

export type MemoryConflictResolution = (typeof MEMORY_CONFLICT_RESOLUTIONS)[number];

export const MEMORY_SOURCE_TYPES = [
  "file",
  "task",
  "user",
  "report",
  "commit",
  "tool_call",
  "debate",
  "conversation",
  "system",
] as const;

export type MemorySourceType = (typeof MEMORY_SOURCE_TYPES)[number];

/**
 * Detailed provenance information identifying where a memory item came from.
 */
export interface MemoryProvenance {
  readonly sourceType: MemorySourceType;
  readonly sourceReference?: string;
  readonly author?: string;
  readonly rationale?: string;
}

/**
 * Durable project memory entity preserving cross-session project context.
 */
export interface MemoryItem extends BaseEntity {
  readonly category: MemoryCategory;
  readonly key: string;
  readonly content: string;
  readonly confidence: MemoryConfidence;
  readonly projectId: string;
  readonly taskId?: string;
  readonly owner?: string;
  readonly provenance?: MemoryProvenance;
  readonly sourceReference?: string; // Kept for backward compatibility
  readonly tags: readonly string[];
  readonly isArchived: boolean;
  readonly lastValidatedAt?: string;
  readonly freshnessStatus?: MemoryFreshnessStatus;
  readonly isConflicted?: boolean;
  readonly conflictWithId?: string;
  readonly conflictReason?: string;
  readonly conflictResolution?: MemoryConflictResolution;
}

export interface MemoryFilter {
  readonly projectId?: string;
  readonly taskId?: string;
  readonly category?: MemoryCategory;
  readonly confidence?: MemoryConfidence;
  readonly freshnessStatus?: MemoryFreshnessStatus;
  readonly isConflicted?: boolean;
  readonly includeArchived?: boolean;
  readonly search?: string;
  readonly tags?: readonly string[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface MemoryCreateInput {
  readonly category: MemoryCategory;
  readonly key: string;
  readonly content: string;
  readonly confidence: MemoryConfidence;
  readonly projectId?: string;
  readonly taskId?: string;
  readonly owner?: string;
  readonly provenance?: MemoryProvenance;
  readonly sourceReference?: string;
  readonly tags?: readonly string[];
}

export interface MemoryUpdateInput {
  readonly content?: string;
  readonly confidence?: MemoryConfidence;
  readonly tags?: readonly string[];
  readonly isArchived?: boolean;
  readonly lastValidatedAt?: string;
  readonly freshnessStatus?: MemoryFreshnessStatus;
  readonly conflictResolution?: MemoryConflictResolution;
}

export function validateMemoryProvenance(
  value: unknown,
  path = "provenance"
): Result<MemoryProvenance, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const sourceType = collector.check(
    validateEnum(value.sourceType, `${path}.sourceType`, MEMORY_SOURCE_TYPES)
  );

  const sourceReference =
    typeof value.sourceReference === "string"
      ? collector.check(
          validateString(value.sourceReference, `${path}.sourceReference`, {
            minLength: 1,
            maxLength: 500,
          })
        )
      : undefined;

  const author =
    typeof value.author === "string"
      ? collector.check(
          validateString(value.author, `${path}.author`, {
            minLength: 1,
            maxLength: 200,
          })
        )
      : undefined;

  const rationale =
    typeof value.rationale === "string"
      ? collector.check(
          validateString(value.rationale, `${path}.rationale`, {
            minLength: 1,
            maxLength: 5000,
          })
        )
      : undefined;

  if (collector.hasIssues() || sourceType === undefined) {
    return fail(collector.toError("MemoryProvenance validation failed"));
  }

  return ok({
    sourceType,
    sourceReference,
    author,
    rationale,
  });
}

export function validateMemoryItem(
  value: unknown,
  path = "memoryItem"
): Result<MemoryItem, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const category = collector.check(validateEnum(value.category, `${path}.category`, MEMORY_CATEGORIES));
  const key = collector.check(validateString(value.key, `${path}.key`, { minLength: 1, maxLength: 200 }));
  const content = collector.check(
    validateString(value.content, `${path}.content`, { minLength: 1, maxLength: 50000 })
  );
  const confidence = collector.check(
    validateEnum(value.confidence, `${path}.confidence`, MEMORY_CONFIDENCE_LEVELS)
  );
  const isArchived = collector.check(validateBoolean(value.isArchived ?? false, `${path}.isArchived`));
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));

  const projectId =
    typeof value.projectId === "string"
      ? collector.check(
          validateString(value.projectId, `${path}.projectId`, { minLength: 1, maxLength: 100 })
        ) ?? "default"
      : "default";

  const taskId =
    typeof value.taskId === "string"
      ? collector.check(
          validateString(value.taskId, `${path}.taskId`, { minLength: 1, maxLength: 100 })
        )
      : undefined;

  const owner =
    typeof value.owner === "string"
      ? collector.check(
          validateString(value.owner, `${path}.owner`, { minLength: 1, maxLength: 200 })
        )
      : undefined;

  let provenance: MemoryProvenance | undefined = undefined;
  if (value.provenance !== undefined) {
    const provRes = validateMemoryProvenance(value.provenance, `${path}.provenance`);
    if (provRes.success) {
      provenance = provRes.data;
    } else {
      collector.addIssues(provRes.error.issues);
    }
  }

  const lastValidatedAt =
    typeof value.lastValidatedAt === "string"
      ? collector.check(validateIsoDateTime(value.lastValidatedAt, `${path}.lastValidatedAt`))
      : undefined;

  const freshnessStatus =
    value.freshnessStatus !== undefined
      ? collector.check(
          validateEnum(value.freshnessStatus, `${path}.freshnessStatus`, MEMORY_FRESHNESS_STATUSES)
        )
      : undefined;

  const isConflicted =
    value.isConflicted !== undefined
      ? collector.check(validateBoolean(value.isConflicted, `${path}.isConflicted`))
      : undefined;

  const conflictWithId =
    typeof value.conflictWithId === "string"
      ? collector.check(
          validateString(value.conflictWithId, `${path}.conflictWithId`, { minLength: 1, maxLength: 100 })
        )
      : undefined;

  const conflictReason =
    typeof value.conflictReason === "string"
      ? collector.check(
          validateString(value.conflictReason, `${path}.conflictReason`, { minLength: 1, maxLength: 5000 })
        )
      : undefined;

  const conflictResolution =
    value.conflictResolution !== undefined
      ? collector.check(
          validateEnum(
            value.conflictResolution,
            `${path}.conflictResolution`,
            MEMORY_CONFLICT_RESOLUTIONS
          )
        )
      : undefined;

  const tags = collector.check(
    validateArray(value.tags ?? [], `${path}.tags`, (t, tPath) =>
      validateString(t, tPath, { minLength: 1, maxLength: 50 })
    )
  );

  if (
    collector.hasIssues() ||
    id === undefined ||
    category === undefined ||
    key === undefined ||
    content === undefined ||
    confidence === undefined ||
    isArchived === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return fail(collector.toError("MemoryItem validation failed"));
  }

  return ok({
    id,
    category,
    key,
    content,
    confidence,
    projectId,
    taskId,
    owner,
    provenance,
    sourceReference: typeof value.sourceReference === "string" ? value.sourceReference : undefined,
    tags: tags ?? [],
    isArchived,
    lastValidatedAt,
    freshnessStatus: freshnessStatus ?? "fresh",
    isConflicted: isConflicted ?? false,
    conflictWithId,
    conflictReason,
    conflictResolution: conflictResolution ?? (isConflicted ? "unresolved" : undefined),
    createdAt,
    updatedAt,
  });
}
