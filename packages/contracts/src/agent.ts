/**
 * @terrarium/contracts - agent.ts
 *
 * Agent profile, capability catalog, limits, and validation contracts.
 * Aligns with PLAN.md Section 4 (Organization and Agent Model).
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError, type ValidationIssue } from "./errors.ts";
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
}

/**
 * Model selection preferences for this agent.
 */
export interface ModelPreference {
  readonly tier: ModelTier;
  readonly preferredProvider?: string;
  readonly preferredModel?: string;
  readonly temperature?: number;
}

/**
 * Execution and delegation limits assigned to an agent profile.
 */
export interface AgentLimits {
  readonly maxTokensPerTurn: number;
  readonly maxDelegationDepth: number;
  readonly maxChildrenTasks: number;
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
  readonly limits: AgentLimits;
  readonly modelPreference: ModelPreference;
  readonly status: AgentProfileStatus;
  readonly tags: readonly string[];
  readonly personaAttributes?: PersonaAttributes;
  readonly metadata?: Readonly<Record<string, unknown>>;
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

  // Validate capabilities
  const capabilities = collector.check(
    validateArray<AgentCapability>(value.capabilities ?? [], `${path}.capabilities`, (c, cPath) => {
      const itemRes = validateAgentCapability(c, cPath);
      if (!itemRes.success) return fail(itemRes.error[0] ?? { path: cPath, message: "Invalid capability" });
      return ok(itemRes.data);
    })
  );

  // Validate limits
  let limits: AgentLimits | undefined;
  if (!isRecord(value.limits)) {
    collector.addIssue({ path: `${path}.limits`, message: "Expected limits object", received: value.limits });
  } else {
    const maxTokens = collector.check(
      validateNumber(value.limits.maxTokensPerTurn, `${path}.limits.maxTokensPerTurn`, {
        min: 100,
        max: 1000000,
        integer: true,
      })
    );
    const maxDepth = collector.check(
      validateNumber(value.limits.maxDelegationDepth, `${path}.limits.maxDelegationDepth`, {
        min: 0,
        max: 10,
        integer: true,
      })
    );
    const maxChildren = collector.check(
      validateNumber(value.limits.maxChildrenTasks, `${path}.limits.maxChildrenTasks`, {
        min: 0,
        max: 50,
        integer: true,
      })
    );

    if (maxTokens !== undefined && maxDepth !== undefined && maxChildren !== undefined) {
      limits = {
        maxTokensPerTurn: maxTokens,
        maxDelegationDepth: maxDepth,
        maxChildrenTasks: maxChildren,
      };
    }
  }

  // Validate model preference
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
        preferredProvider: typeof value.modelPreference.preferredProvider === "string"
          ? value.modelPreference.preferredProvider
          : undefined,
        preferredModel: typeof value.modelPreference.preferredModel === "string"
          ? value.modelPreference.preferredModel
          : undefined,
        temperature: typeof value.modelPreference.temperature === "number"
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
    limits === undefined ||
    modelPreference === undefined
  ) {
    return fail(collector.toError("AgentProfile validation failed"));
  }

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
    limits,
    modelPreference,
    status,
    tags: tags ?? [],
    personaAttributes: value.personaAttributes as PersonaAttributes | undefined,
    metadata: value.metadata as Record<string, unknown> | undefined,
    createdAt,
    updatedAt,
  });
}
