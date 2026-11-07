/**
 * @terrarium/contracts - context.ts
 *
 * Context assembly contracts, per-agent tailored packages, history summarization, and token budgeting.
 * Aligns strictly with PLAN_CONTEXT.md Section 6 (Context & Memory Discipline) and PLAN.md Section 14.
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError } from "./errors.ts";
import { type MemoryCategory, type MemoryItem, validateMemoryItem } from "./memory.ts";
import { type AgentDepartment, AGENT_DEPARTMENTS } from "./departments.ts";
import { type TaskPriority, TASK_PRIORITIES } from "./tasks.ts";
import {
  isRecord,
  validateArray,
  validateEnum,
  validateIsoDateTime,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

/**
 * Lightweight reference to a project artifact/document/report without inlining raw full content.
 */
export interface ArtifactReference {
  readonly id: string;
  readonly title: string;
  readonly pathOrUri: string;
  readonly artifactType: string;
  readonly summary: string;
  readonly relevanceScore?: number;
}

/**
 * Scoped task information injected into the agent's context package.
 */
export interface ContextTaskBrief {
  readonly taskId: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly priority: TaskPriority;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly parentTaskId?: string;
}

/**
 * Per-agent context package tailored to role, department, capabilities, and active task.
 * Prevents naive full-history broadcasting and enforces context budgets.
 */
export interface AgentContextPackage extends BaseEntity {
  readonly projectId: string;
  readonly taskId: string;
  readonly agentSlug: string;
  readonly department: AgentDepartment;
  readonly assembledAt: string;
  readonly taskContext: ContextTaskBrief;
  readonly relevantMemories: readonly MemoryItem[];
  readonly durableDecisions: readonly MemoryItem[];
  readonly activeConstraints: readonly string[];
  readonly userPreferences: readonly MemoryItem[];
  readonly artifactReferences: readonly ArtifactReference[];
  readonly conversationSummary?: string;
  readonly tokenEstimate: number;
  readonly tokenLimit: number;
  readonly warnings: readonly string[];
}

/**
 * Request parameter for assembling a scoped context package.
 */
export interface ContextAssemblyRequest {
  readonly projectId: string;
  readonly taskId: string;
  readonly agentSlug: string;
  readonly maxTokens?: number;
  readonly categories?: readonly MemoryCategory[];
  readonly includeStale?: boolean;
}

/**
 * Conversation turn for history summarization.
 */
export interface HistoryTurn {
  readonly role: "user" | "agent" | "system" | "tool";
  readonly content: string;
  readonly senderId?: string;
  readonly timestamp?: string;
  readonly references?: {
    readonly decisions?: readonly string[];
    readonly artifacts?: readonly string[];
    readonly tasks?: readonly string[];
    readonly commits?: readonly string[];
  };
}

/**
 * History summarization output retaining explicit decision and artifact citations.
 */
export interface HistorySummary {
  readonly summary: string;
  readonly retainedDecisions: readonly string[];
  readonly retainedArtifacts: readonly string[];
  readonly retainedTasks: readonly string[];
  readonly retainedCommits: readonly string[];
  readonly originalTurnsCount: number;
  readonly summarizedTurnsCount: number;
}

export function validateArtifactReference(
  value: unknown,
  path = "artifactReference"
): Result<ArtifactReference, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const title = collector.check(validateString(value.title, `${path}.title`, { minLength: 1, maxLength: 200 }));
  const pathOrUri = collector.check(
    validateString(value.pathOrUri, `${path}.pathOrUri`, { minLength: 1, maxLength: 1000 })
  );
  const artifactType = collector.check(
    validateString(value.artifactType, `${path}.artifactType`, { minLength: 1, maxLength: 100 })
  );
  const summary = collector.check(
    validateString(value.summary, `${path}.summary`, { minLength: 1, maxLength: 5000 })
  );

  const relevanceScore =
    typeof value.relevanceScore === "number"
      ? collector.check(
          validateNumber(value.relevanceScore, `${path}.relevanceScore`, { min: 0, max: 1 })
        )
      : undefined;

  if (
    collector.hasIssues() ||
    id === undefined ||
    title === undefined ||
    pathOrUri === undefined ||
    artifactType === undefined ||
    summary === undefined
  ) {
    return fail(collector.toError("ArtifactReference validation failed"));
  }

  return ok({
    id,
    title,
    pathOrUri,
    artifactType,
    summary,
    relevanceScore,
  });
}

export function validateAgentContextPackage(
  value: unknown,
  path = "contextPackage"
): Result<AgentContextPackage, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const projectId = collector.check(
    validateString(value.projectId, `${path}.projectId`, { minLength: 1, maxLength: 100 })
  );
  const taskId = collector.check(
    validateString(value.taskId, `${path}.taskId`, { minLength: 1, maxLength: 100 })
  );
  const agentSlug = collector.check(
    validateString(value.agentSlug, `${path}.agentSlug`, { minLength: 1, maxLength: 100 })
  );
  const department = collector.check(
    validateEnum(value.department, `${path}.department`, AGENT_DEPARTMENTS)
  );
  const assembledAt = collector.check(
    validateIsoDateTime(value.assembledAt, `${path}.assembledAt`)
  );
  const createdAt = collector.check(
    validateIsoDateTime(value.createdAt ?? value.assembledAt, `${path}.createdAt`)
  );
  const updatedAt = collector.check(
    validateIsoDateTime(value.updatedAt ?? value.assembledAt, `${path}.updatedAt`)
  );

  const tokenEstimate = collector.check(
    validateNumber(value.tokenEstimate, `${path}.tokenEstimate`, { min: 0, max: 10_000_000 })
  );
  const tokenLimit = collector.check(
    validateNumber(value.tokenLimit, `${path}.tokenLimit`, { min: 1, max: 10_000_000 })
  );

  if (!isRecord(value.taskContext)) {
    collector.addIssue(`${path}.taskContext`, "Expected taskContext object", value.taskContext);
  }

  const taskBrief: ContextTaskBrief = isRecord(value.taskContext)
    ? {
        taskId: String(value.taskContext.taskId ?? ""),
        title: String(value.taskContext.title ?? ""),
        description: String(value.taskContext.description ?? ""),
        category: String(value.taskContext.category ?? ""),
        priority: (value.taskContext.priority as TaskPriority) ?? "medium",
        inputs: isRecord(value.taskContext.inputs) ? (value.taskContext.inputs as Record<string, unknown>) : {},
        parentTaskId:
          typeof value.taskContext.parentTaskId === "string"
            ? value.taskContext.parentTaskId
            : undefined,
      }
    : ({} as ContextTaskBrief);

  const activeConstraints = collector.check(
    validateArray(value.activeConstraints ?? [], `${path}.activeConstraints`, (c, cPath) =>
      validateString(c, cPath, { minLength: 1, maxLength: 500 })
    )
  );

  const warnings = collector.check(
    validateArray(value.warnings ?? [], `${path}.warnings`, (w, wPath) =>
      validateString(w, wPath, { minLength: 1, maxLength: 1000 })
    )
  );

  if (
    collector.hasIssues() ||
    id === undefined ||
    projectId === undefined ||
    taskId === undefined ||
    agentSlug === undefined ||
    department === undefined ||
    assembledAt === undefined ||
    createdAt === undefined ||
    updatedAt === undefined ||
    tokenEstimate === undefined ||
    tokenLimit === undefined
  ) {
    return fail(collector.toError("AgentContextPackage validation failed"));
  }

  return ok({
    id,
    projectId,
    taskId,
    agentSlug,
    department,
    assembledAt,
    taskContext: taskBrief,
    relevantMemories: Array.isArray(value.relevantMemories) ? (value.relevantMemories as MemoryItem[]) : [],
    durableDecisions: Array.isArray(value.durableDecisions) ? (value.durableDecisions as MemoryItem[]) : [],
    activeConstraints: activeConstraints ?? [],
    userPreferences: Array.isArray(value.userPreferences) ? (value.userPreferences as MemoryItem[]) : [],
    artifactReferences: Array.isArray(value.artifactReferences)
      ? (value.artifactReferences as ArtifactReference[])
      : [],
    conversationSummary:
      typeof value.conversationSummary === "string" ? value.conversationSummary : undefined,
    tokenEstimate,
    tokenLimit,
    warnings: warnings ?? [],
    createdAt,
    updatedAt,
  });
}
