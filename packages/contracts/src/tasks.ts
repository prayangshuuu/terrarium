/**
 * @terrarium/contracts - tasks.ts
 *
 * Task and step models, lifecycle states, transitions, and validation.
 * Aligns strictly with PLAN.md Section 5.4 (Task Lifecycle) and Section 5.3 (Delegation Rules).
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError, InvalidStateTransitionError, type ValidationIssue } from "./errors.ts";
import { AGENT_DEPARTMENTS, type AgentDepartment } from "./departments.ts";
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
 * Task lifecycle states defined in PLAN.md Section 5.4.
 */
export const TASK_STATUSES = [
  "draft",
  "planned",
  "queued",
  "running",
  "waiting_for_input",
  "waiting_for_approval",
  "completed",
  "failed",
  "cancelled",
  "blocked",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Validated task state transition graph.
 */
export const TASK_STATE_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  draft: ["planned", "cancelled"],
  planned: ["queued", "cancelled"],
  queued: ["running", "cancelled"],
  running: [
    "waiting_for_input",
    "waiting_for_approval",
    "completed",
    "failed",
    "cancelled",
    "blocked",
  ],
  waiting_for_input: ["running", "cancelled", "failed"],
  waiting_for_approval: ["running", "cancelled", "failed", "blocked"],
  blocked: ["queued", "running", "cancelled", "failed"],
  // Terminal states; failed tasks may be re-queued with bounded retries
  completed: [],
  failed: ["queued"],
  cancelled: [],
};

/**
 * Step lifecycle states.
 */
export const STEP_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "cancelled",
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export const STEP_STATE_TRANSITIONS: Readonly<Record<StepStatus, readonly StepStatus[]>> = {
  pending: ["running", "skipped", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: ["pending"], // bounded retry
  skipped: [],
  cancelled: [],
};

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * Granular step within an orchestration task.
 */
export interface TaskStep {
  readonly id: string;
  readonly taskId: string;
  readonly stepIndex: number;
  readonly title: string;
  readonly description: string;
  readonly assignedAgentId?: string;
  readonly status: StepStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly error?: string;
  readonly toolCalls?: readonly string[];
}

/**
 * Task context reference pointing to repository files, symbols, reports, or memory IDs.
 */
export interface ContextReference {
  readonly type: "file" | "symbol" | "report" | "memory" | "task";
  readonly target: string;
  readonly description?: string;
}

/**
 * Complete orchestration Task entity.
 */
export interface Task extends BaseEntity {
  readonly title: string;
  readonly description: string;
  readonly parentTaskId?: string;
  readonly department: AgentDepartment;
  readonly assignedAgentId?: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly contextRefs: readonly ContextReference[];
  readonly expectedDeliverables: readonly string[];
  readonly delegationDepth: number;
  readonly resultId?: string;
  readonly failureReason?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

/**
 * Input required to create a new task.
 */
export interface TaskCreateInput {
  readonly title: string;
  readonly description: string;
  readonly department: AgentDepartment;
  readonly parentTaskId?: string;
  readonly assignedAgentId?: string;
  readonly priority?: TaskPriority;
  readonly contextRefs?: readonly ContextReference[];
  readonly expectedDeliverables?: readonly string[];
}

/**
 * Validates whether a proposed task state transition is legal.
 */
export function isValidTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  const allowed = TASK_STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Asserts a legal task state transition or returns a typed InvalidStateTransitionError.
 */
export function assertTaskTransition(
  from: TaskStatus,
  to: TaskStatus
): Result<TaskStatus, InvalidStateTransitionError> {
  if (isValidTaskTransition(from, to)) {
    return ok(to);
  }
  const allowed = TASK_STATE_TRANSITIONS[from] ?? [];
  return fail(new InvalidStateTransitionError("Task", from, to, allowed));
}

/**
 * Validates whether a proposed step state transition is legal.
 */
export function isValidStepTransition(from: StepStatus, to: StepStatus): boolean {
  if (from === to) return true;
  const allowed = STEP_STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Asserts a legal step state transition or returns a typed InvalidStateTransitionError.
 */
export function assertStepTransition(
  from: StepStatus,
  to: StepStatus
): Result<StepStatus, InvalidStateTransitionError> {
  if (isValidStepTransition(from, to)) {
    return ok(to);
  }
  const allowed = STEP_STATE_TRANSITIONS[from] ?? [];
  return fail(new InvalidStateTransitionError("TaskStep", from, to, allowed));
}

/**
 * Validates a ContextReference boundary input.
 */
export function validateContextReference(
  value: unknown,
  path = "contextRef"
): Result<ContextReference, ValidationIssue> {
  if (!isRecord(value)) {
    return fail({ path, message: "Expected object for ContextReference", received: value });
  }

  const typeRes = validateEnum(value.type, `${path}.type`, [
    "file",
    "symbol",
    "report",
    "memory",
    "task",
  ] as const);
  if (!typeRes.success) return typeRes;

  const targetRes = validateString(value.target, `${path}.target`, { minLength: 1, maxLength: 500 });
  if (!targetRes.success) return targetRes;

  return ok({
    type: typeRes.data,
    target: targetRes.data,
    description: typeof value.description === "string" ? value.description : undefined,
  });
}

/**
 * Validates a Task boundary input.
 */
export function validateTask(value: unknown, path = "task"): Result<Task, DomainValidationError> {
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
  const description = collector.check(
    validateString(value.description, `${path}.description`, { minLength: 1, maxLength: 10000 })
  );
  const department = collector.check(validateEnum(value.department, `${path}.department`, AGENT_DEPARTMENTS));
  const status = collector.check(validateEnum(value.status, `${path}.status`, TASK_STATUSES));
  const priority = collector.check(validateEnum(value.priority, `${path}.priority`, TASK_PRIORITIES));
  const depth = collector.check(
    validateNumber(value.delegationDepth ?? 0, `${path}.delegationDepth`, {
      min: 0,
      max: 10,
      integer: true,
    })
  );
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));

  const contextRefs = collector.check(
    validateArray(value.contextRefs ?? [], `${path}.contextRefs`, validateContextReference)
  );

  const deliverables = collector.check(
    validateArray(value.expectedDeliverables ?? [], `${path}.expectedDeliverables`, (d, dPath) =>
      validateString(d, dPath, { minLength: 1, maxLength: 200 })
    )
  );

  if (
    collector.hasIssues() ||
    id === undefined ||
    title === undefined ||
    description === undefined ||
    department === undefined ||
    status === undefined ||
    priority === undefined ||
    depth === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return fail(collector.toError("Task validation failed"));
  }

  return ok({
    id,
    title,
    description,
    department,
    parentTaskId: typeof value.parentTaskId === "string" ? value.parentTaskId : undefined,
    assignedAgentId: typeof value.assignedAgentId === "string" ? value.assignedAgentId : undefined,
    status,
    priority,
    contextRefs: contextRefs ?? [],
    expectedDeliverables: deliverables ?? [],
    delegationDepth: depth,
    resultId: typeof value.resultId === "string" ? value.resultId : undefined,
    failureReason: typeof value.failureReason === "string" ? value.failureReason : undefined,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : undefined,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : undefined,
    createdAt,
    updatedAt,
  });
}

/**
 * Validates a TaskCreateInput boundary input.
 */
export function validateTaskCreateInput(
  value: unknown,
  path = "taskCreateInput"
): Result<TaskCreateInput, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const title = collector.check(validateString(value.title, `${path}.title`, { minLength: 1, maxLength: 200 }));
  const description = collector.check(
    validateString(value.description, `${path}.description`, { minLength: 1, maxLength: 10000 })
  );
  const department = collector.check(validateEnum(value.department, `${path}.department`, AGENT_DEPARTMENTS));

  let priority: TaskPriority = "medium";
  if (value.priority !== undefined) {
    const p = collector.check(validateEnum(value.priority, `${path}.priority`, TASK_PRIORITIES));
    if (p !== undefined) {
      priority = p;
    }
  }

  if (collector.hasIssues() || title === undefined || description === undefined || department === undefined) {
    return fail(collector.toError("TaskCreateInput validation failed"));
  }

  return ok({
    title,
    description,
    department,
    parentTaskId: typeof value.parentTaskId === "string" ? value.parentTaskId : undefined,
    assignedAgentId: typeof value.assignedAgentId === "string" ? value.assignedAgentId : undefined,
    priority,
    contextRefs: Array.isArray(value.contextRefs) ? (value.contextRefs as ContextReference[]) : undefined,
    expectedDeliverables: Array.isArray(value.expectedDeliverables)
      ? (value.expectedDeliverables as string[])
      : undefined,
  });
}
