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
  readonly unit: "tokens" | "usd";

  constructor(scope: string, current: number, limit: number, unit: "tokens" | "usd") {
    const formattedCurrent = unit === "usd" ? `$${current.toFixed(2)}` : `${current} tokens`;
    const formattedLimit = unit === "usd" ? `$${limit.toFixed(2)}` : `${limit} tokens`;
    super(
      `Budget exceeded for scope '${scope}': consumed ${formattedCurrent} of ${formattedLimit} limit`,
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


