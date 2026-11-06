/**
 * @terrarium/contracts - validation-helpers.ts
 *
 * Lightweight, zero-dependency validation helpers and schema narrowing primitives.
 * Keeps contracts independent of heavy third-party libraries while guaranteeing type safety.
 */

import { DomainValidationError, type ValidationIssue } from "./errors.ts";
import { type Result, ok, fail } from "./base.ts";

export type ValidationRule<T> = (value: unknown, path: string) => Result<T, ValidationIssue>;

/**
 * Checks if a value is a non-null object record.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates that an unknown value is a non-empty string.
 */
export function validateString(
  value: unknown,
  path: string,
  options: { minLength?: number; maxLength?: number; pattern?: RegExp } = {}
): Result<string, ValidationIssue> {
  if (typeof value !== "string") {
    return fail({
      path,
      message: `Expected string, received ${typeof value}`,
      received: value,
    });
  }

  const { minLength = 1, maxLength = 10000, pattern } = options;
  if (value.length < minLength) {
    return fail({
      path,
      message: `String length must be at least ${minLength} characters (received ${value.length})`,
      received: value,
    });
  }

  if (value.length > maxLength) {
    return fail({
      path,
      message: `String length must be at most ${maxLength} characters (received ${value.length})`,
      received: value,
    });
  }

  if (pattern && !pattern.test(value)) {
    return fail({
      path,
      message: `String does not match required pattern ${pattern.toString()}`,
      received: value,
    });
  }

  return ok(value);
}

/**
 * Validates an ISO-8601 formatted date-time string.
 */
export function validateIsoDateTime(value: unknown, path: string): Result<string, ValidationIssue> {
  const strRes = validateString(value, path, { minLength: 10, maxLength: 40 });
  if (!strRes.success) {
    return strRes;
  }

  const parsed = Date.parse(strRes.data);
  if (isNaN(parsed)) {
    return fail({
      path,
      message: `Expected valid ISO-8601 date-time string, received '${strRes.data}'`,
      received: value,
    });
  }

  return ok(strRes.data);
}

/**
 * Validates a number within specified bounds.
 */
export function validateNumber(
  value: unknown,
  path: string,
  options: { min?: number; max?: number; integer?: boolean } = {}
): Result<number, ValidationIssue> {
  if (typeof value !== "number" || isNaN(value)) {
    return fail({
      path,
      message: `Expected number, received ${typeof value}`,
      received: value,
    });
  }

  const { min, max, integer } = options;
  if (integer && !Number.isInteger(value)) {
    return fail({
      path,
      message: `Expected integer number, received ${value}`,
      received: value,
    });
  }

  if (min !== undefined && value < min) {
    return fail({
      path,
      message: `Number must be >= ${min} (received ${value})`,
      received: value,
    });
  }

  if (max !== undefined && value > max) {
    return fail({
      path,
      message: `Number must be <= ${max} (received ${value})`,
      received: value,
    });
  }

  return ok(value);
}

/**
 * Validates a boolean value.
 */
export function validateBoolean(value: unknown, path: string): Result<boolean, ValidationIssue> {
  if (typeof value !== "boolean") {
    return fail({
      path,
      message: `Expected boolean, received ${typeof value}`,
      received: value,
    });
  }
  return ok(value);
}

/**
 * Validates that a string is one of allowed enum literals.
 */
export function validateEnum<T extends string>(
  value: unknown,
  path: string,
  allowedValues: readonly T[]
): Result<T, ValidationIssue> {
  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    return fail({
      path,
      message: `Expected one of [${allowedValues.join(", ")}], received ${JSON.stringify(value)}`,
      received: value,
    });
  }
  return ok(value as T);
}

/**
 * Validates that a value is an array and each element satisfies the item validator.
 */
export function validateArray<T>(
  value: unknown,
  path: string,
  itemValidator: (item: unknown, itemPath: string) => Result<T, ValidationIssue>,
  options: { minItems?: number; maxItems?: number } = {}
): Result<readonly T[], ValidationIssue[]> {
  if (!Array.isArray(value)) {
    return fail([
      {
        path,
        message: `Expected array, received ${typeof value}`,
        received: value,
      },
    ]);
  }

  const { minItems = 0, maxItems = 1000 } = options;
  if (value.length < minItems) {
    return fail([
      {
        path,
        message: `Array must contain at least ${minItems} items (received ${value.length})`,
        received: value,
      },
    ]);
  }

  if (value.length > maxItems) {
    return fail([
      {
        path,
        message: `Array must contain at most ${maxItems} items (received ${value.length})`,
        received: value,
      },
    ]);
  }

  const items: T[] = [];
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < value.length; i++) {
    const res = itemValidator(value[i], `${path}[${i}]`);
    if (res.success) {
      items.push(res.data);
    } else {
      issues.push(res.error);
    }
  }

  if (issues.length > 0) {
    return fail(issues);
  }

  return ok(items);
}

/**
 * Helper to collect validation issues and narrow fields cleanly.
 */
export class ValidationCollector {
  readonly issues: ValidationIssue[] = [];

  check<T>(result: Result<T, ValidationIssue | readonly ValidationIssue[] | ValidationIssue[]>): T | undefined {
    if (result.success) {
      return result.data;
    }
    if (Array.isArray(result.error)) {
      this.issues.push(...result.error);
    } else {
      this.issues.push(result.error as ValidationIssue);
    }
    return undefined;
  }

  addIssue(issue: ValidationIssue): void {
    this.issues.push(issue);
  }

  hasIssues(): boolean {
    return this.issues.length > 0;
  }

  toError(message = "Validation failed"): DomainValidationError {
    return new DomainValidationError(message, this.issues);
  }
}

/**
 * Combines an array of validation issues into a single DomainValidationError result.
 */
export function createValidationResult<T>(
  data: T,
  issues: readonly ValidationIssue[]
): Result<T, DomainValidationError> {
  if (issues.length > 0) {
    return fail(new DomainValidationError(`Validation failed with ${issues.length} issue(s)`, issues));
  }
  return ok(data);
}
