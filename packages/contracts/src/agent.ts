/**
 * @terrarium/contracts - agent.ts
 *
 * Agent profile, capability catalog, limits, constraints, and validation contracts.
 * Aligns with PLAN.md Section 4 (Organization and Agent Model).
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError, type ValidationIssue, type TerrariumError, type NotFoundError } from "./errors.ts";
import { AGENT_DEPARTMENTS, type AgentDepartment } from "./departments.ts";
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

export type AgentProfileStatus = "available" | "busy" | "disabled" | "deprecated";
export const AGENT_PROFILE_STATUSES = ["available", "busy", "disabled", "deprecated"] as const;

export type ModelTier = "fast" | "standard" | "advanced";
export const MODEL_TIERS = ["fast", "standard", "advanced"] as const;

/**
 * Declared capability of an agent.
 */
export interface AgentCapability {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly department: AgentDepartment;
  readonly requiredPermissions: readonly string[];
  readonly isConsequential: boolean;
  readonly category?: string;
  readonly keywords?: readonly string[];
}

/**
 * Model selection preferences for this agent.
 */
export interface ModelPreference {
  readonly tier: ModelTier;
  readonly preferredProvider?: string;
  readonly preferredModel?: string;
  readonly fallbackModel?: string;
  readonly temperature?: number;
}

/**
 * Execution and delegation limits assigned to an agent profile (backward-compatible).
 */
export interface AgentLimits {
  readonly maxTokensPerTurn: number;
  readonly maxDelegationDepth: number;
  readonly maxChildrenTasks: number;
}

/**
 * Comprehensive operational constraints assigned to an agent profile.
 */
export interface AgentConstraints {
  readonly maxTokensPerTurn: number;
  readonly maxDelegationDepth: number;
  readonly maxChildrenTasks: number;
  readonly timeoutMs?: number;
  readonly disallowedTools?: readonly string[];
  readonly requiresApprovalForConsequential?: boolean;
}

/**
 * Simulated persona attributes for Customer Intelligence department profiles.
 */
export interface PersonaAttributes {
  readonly occupation: string;
  readonly technicalFamiliarity: "novice" | "intermediate" | "advanced";
  readonly priceSensitivity: "low" | "medium" | "high";
  readonly buyingCriteria: readonly string[];
  readonly adoptionBarriers: readonly string[];
}

/**
 * Core Agent Profile entity.
 * Represents a registered role in the virtual organization.
 * Pure data representation, completely separate from active execution instances.
 */
export interface AgentProfile extends BaseEntity {
  readonly slug: string;
  readonly name: string;
  readonly displayName: string;
  readonly department: AgentDepartment;
  readonly role: string;
  readonly description: string;
  readonly systemPromptTemplate: string;
  readonly capabilities: readonly AgentCapability[];
  readonly supportedTasks: readonly string[];
  readonly constraints: AgentConstraints;
  readonly limits: AgentLimits;
  readonly modelPreference: ModelPreference;
  readonly permissions: readonly string[];
  readonly version: string;
  readonly status: AgentProfileStatus;
  readonly tags: readonly string[];
  readonly personaAttributes?: PersonaAttributes;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Filter criteria for listing agent profiles.
 */
export interface AgentProfileFilter {
  readonly department?: AgentDepartment;
  readonly status?: AgentProfileStatus;
  readonly tag?: string;
  readonly modelTier?: ModelTier;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Search query criteria for finding agent profiles.
 */
export interface AgentSearchQuery {
  readonly query: string;
  readonly department?: AgentDepartment;
  readonly status?: AgentProfileStatus;
  readonly limit?: number;
}

/**
 * Criteria for resolving matching agent candidates for a task.
 */
export interface AgentResolveCriteria {
  readonly taskType?: string;
  readonly department?: AgentDepartment;
  readonly requiredCapabilities?: readonly string[];
  readonly requiredPermissions?: readonly string[];
  readonly status?: AgentProfileStatus;
  readonly preferFastTier?: boolean;
  readonly tags?: readonly string[];
  readonly includeDisabled?: boolean;
}

/**
 * Scored agent match result from candidate resolution.
 */
export interface AgentMatchScore {
  readonly profile: AgentProfile;
  readonly score: number;
  readonly matchedCapabilities: readonly string[];
  readonly matchedTasks: readonly string[];
  readonly reasons: readonly string[];
}

/**
 * Input structure for registering or updating an agent profile.
 */
export interface AgentProfileInput {
  readonly id?: string;
  readonly slug: string;
  readonly name: string;
  readonly displayName?: string;
  readonly department: AgentDepartment;
  readonly role: string;
  readonly description: string;
  readonly systemPromptTemplate: string;
  readonly capabilities?: readonly AgentCapability[];
  readonly supportedTasks?: readonly string[];
  readonly constraints?: Partial<AgentConstraints>;
  readonly limits?: Partial<AgentLimits>;
  readonly modelPreference?: Partial<ModelPreference>;
  readonly permissions?: readonly string[];
  readonly version?: string;
  readonly status?: AgentProfileStatus;
  readonly tags?: readonly string[];
  readonly personaAttributes?: PersonaAttributes;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

/**
 * Registry interface for agent profile operations.
 * Operations are strictly metadata-driven and never invoke model providers or start sessions.
 */
export interface AgentRegistry {
  register(profile: AgentProfileInput): Promise<Result<AgentProfile, TerrariumError>>;
  list(filter?: AgentProfileFilter): Promise<Result<readonly AgentProfile[], TerrariumError>>;
  search(query: AgentSearchQuery): Promise<Result<readonly AgentProfile[], TerrariumError>>;
  inspect(idOrSlug: string): Promise<Result<AgentProfile, NotFoundError | TerrariumError>>;
  enable(idOrSlug: string): Promise<Result<AgentProfile, NotFoundError | TerrariumError>>;
  disable(idOrSlug: string, reason?: string): Promise<Result<AgentProfile, NotFoundError | TerrariumError>>;
  validate(profile: unknown): Result<AgentProfile, DomainValidationError>;
  resolve(criteria: AgentResolveCriteria): Promise<Result<readonly AgentProfile[], TerrariumError>>;
  count(department?: AgentDepartment): Promise<number>;
}

/**
 * Validates an agent capability object.
 */
export function validateAgentCapability(
  value: unknown,
  path = "capability"
): Result<AgentCapability, ValidationIssue[]> {
  if (!isRecord(value)) {
    return fail([{ path, message: "Expected object for AgentCapability", received: value }]);
  }

  const collector = new ValidationCollector();
  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const name = collector.check(validateString(value.name, `${path}.name`, { minLength: 1, maxLength: 100 }));
  const description = collector.check(validateString(value.description, `${path}.description`, { minLength: 1, maxLength: 1000 }));
  const department = collector.check(validateEnum(value.department, `${path}.department`, AGENT_DEPARTMENTS));
  const isConsequential = collector.check(validateBoolean(value.isConsequential, `${path}.isConsequential`));
  const perms = collector.check(
    validateArray(
      value.requiredPermissions ?? [],
      `${path}.requiredPermissions`,
      (p, pPath) => validateString(p, pPath, { minLength: 1, maxLength: 100 })
    )
  );

  let category: string | undefined;
  if (value.category !== undefined) {
    category = collector.check(validateString(value.category, `${path}.category`, { minLength: 1, maxLength: 100 }));
  }

  let keywords: readonly string[] | undefined;
  if (value.keywords !== undefined) {
    keywords = collector.check(
      validateArray(value.keywords, `${path}.keywords`, (k, kPath) =>
        validateString(k, kPath, { minLength: 1, maxLength: 50 })
      )
    );
  }

  if (
    collector.hasIssues() ||
    id === undefined ||
    name === undefined ||
    description === undefined ||
    department === undefined ||
    isConsequential === undefined
  ) {
    return fail(collector.issues);
  }

  return ok({
    id,
    name,
    description,
    department,
    requiredPermissions: perms ?? [],
    isConsequential,
    category,
    keywords,
  });
}

/**
 * Validates agent constraints or limits.
 */
export function validateAgentConstraints(
  value: unknown,
  path = "constraints"
): Result<AgentConstraints, ValidationIssue[]> {
  if (!isRecord(value)) {
    return fail([{ path, message: `Expected object for ${path}`, received: value }]);
  }

  const collector = new ValidationCollector();
  const maxTokens = collector.check(
    validateNumber(value.maxTokensPerTurn, `${path}.maxTokensPerTurn`, {
      min: 100,
      max: 1000000,
      integer: true,
    })
  );
  const maxDepth = collector.check(
    validateNumber(value.maxDelegationDepth, `${path}.maxDelegationDepth`, {
      min: 0,
      max: 10,
      integer: true,
    })
  );
  const maxChildren = collector.check(
    validateNumber(value.maxChildrenTasks, `${path}.maxChildrenTasks`, {
      min: 0,
      max: 50,
      integer: true,
    })
  );

  let timeoutMs: number | undefined;
  if (value.timeoutMs !== undefined) {
    timeoutMs = collector.check(
      validateNumber(value.timeoutMs, `${path}.timeoutMs`, { min: 1000, max: 3600000, integer: true })
    );
  }

  let disallowedTools: readonly string[] | undefined;
  if (value.disallowedTools !== undefined) {
    disallowedTools = collector.check(
      validateArray(value.disallowedTools, `${path}.disallowedTools`, (t, tPath) =>
        validateString(t, tPath, { minLength: 1, maxLength: 100 })
      )
    );
  }

  let requiresApprovalForConsequential: boolean | undefined;
  if (value.requiresApprovalForConsequential !== undefined) {
    requiresApprovalForConsequential = collector.check(
      validateBoolean(value.requiresApprovalForConsequential, `${path}.requiresApprovalForConsequential`)
    );
  }

  if (collector.hasIssues() || maxTokens === undefined || maxDepth === undefined || maxChildren === undefined) {
    return fail(collector.issues);
  }

  return ok({
    maxTokensPerTurn: maxTokens,
    maxDelegationDepth: maxDepth,
    maxChildrenTasks: maxChildren,
    timeoutMs,
    disallowedTools,
    requiresApprovalForConsequential,
  });
}

/**
 * Validates a complete AgentProfile boundary input.
 */
export function validateAgentProfile(
  value: unknown,
  path = "agentProfile"
): Result<AgentProfile, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const slug = collector.check(
    validateString(value.slug, `${path}.slug`, {
      minLength: 1,
      maxLength: 100,
      pattern: /^[a-z0-9-]+$/,
    })
  );
  const name = collector.check(validateString(value.name, `${path}.name`, { minLength: 1, maxLength: 100 }));
  const displayName = collector.check(
    validateString(value.displayName, `${path}.displayName`, { minLength: 1, maxLength: 100 })
  );
  const department = collector.check(validateEnum(value.department, `${path}.department`, AGENT_DEPARTMENTS));
  const role = collector.check(validateString(value.role, `${path}.role`, { minLength: 1, maxLength: 100 }));
  const description = collector.check(
    validateString(value.description, `${path}.description`, { minLength: 1, maxLength: 2000 })
  );
  const systemPromptTemplate = collector.check(
    validateString(value.systemPromptTemplate, `${path}.systemPromptTemplate`, { minLength: 1, maxLength: 50000 })
  );
  const status = collector.check(validateEnum(value.status, `${path}.status`, AGENT_PROFILE_STATUSES));
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));

  // Version: default to 1.0.0 if not provided
  let version = "1.0.0";
  if (value.version !== undefined) {
    const vRes = validateString(value.version, `${path}.version`, { minLength: 1, maxLength: 50 });
    if (vRes.success) {
      version = vRes.data;
    } else {
      collector.addIssue(vRes.error);
    }
  }

  // Supported tasks: default to empty array
  let supportedTasks: readonly string[] = [];
  if (value.supportedTasks !== undefined) {
    const stRes = validateArray(value.supportedTasks, `${path}.supportedTasks`, (st, stPath) =>
      validateString(st, stPath, { minLength: 1, maxLength: 100 })
    );
    if (stRes.success) {
      supportedTasks = stRes.data;
    } else {
      stRes.error.forEach((issue) => collector.addIssue(issue));
    }
  }

  // Permissions: default to empty array
  let permissions: readonly string[] = [];
  if (value.permissions !== undefined) {
    const pRes = validateArray(value.permissions, `${path}.permissions`, (p, pPath) =>
      validateString(p, pPath, { minLength: 1, maxLength: 100 })
    );
    if (pRes.success) {
      permissions = pRes.data;
    } else {
      pRes.error.forEach((issue) => collector.addIssue(issue));
    }
  }

  // Validate capabilities
  const capabilities = collector.check(
    validateArray<AgentCapability>(value.capabilities ?? [], `${path}.capabilities`, (c, cPath) => {
      const itemRes = validateAgentCapability(c, cPath);
      if (!itemRes.success) return fail(itemRes.error[0] ?? { path: cPath, message: "Invalid capability" });
      return ok(itemRes.data);
    })
  );

  // Validate constraints / limits
  let constraints: AgentConstraints | undefined;
  const constraintsCandidate = value.constraints ?? value.limits;
  if (!isRecord(constraintsCandidate)) {
    collector.addIssue({
      path: `${path}.constraints`,
      message: "Expected constraints or limits object",
      received: constraintsCandidate,
    });
  } else {
    const cRes = validateAgentConstraints(constraintsCandidate, `${path}.constraints`);
    if (!cRes.success) {
      cRes.error.forEach((issue) => collector.addIssue(issue));
    } else {
      constraints = cRes.data;
    }
  }

  // Model preference
  let modelPreference: ModelPreference | undefined;
  if (!isRecord(value.modelPreference)) {
    collector.addIssue({
      path: `${path}.modelPreference`,
      message: "Expected modelPreference object",
      received: value.modelPreference,
    });
  } else {
    const tier = collector.check(
      validateEnum(value.modelPreference.tier, `${path}.modelPreference.tier`, MODEL_TIERS)
    );
    if (tier !== undefined) {
      modelPreference = {
        tier,
        preferredProvider:
          typeof value.modelPreference.preferredProvider === "string"
            ? value.modelPreference.preferredProvider
            : undefined,
        preferredModel:
          typeof value.modelPreference.preferredModel === "string"
            ? value.modelPreference.preferredModel
            : undefined,
        fallbackModel:
          typeof value.modelPreference.fallbackModel === "string"
            ? value.modelPreference.fallbackModel
            : undefined,
        temperature:
          typeof value.modelPreference.temperature === "number"
            ? value.modelPreference.temperature
            : undefined,
      };
    }
  }

  const tags = collector.check(
    validateArray(value.tags ?? [], `${path}.tags`, (t, tPath) =>
      validateString(t, tPath, { minLength: 1, maxLength: 50 })
    )
  );

  if (
    collector.hasIssues() ||
    id === undefined ||
    slug === undefined ||
    name === undefined ||
    displayName === undefined ||
    department === undefined ||
    role === undefined ||
    description === undefined ||
    systemPromptTemplate === undefined ||
    status === undefined ||
    createdAt === undefined ||
    updatedAt === undefined ||
    constraints === undefined ||
    modelPreference === undefined
  ) {
    return fail(collector.toError("AgentProfile validation failed"));
  }

  const limits: AgentLimits = {
    maxTokensPerTurn: constraints.maxTokensPerTurn,
    maxDelegationDepth: constraints.maxDelegationDepth,
    maxChildrenTasks: constraints.maxChildrenTasks,
  };

  return ok({
    id,
    slug,
    name,
    displayName,
    department,
    role,
    description,
    systemPromptTemplate,
    capabilities: capabilities ?? [],
    supportedTasks,
    constraints,
    limits,
    modelPreference,
    permissions,
    version,
    status,
    tags: tags ?? [],
    personaAttributes: value.personaAttributes as PersonaAttributes | undefined,
    metadata: value.metadata as Record<string, unknown> | undefined,
    createdAt,
    updatedAt,
  });
}
