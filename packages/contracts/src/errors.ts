/**
 * @terrarium/contracts - errors.ts
 *
 * Strongly typed domain error hierarchy, error codes, and validation issues.
 * Serializes safely to JSON across IPC, CLI, and future Studio boundaries.
 */

export type TerrariumErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_STATE_TRANSITION"
  | "NOT_FOUND"
  | "PROFILE_NOT_FOUND"
  | "AGENT_REGISTRY_ERROR"
  | "PERMISSION_DENIED"
  | "BUDGET_EXCEEDED"
  | "PROVIDER_ERROR"
  | "PROVIDER_AUTHENTICATION_ERROR"
  | "PROVIDER_RATE_LIMIT_ERROR"
  | "PROVIDER_TIMEOUT_ERROR"
  | "PROVIDER_NETWORK_ERROR"
  | "PROVIDER_INVALID_REQUEST_ERROR"
  | "PROVIDER_SERVER_ERROR"
  | "PROVIDER_UNAUTHORIZED_CALL_ERROR"
  | "DELEGATION_LIMIT_EXCEEDED"
  | "DATABASE_ERROR"
  | "DUPLICATE_ENTITY"
  | "FOREIGN_KEY_VIOLATION"
  | "DATABASE_UNAVAILABLE"
  | "MIGRATION_MISMATCH"
  | "CANCELLED"
  | "TIMEOUT"
  | "TOOL_NOT_FOUND"
  | "TOOL_VALIDATION_ERROR"
  | "TOOL_EXECUTION_ERROR"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_REJECTED"
  | "APPROVAL_EXPIRED"
  | "APPROVAL_CANCELLED"
  | "DUPLICATE_EXECUTION"
  | "TOOL_TIMEOUT"
  | "MEMORY_ERROR"
  | "MEMORY_NOT_FOUND"
  | "MEMORY_CONFLICT"
  | "STALE_MEMORY"
  | "CONTEXT_BUDGET_EXCEEDED"
  | "CROSS_PROJECT_CONTEXT_LEAK"
  | "CONCURRENCY_LIMIT_EXCEEDED"
  | "DURATION_LIMIT_EXCEEDED"
  | "MODEL_ROUTING_ERROR"
  | "RESERVATION_EXHAUSTED"
  | "TELEMETRY_ERROR"
  | "SECRET_LEAK_DETECTED"
  | "INTERNAL_ERROR";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code?: string;
  readonly received?: unknown;
}

/**
 * Base domain error class with structured code, details, and serialization.
 */
export class TerrariumError extends Error {
  readonly code: TerrariumErrorCode;
  readonly details?: Record<string, unknown>;
  readonly timestamp: string;

  constructor(
    message: string,
    code: TerrariumErrorCode = "INTERNAL_ERROR",
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "TerrariumError";
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Domain input validation error containing specific field-level issues.
 */
export class DomainValidationError extends TerrariumError {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string, issues: readonly ValidationIssue[] = []) {
    super(message, "VALIDATION_ERROR", { issues });
    this.name = "DomainValidationError";
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      issues: this.issues,
    };
  }
}

/**
 * Error thrown when an entity attempts an illegal state transition.
 */
export class InvalidStateTransitionError extends TerrariumError {
  readonly entityType: string;
  readonly fromState: string;
  readonly toState: string;
  readonly allowedTransitions: readonly string[];

  constructor(
    entityType: string,
    fromState: string,
    toState: string,
    allowedTransitions: readonly string[]
  ) {
    super(
      `Cannot transition ${entityType} from state '${fromState}' to '${toState}'. Allowed transitions: [${allowedTransitions.join(", ")}]`,
      "INVALID_STATE_TRANSITION",
      { entityType, fromState, toState, allowedTransitions }
    );
    this.name = "InvalidStateTransitionError";
    this.entityType = entityType;
    this.fromState = fromState;
    this.toState = toState;
    this.allowedTransitions = allowedTransitions;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Entity not found error.
 */
export class NotFoundError extends TerrariumError {
  readonly entityType: string;
  readonly entityId: string;

  constructor(entityType: string, entityId: string) {
    super(`${entityType} with id '${entityId}' was not found`, "NOT_FOUND", {
      entityType,
      entityId,
    });
    this.name = "NotFoundError";
    this.entityType = entityType;
    this.entityId = entityId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Action blocked due to insufficient permissions or missing human approval.
 */
export class PermissionDeniedError extends TerrariumError {
  readonly action: string;
  readonly resource: string;
  readonly reason: string;

  constructor(action: string, resource: string, reason: string) {
    super(
      `Permission denied for action '${action}' on resource '${resource}': ${reason}`,
      "PERMISSION_DENIED",
      { action, resource, reason }
    );
    this.name = "PermissionDeniedError";
    this.action = action;
    this.resource = resource;
    this.reason = reason;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Operation stopped or blocked because token or dollar spend limit was exceeded.
 */
export class BudgetExceededError extends TerrariumError {
  readonly scope: string;
  readonly current: number;
  readonly limit: number;
  readonly unit: "tokens" | "usd" | "duration" | "concurrency";

  constructor(
    scope: string,
    current: number,
    limit: number,
    unit: "tokens" | "usd" | "duration" | "concurrency" = "tokens",
    customMessage?: string
  ) {
    const formattedCurrent = unit === "usd" ? `$${current.toFixed(2)}` : unit === "duration" ? `${current}ms` : `${current} tokens`;
    const formattedLimit = unit === "usd" ? `$${limit.toFixed(2)}` : unit === "duration" ? `${limit}ms` : `${limit} tokens`;
    super(
      customMessage ?? `Budget exceeded for scope '${scope}': consumed ${formattedCurrent} of ${formattedLimit} limit`,
      "BUDGET_EXCEEDED",
      { scope, current, limit, unit }
    );
    this.name = "BudgetExceededError";
    this.scope = scope;
    this.current = current;
    this.limit = limit;
    this.unit = unit;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an attempt to reserve or allocate budget fails because limits are exhausted.
 */
export class BudgetExhaustedError extends BudgetExceededError {
  constructor(scope: string, requested: number, limit: number, unit: "tokens" | "usd" = "tokens") {
    super(
      scope,
      requested,
      limit,
      unit,
      `Budget limit exceeded for scope '${scope}': requested ${unit === "usd" ? `$${requested.toFixed(2)}` : requested} exceeds available budget (limit: ${unit === "usd" ? `$${limit.toFixed(2)}` : limit})`
    );
    this.name = "BudgetExhaustedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an operation exceeds configured dollar spend limit.
 */
export class SpendLimitExceededError extends BudgetExceededError {
  constructor(currentSpendUsd: number, spendLimitUsd: number, scope = "task") {
    super(scope, currentSpendUsd, spendLimitUsd, "usd");
    const formattedCurrent = `$${currentSpendUsd.toFixed(2)}`;
    const formattedLimit = `$${spendLimitUsd.toFixed(2)}`;
    this.message = `Spend limit exceeded for scope '${scope}': consumed ${formattedCurrent} of ${formattedLimit} limit`;
    this.name = "SpendLimitExceededError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an operation exceeds configured timeout limit.
 */
export class TimeoutError extends TerrariumError {
  readonly timeoutMs: number;
  readonly scope: string;

  constructor(message: string, timeoutMs: number, scope = "operation") {
    super(message, "TIMEOUT", { timeoutMs, scope });
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
    this.scope = scope;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Provider-level communication, rate limit, or model execution error.
 */
export class ProviderError extends TerrariumError {
  readonly provider: string;
  readonly model?: string;
  readonly isRetryable: boolean;
  readonly statusCode?: number;

  constructor(
    message: string,
    provider: string,
    isRetryable = false,
    model?: string,
    statusCode?: number,
    code: TerrariumErrorCode = "PROVIDER_ERROR"
  ) {
    super(message, code, { provider, model, isRetryable, statusCode });
    this.name = "ProviderError";
    this.provider = provider;
    this.model = model;
    this.isRetryable = isRetryable;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when provider authentication fails (e.g. invalid or missing API key, 401/403).
 */
export class ProviderAuthenticationError extends ProviderError {
  constructor(message: string, provider: string, model?: string) {
    super(message, provider, false, model, 401, "PROVIDER_AUTHENTICATION_ERROR");
    this.name = "ProviderAuthenticationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when provider rate limit is exceeded (HTTP 429), containing optional retry-after metadata.
 */
export class ProviderRateLimitError extends ProviderError {
  readonly retryAfterMs?: number;

  constructor(message: string, provider: string, retryAfterMs?: number, model?: string) {
    super(message, provider, true, model, 429, "PROVIDER_RATE_LIMIT_ERROR");
    this.name = "ProviderRateLimitError";
    this.retryAfterMs = retryAfterMs;
    (this as any).details = { ...(this.details ?? {}), retryAfterMs };
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a provider request or stream chunk times out.
 */
export class ProviderTimeoutError extends ProviderError {
  readonly timeoutMs: number;

  constructor(message: string, provider: string, timeoutMs: number, model?: string) {
    super(message, provider, true, model, 408, "PROVIDER_TIMEOUT_ERROR");
    this.name = "ProviderTimeoutError";
    this.timeoutMs = timeoutMs;
    (this as any).details = { ...(this.details ?? {}), timeoutMs };
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown on low-level connection failures, DNS lookup failures, or network disconnections.
 */
export class ProviderNetworkError extends ProviderError {
  constructor(message: string, provider: string, model?: string) {
    super(message, provider, true, model, undefined, "PROVIDER_NETWORK_ERROR");
    this.name = "ProviderNetworkError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the model request parameters, schema, or prompt length is invalid (HTTP 400).
 */
export class ProviderInvalidRequestError extends ProviderError {
  constructor(message: string, provider: string, model?: string) {
    super(message, provider, false, model, 400, "PROVIDER_INVALID_REQUEST_ERROR");
    this.name = "ProviderInvalidRequestError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown on 5xx upstream server errors or model overload conditions.
 */
export class ProviderServerError extends ProviderError {
  constructor(message: string, provider: string, statusCode = 500, model?: string) {
    super(message, provider, true, model, statusCode, "PROVIDER_SERVER_ERROR");
    this.name = "ProviderServerError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an external/paid provider API call is attempted without explicit authorization or valid credentials.
 * Enforces PLAN_CONTEXT.md Section 7 and Prompt 9 authorization rules.
 */
export class ProviderUnauthorizedCallError extends ProviderError {
  readonly reason: string;

  constructor(provider: string, reason: string, model?: string) {
    super(
      `External call blocked for provider '${provider}': ${reason}. Explicit authorization or configured credentials required.`,
      provider,
      false,
      model,
      403,
      "PROVIDER_UNAUTHORIZED_CALL_ERROR"
    );
    this.name = "ProviderUnauthorizedCallError";
    this.reason = reason;
    (this as any).details = { ...(this.details ?? {}), reason };
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Base database and persistence operation error.
 */
export class DatabaseError extends TerrariumError {
  constructor(message: string, code: TerrariumErrorCode = "DATABASE_ERROR", details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = "DatabaseError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when attempting to insert an entity with an ID or unique key that already exists.
 */
export class DuplicateEntityError extends DatabaseError {
  readonly entityType: string;
  readonly entityId: string;

  constructor(entityType: string, entityId: string) {
    super(
      `Cannot create ${entityType}: an entity with ID '${entityId}' already exists`,
      "DUPLICATE_ENTITY",
      { entityType, entityId }
    );
    this.name = "DuplicateEntityError";
    this.entityType = entityType;
    this.entityId = entityId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a foreign key relationship constraint is violated.
 */
export class ForeignKeyConstraintError extends DatabaseError {
  readonly entityType: string;
  readonly foreignKey: string;
  readonly targetId: string;

  constructor(entityType: string, foreignKey: string, targetId: string) {
    super(
      `Foreign key constraint failed on ${entityType} for ${foreignKey}='${targetId}'`,
      "FOREIGN_KEY_VIOLATION",
      { entityType, foreignKey, targetId }
    );
    this.name = "ForeignKeyConstraintError";
    this.entityType = entityType;
    this.foreignKey = foreignKey;
    this.targetId = targetId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the database is locked, unavailable, or cannot be accessed on the filesystem.
 */
export class DatabaseUnavailableError extends DatabaseError {
  readonly path: string;
  readonly reason: string;

  constructor(path: string, reason: string) {
    super(
      `Database at '${path}' is unavailable: ${reason}`,
      "DATABASE_UNAVAILABLE",
      { path, reason }
    );
    this.name = "DatabaseUnavailableError";
    this.path = path;
    this.reason = reason;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the applied database schema does not match current migration definitions.
 */
export class MigrationMismatchError extends DatabaseError {
  readonly expectedVersion: number;
  readonly actualVersion: number;
  readonly migrationName?: string;

  constructor(expectedVersion: number, actualVersion: number, migrationName?: string) {
    super(
      `Database migration mismatch: expected version ${expectedVersion}, but database is at version ${actualVersion}` +
        (migrationName ? ` (at migration '${migrationName}')` : ""),
      "MIGRATION_MISMATCH",
      { expectedVersion, actualVersion, migrationName }
    );
    this.name = "MigrationMismatchError";
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
    this.migrationName = migrationName;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an agent profile cannot be found in the registry.
 */
export class ProfileNotFoundError extends NotFoundError {
  constructor(idOrSlug: string, message?: string) {
    super("AgentProfile", idOrSlug);
    if (message) {
      this.message = message;
    }
    (this as any).code = "PROFILE_NOT_FOUND";
    this.name = "ProfileNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an agent registry operation fails.
 */
export class AgentRegistryError extends TerrariumError {
  readonly operation: string;

  constructor(operation: string, message: string, details?: Record<string, unknown>) {
    super(`Agent registry ${operation} failed: ${message}`, "AGENT_REGISTRY_ERROR", {
      operation,
      ...details,
    });
    this.name = "AgentRegistryError";
    this.operation = operation;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when delegation exceeds the configured maximum depth limit.
 */
export class DelegationDepthExceededError extends TerrariumError {
  readonly currentDepth: number;
  readonly maxDepth: number;

  constructor(currentDepth: number, maxDepth: number) {
    super(
      `Delegation depth limit exceeded: attempted depth ${currentDepth} exceeds maximum allowed depth of ${maxDepth}`,
      "DELEGATION_LIMIT_EXCEEDED",
      { currentDepth, maxDepth }
    );
    this.name = "DelegationDepthExceededError";
    this.currentDepth = currentDepth;
    this.maxDepth = maxDepth;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an requested tool is not registered in the ToolRegistry.
 */
export class ToolNotFoundError extends NotFoundError {
  constructor(toolId: string) {
    super("Tool", toolId);
    (this as any).code = "TOOL_NOT_FOUND";
    this.name = "ToolNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when tool invocation input or output does not conform to defined schemas.
 */
export class ToolValidationError extends DomainValidationError {
  readonly toolId: string;
  readonly direction: "input" | "output";

  constructor(toolId: string, direction: "input" | "output", issues: readonly ValidationIssue[]) {
    super(`Tool '${toolId}' ${direction} validation failed: ${issues.map((i) => i.message).join("; ")}`, issues);
    (this as any).code = "TOOL_VALIDATION_ERROR";
    this.name = "ToolValidationError";
    this.toolId = toolId;
    this.direction = direction;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a tool execution encounters a runtime failure.
 */
export class ToolExecutionError extends TerrariumError {
  readonly toolId: string;

  constructor(toolId: string, message: string, details?: Record<string, unknown>) {
    super(`Tool '${toolId}' execution failed: ${message}`, "TOOL_EXECUTION_ERROR", {
      toolId,
      ...details,
    });
    this.name = "ToolExecutionError";
    this.toolId = toolId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a tool invocation exceeds its configured execution timeout.
 */
export class ToolTimeoutError extends TimeoutError {
  readonly toolId: string;

  constructor(toolId: string, timeoutMs: number) {
    super(`Tool '${toolId}' exceeded timeout limit of ${timeoutMs}ms`, timeoutMs, `tool:${toolId}`);
    (this as any).code = "TOOL_TIMEOUT";
    this.name = "ToolTimeoutError";
    this.toolId = toolId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a consequential action requires human approval before proceeding.
 */
export class ApprovalRequiredError extends TerrariumError {
  readonly approvalId: string;
  readonly toolId: string;
  readonly actionType: string;

  constructor(approvalId: string, toolId: string, actionType: string, message?: string) {
    super(
      message ?? `Action '${actionType}' on tool '${toolId}' requires human approval (Approval ID: ${approvalId})`,
      "APPROVAL_REQUIRED",
      { approvalId, toolId, actionType }
    );
    this.name = "ApprovalRequiredError";
    this.approvalId = approvalId;
    this.toolId = toolId;
    this.actionType = actionType;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an action attempts to execute on a rejected approval request.
 * Retries or delegations cannot bypass rejected approvals.
 */
export class ApprovalRejectedError extends TerrariumError {
  readonly approvalId: string;
  readonly reason?: string;

  constructor(approvalId: string, reason?: string) {
    super(
      `Approval '${approvalId}' was rejected${reason ? `: ${reason}` : ""}. Execution blocked.`,
      "APPROVAL_REJECTED",
      { approvalId, reason }
    );
    this.name = "ApprovalRejectedError";
    this.approvalId = approvalId;
    this.reason = reason;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an action attempts to execute on an expired approval request.
 */
export class ApprovalExpiredError extends TerrariumError {
  readonly approvalId: string;

  constructor(approvalId: string) {
    super(`Approval '${approvalId}' has expired. Execution blocked.`, "APPROVAL_EXPIRED", { approvalId });
    this.name = "ApprovalExpiredError";
    this.approvalId = approvalId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an action attempts to execute on a cancelled approval request.
 */
export class ApprovalCancelledError extends TerrariumError {
  readonly approvalId: string;
  readonly reason?: string;

  constructor(approvalId: string, reason?: string) {
    super(
      `Approval '${approvalId}' was cancelled${reason ? `: ${reason}` : ""}. Execution blocked.`,
      "APPROVAL_CANCELLED",
      { approvalId, reason }
    );
    this.name = "ApprovalCancelledError";
    this.approvalId = approvalId;
    this.reason = reason;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an already-executed approval or idempotency key is submitted again (replay attack prevention).
 */
export class DuplicateExecutionError extends TerrariumError {
  readonly actionKey: string;

  constructor(actionKey: string, message?: string) {
    super(
      message ?? `Action '${actionKey}' has already been executed. Replay or duplicate execution blocked.`,
      "DUPLICATE_EXECUTION",
      { actionKey }
    );
    this.name = "DuplicateExecutionError";
    this.actionKey = actionKey;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Base error for memory and knowledge management domain failures.
 */
export class MemoryError extends TerrariumError {
  constructor(message: string, code: TerrariumErrorCode = "MEMORY_ERROR", details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = "MemoryError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a requested memory item cannot be found.
 */
export class MemoryNotFoundError extends NotFoundError {
  constructor(memoryId: string, projectId?: string) {
    super("MemoryItem", memoryId);
    this.message = `Memory item '${memoryId}' not found${projectId ? ` in project '${projectId}'` : ""}.`;
    this.name = "MemoryNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a new memory assertion directly conflicts with an existing durable memory item.
 * Prevents silent overwriting and mandates explicit reconciliation or disagreement preservation.
 */
export class MemoryConflictError extends MemoryError {
  readonly existingId: string;
  readonly incomingKey: string;
  readonly reason: string;

  constructor(existingId: string, incomingKey: string, reason: string) {
    super(
      `Memory conflict on key '${incomingKey}': conflicts with existing memory '${existingId}'. Reason: ${reason}`,
      "MEMORY_CONFLICT",
      { existingId, incomingKey, reason }
    );
    this.name = "MemoryConflictError";
    this.existingId = existingId;
    this.incomingKey = incomingKey;
    this.reason = reason;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an operation attempts to rely on unvalidated, expired, or stale memory.
 */
export class StaleMemoryError extends MemoryError {
  readonly memoryId: string;
  readonly ageDays: number;

  constructor(memoryId: string, ageDays: number, message?: string) {
    super(
      message ?? `Memory item '${memoryId}' is stale (${ageDays} days old) and requires revalidation before reliance.`,
      "STALE_MEMORY",
      { memoryId, ageDays }
    );
    this.name = "StaleMemoryError";
    this.memoryId = memoryId;
    this.ageDays = ageDays;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when assembled context package exceeds the agent's allocated context token budget.
 */
export class ContextBudgetExceededError extends MemoryError {
  readonly agentSlug: string;
  readonly tokenEstimate: number;
  readonly tokenLimit: number;

  constructor(agentSlug: string, tokenEstimate: number, tokenLimit: number) {
    super(
      `Context package for agent '${agentSlug}' estimated at ${tokenEstimate} tokens, exceeding budget limit of ${tokenLimit} tokens.`,
      "CONTEXT_BUDGET_EXCEEDED",
      { agentSlug, tokenEstimate, tokenLimit }
    );
    this.name = "ContextBudgetExceededError";
    this.agentSlug = agentSlug;
    this.tokenEstimate = tokenEstimate;
    this.tokenLimit = tokenLimit;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an attempt is made to access or inject another project's private memory into an agent context.
 * Strictly enforces PLAN.md Section 14 (Prevent one project's private context from leaking into another project).
 */
export class CrossProjectContextLeakError extends MemoryError {
  readonly targetProjectId: string;
  readonly attemptedProjectId: string;

  constructor(targetProjectId: string, attemptedProjectId: string) {
    super(
      `Cross-project context access violation: cannot access project '${attemptedProjectId}' memory from project '${targetProjectId}'.`,
      "CROSS_PROJECT_CONTEXT_LEAK",
      { targetProjectId, attemptedProjectId }
    );
    this.name = "CrossProjectContextLeakError";
    this.targetProjectId = targetProjectId;
    this.attemptedProjectId = attemptedProjectId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when active task or agent concurrency exceeds the allocated limit.
 */
export class ConcurrencyLimitExceededError extends BudgetExceededError {
  readonly activeConcurrency: number;
  readonly maxConcurrency: number;

  constructor(scope: string, activeConcurrency: number, maxConcurrency: number) {
    super(
      scope,
      activeConcurrency,
      maxConcurrency,
      "concurrency",
      `Concurrency limit exceeded for scope '${scope}': active ${activeConcurrency} exceeds limit of ${maxConcurrency}`
    );
    this.name = "ConcurrencyLimitExceededError";
    this.activeConcurrency = activeConcurrency;
    this.maxConcurrency = maxConcurrency;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when execution time exceeds the allocated duration budget.
 */
export class DurationLimitExceededError extends BudgetExceededError {
  readonly elapsedMs: number;
  readonly maxDurationMs: number;

  constructor(scope: string, elapsedMs: number, maxDurationMs: number) {
    super(
      scope,
      elapsedMs,
      maxDurationMs,
      "duration",
      `Duration limit exceeded for scope '${scope}': elapsed ${elapsedMs}ms exceeds limit of ${maxDurationMs}ms`
    );
    this.name = "DurationLimitExceededError";
    this.elapsedMs = elapsedMs;
    this.maxDurationMs = maxDurationMs;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when model routing fails to identify a suitable provider or model.
 */
export class ModelRoutingError extends TerrariumError {
  readonly criteria: Record<string, unknown>;

  constructor(message: string, criteria: Record<string, unknown>) {
    super(message, "MODEL_ROUTING_ERROR", { criteria });
    this.name = "ModelRoutingError";
    this.criteria = criteria;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an attempt to reserve budget fails because available funds/tokens are exhausted.
 */
export class ReservationExhaustedError extends BudgetExceededError {
  readonly requestedTokens: number;
  readonly availableTokens: number;

  constructor(scope: string, requestedTokens: number, availableTokens: number) {
    super(
      scope,
      requestedTokens,
      availableTokens,
      "tokens",
      `Budget reservation failed for scope '${scope}': requested ${requestedTokens} tokens but only ${availableTokens} remain available`
    );
    this.name = "ReservationExhaustedError";
    this.requestedTokens = requestedTokens;
    this.availableTokens = availableTokens;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a telemetry subsystem error occurs.
 */
export class TelemetryError extends TerrariumError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TELEMETRY_ERROR", details);
    this.name = "TelemetryError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown in strict mode when sensitive credentials, API keys, or private tokens are detected.
 */
export class SecretLeakDetectedError extends TerrariumError {
  readonly secretType: string;

  constructor(secretType: string, path?: string) {
    super(
      `Potential secret leakage detected (${secretType}) in telemetry payload${path ? ` at '${path}'` : ""}. Redaction required.`,
      "SECRET_LEAK_DETECTED",
      { secretType, path }
    );
    this.name = "SecretLeakDetectedError";
    this.secretType = secretType;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}




