/**
 * @terrarium/contracts - artifacts.ts
 *
 * Verifiable deliverables and artifact contracts produced by tasks and agents.
 * Aligns with PLAN.md Section 10.3 (Code Improvement) and Section 15 (Reports & Deliverables).
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError, type ValidationIssue } from "./errors.ts";
import {
  isRecord,
  validateBoolean,
  validateEnum,
  validateIsoDateTime,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

export const ARTIFACT_TYPES = [
  "code_patch",
  "document",
  "report",
  "test_plan",
  "architecture_spec",
  "data_export",
  "log",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export interface Artifact extends BaseEntity {
  readonly taskId: string;
  readonly agentId: string;
  readonly title: string;
  readonly artifactType: ArtifactType;
  readonly path: string;
  readonly mimeType: string;
  readonly checksum?: string;
  readonly sizeBytes: number;
  readonly isVerified: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function validateArtifact(
  value: unknown,
  path = "artifact"
): Result<Artifact, DomainValidationError> {
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
  const agentId = collector.check(validateString(value.agentId, `${path}.agentId`, { minLength: 1, maxLength: 100 }));
  const title = collector.check(validateString(value.title, `${path}.title`, { minLength: 1, maxLength: 200 }));
  const artifactType = collector.check(
    validateEnum(value.artifactType, `${path}.artifactType`, ARTIFACT_TYPES)
  );
  const filePath = collector.check(
    validateString(value.path, `${path}.path`, { minLength: 1, maxLength: 1000 })
  );
  const mimeType = collector.check(
    validateString(value.mimeType, `${path}.mimeType`, { minLength: 1, maxLength: 100 })
  );
  const sizeBytes = collector.check(
    validateNumber(value.sizeBytes, `${path}.sizeBytes`, { min: 0, integer: true })
  );
  const isVerified = collector.check(validateBoolean(value.isVerified, `${path}.isVerified`));
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));

  if (
    collector.hasIssues() ||
    id === undefined ||
    taskId === undefined ||
    agentId === undefined ||
    title === undefined ||
    artifactType === undefined ||
    filePath === undefined ||
    mimeType === undefined ||
    sizeBytes === undefined ||
    isVerified === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return fail(collector.toError("Artifact validation failed"));
  }

  return ok({
    id,
    taskId,
    agentId,
    title,
    artifactType,
    path: filePath,
    mimeType,
    checksum: typeof value.checksum === "string" ? value.checksum : undefined,
    sizeBytes,
    isVerified,
    metadata: value.metadata as Record<string, unknown> | undefined,
    createdAt,
    updatedAt,
  });
}
