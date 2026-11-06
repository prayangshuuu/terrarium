/**
 * @terrarium/contracts - memory.ts
 *
 * Project context memory items, knowledge categories, confidence levels, and validation.
 * Aligns strictly with PLAN.md Section 14 (Memory & Knowledge Management).
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError, type ValidationIssue } from "./errors.ts";
import {
  isRecord,
  validateArray,
  validateBoolean,
  validateEnum,
  validateIsoDateTime,
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

export interface MemoryItem extends BaseEntity {
  readonly category: MemoryCategory;
  readonly key: string;
  readonly content: string;
  readonly confidence: MemoryConfidence;
  readonly sourceReference?: string;
  readonly tags: readonly string[];
  readonly isArchived: boolean;
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
    sourceReference: typeof value.sourceReference === "string" ? value.sourceReference : undefined,
    tags: tags ?? [],
    isArchived,
    createdAt,
    updatedAt,
  });
}
