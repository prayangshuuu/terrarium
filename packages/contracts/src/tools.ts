/**
 * @terrarium/contracts - tools.ts
 *
 * Tool metadata, schemas, risk classification, permissions, timeout specifications,
 * side-effect classes, and invocation interfaces.
 * Aligns strictly with PLAN.md Section 17 & 18 and Prompt 10 instructions.
 */

import { type Result, ok, fail } from "./base.ts";
import {
  DomainValidationError,
  ToolValidationError,
  type TerrariumError,
  type ValidationIssue,
} from "./errors.ts";
import { type ApprovalRequest } from "./approvals.ts";
import {
  isRecord,
  validateArray,
  validateBoolean,
  validateEnum,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

/**
 * Tool Risk Levels ordered by severity.
 */
export const TOOL_RISK_LEVELS = ["read_only", "low", "medium", "high", "critical"] as const;
export type ToolRiskLevel = (typeof TOOL_RISK_LEVELS)[number];

export const TOOL_RISK_SEVERITY: Readonly<Record<ToolRiskLevel, number>> = {
  read_only: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Side-effect classification for tools.
 */
export const TOOL_SIDE_EFFECT_CLASSES = [
  "none",
  "idempotent",
  "state_mutating",
  "consequential",
] as const;
export type ToolSideEffectClass = (typeof TOOL_SIDE_EFFECT_CLASSES)[number];

/**
 * Canonical tool permissions. Custom strings are also permitted for extensibility.
 */
export const TOOL_PERMISSIONS = [
  "file:read",
  "file:write",
  "file:delete",
  "shell:execute",
  "git:read",
  "git:write",
  "git:push",
  "publish:external",
  "deploy:production",
  "payment:execute",
  "message:send",
] as const;
export type CanonicalToolPermission = (typeof TOOL_PERMISSIONS)[number];
export type ToolPermission = CanonicalToolPermission | string;

/**
 * Property schema definition for tool input/output validation.
 */
export interface ToolSchemaProperty {
  readonly type: "string" | "number" | "boolean" | "array" | "object";
  readonly description?: string;
  readonly required?: boolean;
  readonly enum?: readonly (string | number | boolean)[];
  readonly default?: unknown;
  readonly items?: ToolSchemaProperty;
  readonly properties?: Readonly<Record<string, ToolSchemaProperty>>;
}

/**
 * Root object schema for tool inputs and outputs.
 */
export interface ToolJsonSchema {
  readonly type: "object";
  readonly description?: string;
  readonly properties: Readonly<Record<string, ToolSchemaProperty>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

/**
 * Runtime execution context provided to every tool invocation.
 * Carries caller identity, task scope, granted permissions, and security constraints.
 */
export interface ToolExecutionContext {
  readonly agentId: string;
  readonly taskId: string;
  readonly stepId?: string;
  readonly executionId?: string;
  readonly grantedPermissions: readonly string[];
  readonly disallowedTools?: readonly string[];
  readonly approvalId?: string;
  readonly signal?: AbortSignal;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Dynamic condition function evaluated at runtime to determine risk or approval requirement.
 */
export type ToolPredicate<TInput = Record<string, unknown>> = (
  input: TInput,
  context: ToolExecutionContext
) => boolean | Promise<boolean>;

/**
 * Comprehensive Tool Definition registered in the ToolRegistry.
 */
export interface ToolDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly version: string;
  readonly riskLevel: ToolRiskLevel;
  readonly sideEffectClass: ToolSideEffectClass;
  readonly requiredPermissions: readonly string[];
  readonly inputSchema: ToolJsonSchema;
  readonly outputSchema?: ToolJsonSchema;
  readonly defaultTimeoutMs: number;
  readonly maxTimeoutMs: number;
  readonly requiresApproval: boolean | ToolPredicate<TInput>;
  readonly isConsequential: boolean | ToolPredicate<TInput>;
  readonly execute: (
    input: TInput,
    context: ToolExecutionContext
  ) => Promise<Result<TOutput, TerrariumError>>;
}

/**
 * Request payload to invoke a registered tool.
 */
export interface ToolInvocationRequest<TInput = Record<string, unknown>> {
  readonly toolId: string;
  readonly input: TInput;
  readonly context: ToolExecutionContext;
  readonly idempotencyKey?: string;
}

/**
 * Result payload returned from tool invocation.
 */
export interface ToolInvocationResult<TOutput = unknown> {
  readonly toolId: string;
  readonly success: boolean;
  readonly output?: TOutput;
  readonly error?: TerrariumError;
  readonly durationMs: number;
  readonly approvalRequired?: boolean;
  readonly approvalRequest?: ApprovalRequest;
  readonly idempotencyKey?: string;
}

/**
 * Filter criteria for discovering registered tools.
 */
export interface ToolFilter {
  readonly category?: string;
  readonly riskLevel?: ToolRiskLevel;
  readonly permission?: string;
  readonly requiresApproval?: boolean;
  readonly search?: string;
}

/**
 * Abstract Tool Registry interface.
 */
export interface ToolRegistry {
  register(tool: ToolDefinition<any, any>): void;
  unregister(toolId: string): boolean;
  get(toolId: string): ToolDefinition | undefined;
  has(toolId: string): boolean;
  list(filter?: ToolFilter): readonly ToolDefinition[];
  invoke<TInput = Record<string, unknown>, TOutput = unknown>(
    request: ToolInvocationRequest<TInput>
  ): Promise<Result<ToolInvocationResult<TOutput>, TerrariumError>>;
}

// ============================================================================
// Schema Validation Helpers
// ============================================================================

const SCHEMA_PROPERTY_TYPES = ["string", "number", "boolean", "array", "object"] as const;

export function validateToolSchemaProperty(
  value: unknown,
  path: string
): Result<ToolSchemaProperty, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for schema property at ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const type = collector.check(validateEnum(value.type, `${path}.type`, SCHEMA_PROPERTY_TYPES));
  const description =
    value.description !== undefined
      ? collector.check(validateString(value.description, `${path}.description`, { minLength: 1, maxLength: 500 }))
      : undefined;
  const required =
    value.required !== undefined
      ? collector.check(validateBoolean(value.required, `${path}.required`))
      : undefined;

  let items: ToolSchemaProperty | undefined;
  if (value.items !== undefined) {
    const itemsRes = validateToolSchemaProperty(value.items, `${path}.items`);
    if (itemsRes.success) {
      items = itemsRes.data;
    } else {
      for (const issue of itemsRes.error.issues) {
        collector.addIssue(issue);
      }
    }
  }

  let properties: Record<string, ToolSchemaProperty> | undefined;
  if (value.properties !== undefined) {
    if (!isRecord(value.properties)) {
      collector.addIssue({
        path: `${path}.properties`,
        message: "Expected record for nested properties",
        received: value.properties,
      });
    } else {
      properties = {};
      for (const [key, propVal] of Object.entries(value.properties)) {
        const propRes = validateToolSchemaProperty(propVal, `${path}.properties.${key}`);
        if (propRes.success) {
          properties[key] = propRes.data;
        } else {
          for (const issue of propRes.error.issues) {
            collector.addIssue(issue);
          }
        }
      }
    }
  }

  if (collector.hasIssues() || type === undefined) {
    return fail(collector.toError(`Tool schema property validation failed at ${path}`));
  }

  return ok({
    type,
    description,
    required,
    enum: Array.isArray(value.enum) ? value.enum : undefined,
    default: value.default,
    items,
    properties,
  });
}

export function validateToolJsonSchema(
  value: unknown,
  path = "schema"
): Result<ToolJsonSchema, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for tool schema at ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const type = collector.check(validateEnum(value.type, `${path}.type`, ["object"] as const));
  const description =
    value.description !== undefined
      ? collector.check(validateString(value.description, `${path}.description`, { minLength: 1, maxLength: 500 }))
      : undefined;

  if (!isRecord(value.properties)) {
    collector.addIssue({
      path: `${path}.properties`,
      message: "Expected object for properties map",
      received: value.properties,
    });
  }

  const properties: Record<string, ToolSchemaProperty> = {};
  if (isRecord(value.properties)) {
    for (const [key, propVal] of Object.entries(value.properties)) {
      const propRes = validateToolSchemaProperty(propVal, `${path}.properties.${key}`);
      if (propRes.success) {
        properties[key] = propRes.data;
      } else {
        for (const issue of propRes.error.issues) {
          collector.addIssue(issue);
        }
      }
    }
  }

  const required =
    value.required !== undefined
      ? collector.check(validateArray(value.required, `${path}.required`, (item, itemPath) =>
          validateString(item, itemPath, { minLength: 1, maxLength: 100 })
        ))
      : undefined;

  const additionalProperties =
    value.additionalProperties !== undefined
      ? collector.check(validateBoolean(value.additionalProperties, `${path}.additionalProperties`))
      : undefined;

  if (collector.hasIssues() || type === undefined) {
    return fail(collector.toError(`ToolJsonSchema validation failed at ${path}`));
  }

  return ok({
    type: "object",
    description,
    properties,
    required,
    additionalProperties,
  });
}

function validateSingleValue(
  propSchema: ToolSchemaProperty,
  val: unknown,
  path: string,
  issues: ValidationIssue[]
): void {
  if (val === undefined || val === null) {
    if (propSchema.required) {
      issues.push({ path, message: `Field '${path}' is required`, received: val });
    }
    return;
  }

  if (propSchema.enum && propSchema.enum.length > 0) {
    if (!propSchema.enum.includes(val as any)) {
      issues.push({
        path,
        message: `Value must be one of [${propSchema.enum.join(", ")}]`,
        received: val,
      });
      return;
    }
  }

  switch (propSchema.type) {
    case "string":
      if (typeof val !== "string") {
        issues.push({ path, message: `Expected string, received ${typeof val}`, received: val });
      }
      break;
    case "number":
      if (typeof val !== "number" || Number.isNaN(val)) {
        issues.push({ path, message: `Expected number, received ${typeof val}`, received: val });
      }
      break;
    case "boolean":
      if (typeof val !== "boolean") {
        issues.push({ path, message: `Expected boolean, received ${typeof val}`, received: val });
      }
      break;
    case "array":
      if (!Array.isArray(val)) {
        issues.push({ path, message: `Expected array, received ${typeof val}`, received: val });
      } else if (propSchema.items) {
        for (let i = 0; i < val.length; i++) {
          validateSingleValue(propSchema.items, val[i], `${path}[${i}]`, issues);
        }
      }
      break;
    case "object":
      if (!isRecord(val)) {
        issues.push({ path, message: `Expected object, received ${typeof val}`, received: val });
      } else if (propSchema.properties) {
        for (const [subKey, subSchema] of Object.entries(propSchema.properties)) {
          validateSingleValue(subSchema, (val as Record<string, unknown>)[subKey], `${path}.${subKey}`, issues);
        }
      }
      break;
  }
}

/**
 * Validates input parameters against a tool's input schema.
 */
export function validateToolInput<T = Record<string, unknown>>(
  toolId: string,
  schema: ToolJsonSchema,
  input: unknown
): Result<T, ToolValidationError> {
  if (!isRecord(input)) {
    return fail(
      new ToolValidationError(toolId, "input", [
        { path: "input", message: "Expected object for tool input parameters", received: input },
      ])
    );
  }

  const issues: ValidationIssue[] = [];

  // Check required fields from schema.required
  if (schema.required) {
    for (const reqKey of schema.required) {
      if ((input as Record<string, unknown>)[reqKey] === undefined) {
        issues.push({
          path: reqKey,
          message: `Required parameter '${reqKey}' is missing`,
          received: undefined,
        });
      }
    }
  }

  // Validate each schema property
  const resultObj: Record<string, unknown> = { ...input };

  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    let val = (input as Record<string, unknown>)[propName];

    // Apply default if undefined
    if (val === undefined && propSchema.default !== undefined) {
      val = propSchema.default;
      resultObj[propName] = val;
    }

    validateSingleValue(propSchema, val, propName, issues);
  }

  // Reject additional properties if disallowed
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(input)) {
      if (!(key in schema.properties)) {
        issues.push({
          path: key,
          message: `Unrecognized property '${key}' is not allowed`,
          received: (input as Record<string, unknown>)[key],
        });
      }
    }
  }

  if (issues.length > 0) {
    return fail(new ToolValidationError(toolId, "input", issues));
  }

  return ok(resultObj as unknown as T);
}

/**
 * Validates output result against a tool's output schema.
 */
export function validateToolOutput<T = unknown>(
  toolId: string,
  schema: ToolJsonSchema | undefined,
  output: unknown
): Result<T, ToolValidationError> {
  if (!schema) {
    return ok(output as T);
  }

  if (!isRecord(output)) {
    return fail(
      new ToolValidationError(toolId, "output", [
        { path: "output", message: "Expected object for tool output", received: output },
      ])
    );
  }

  const issues: ValidationIssue[] = [];

  if (schema.required) {
    for (const reqKey of schema.required) {
      if ((output as Record<string, unknown>)[reqKey] === undefined) {
        issues.push({
          path: reqKey,
          message: `Required output parameter '${reqKey}' is missing`,
          received: undefined,
        });
      }
    }
  }

  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    const val = (output as Record<string, unknown>)[propName];
    validateSingleValue(propSchema, val, propName, issues);
  }

  if (issues.length > 0) {
    return fail(new ToolValidationError(toolId, "output", issues));
  }

  return ok(output as T);
}

/**
 * Validates a ToolDefinition object for registry insertion.
 */
export function validateToolDefinition(
  value: unknown,
  path = "tool"
): Result<ToolDefinition, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for tool definition at ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const name = collector.check(validateString(value.name, `${path}.name`, { minLength: 1, maxLength: 100 }));
  const description = collector.check(
    validateString(value.description, `${path}.description`, { minLength: 1, maxLength: 1000 })
  );
  const category = collector.check(
    validateString(value.category, `${path}.category`, { minLength: 1, maxLength: 50 })
  );
  const version = collector.check(
    validateString(value.version, `${path}.version`, { minLength: 1, maxLength: 20 })
  );
  const riskLevel = collector.check(
    validateEnum(value.riskLevel, `${path}.riskLevel`, TOOL_RISK_LEVELS)
  );
  const sideEffectClass = collector.check(
    validateEnum(value.sideEffectClass, `${path}.sideEffectClass`, TOOL_SIDE_EFFECT_CLASSES)
  );
  const requiredPermissions = collector.check(
    validateArray(value.requiredPermissions, `${path}.requiredPermissions`, (perm, permPath) =>
      validateString(perm, permPath, { minLength: 1, maxLength: 100 })
    )
  );

  const defaultTimeoutMs = collector.check(
    validateNumber(value.defaultTimeoutMs, `${path}.defaultTimeoutMs`, { min: 100, max: 600000 })
  );
  const maxTimeoutMs = collector.check(
    validateNumber(value.maxTimeoutMs, `${path}.maxTimeoutMs`, { min: 100, max: 600000 })
  );

  const inputSchemaRes = validateToolJsonSchema(value.inputSchema, `${path}.inputSchema`);
  if (!inputSchemaRes.success) {
    for (const issue of inputSchemaRes.error.issues) {
      collector.addIssue(issue);
    }
  }

  let outputSchema: ToolJsonSchema | undefined;
  if (value.outputSchema !== undefined) {
    const outputSchemaRes = validateToolJsonSchema(value.outputSchema, `${path}.outputSchema`);
    if (outputSchemaRes.success) {
      outputSchema = outputSchemaRes.data;
    } else {
      for (const issue of outputSchemaRes.error.issues) {
        collector.addIssue(issue);
      }
    }
  }

  if (typeof value.execute !== "function") {
    collector.addIssue({
      path: `${path}.execute`,
      message: "Expected execute function",
      received: typeof value.execute,
    });
  }

  if (
    collector.hasIssues() ||
    id === undefined ||
    name === undefined ||
    description === undefined ||
    category === undefined ||
    version === undefined ||
    riskLevel === undefined ||
    sideEffectClass === undefined ||
    requiredPermissions === undefined ||
    defaultTimeoutMs === undefined ||
    maxTimeoutMs === undefined ||
    !inputSchemaRes.success
  ) {
    return fail(collector.toError(`ToolDefinition validation failed for ${path}`));
  }

  return ok({
    id,
    name,
    description,
    category,
    version,
    riskLevel,
    sideEffectClass,
    requiredPermissions,
    inputSchema: inputSchemaRes.data,
    outputSchema,
    defaultTimeoutMs,
    maxTimeoutMs,
    requiresApproval: value.requiresApproval as boolean | ToolPredicate,
    isConsequential: value.isConsequential as boolean | ToolPredicate,
    execute: value.execute as any,
  });
}
