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
  | "PERMISSION_DENIED"
  | "BUDGET_EXCEEDED"
  | "PROVIDER_ERROR"
  | "DELEGATION_LIMIT_EXCEEDED"
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
    statusCode?: number
  ) {
    super(message, "PROVIDER_ERROR", { provider, model, isRetryable, statusCode });
    this.name = "ProviderError";
    this.provider = provider;
    this.model = model;
    this.isRetryable = isRetryable;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
