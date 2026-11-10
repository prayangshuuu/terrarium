/**
 * @terrarium/contracts - routing.ts
 *
 * Model tier routing contracts, complexity matching, and risk-adjusted selection.
 * Aligns strictly with PLAN.md Section 12 & 13 and PLAN_CONTEXT.md Section 7.
 */

import { type Result, ok, fail } from "./base.ts";
import { DomainValidationError } from "./errors.ts";
import { type AgentDepartment, AGENT_DEPARTMENTS } from "./departments.ts";
import { type RiskLevel, RISK_LEVELS } from "./planning.ts";
import { MODEL_TIERS, type ModelTier } from "./agent.ts";
import {
  isRecord,
  validateArray,
  validateBoolean,
  validateEnum,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

export { MODEL_TIERS, type ModelTier };

export const TASK_COMPLEXITIES = ["low", "medium", "high"] as const;
export type TaskComplexity = (typeof TASK_COMPLEXITIES)[number];

/**
 * Parameters determining how a model should be routed for an incoming task or step.
 */
export interface RoutingCriteria {
  readonly taskId?: string;
  readonly taskTitle?: string;
  readonly complexity: TaskComplexity;
  readonly riskLevel: RiskLevel | "read_only";
  readonly department?: AgentDepartment;
  readonly agentSlug?: string;
  readonly requiredCapabilities?: readonly string[];
  readonly budgetConstraint?: {
    readonly remainingSpendUsd?: number;
    readonly remainingTokens?: number;
  };
  readonly preferredProvider?: string;
  readonly preferredModel?: string;
}

/**
 * Explanatory model routing decision output.
 */
export interface RoutingDecision {
  readonly providerId: string;
  readonly modelId: string;
  readonly tier: ModelTier;
  readonly rationale: string;
  readonly isFallback: boolean;
  readonly estimatedCostPer1kTokens: number;
  readonly isEstimate: true; // Always an estimate per PLAN.md Section 13.3
}

export function validateRoutingCriteria(
  value: unknown,
  path = "routingCriteria"
): Result<RoutingCriteria, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const complexity = collector.check(
    validateEnum(value.complexity, `${path}.complexity`, TASK_COMPLEXITIES)
  );
  const riskLevel = collector.check(
    validateEnum(value.riskLevel, `${path}.riskLevel`, RISK_LEVELS)
  );

  let department: AgentDepartment | undefined;
  if (value.department !== undefined) {
    department = collector.check(
      validateEnum(value.department, `${path}.department`, AGENT_DEPARTMENTS)
    );
  }

  let agentSlug: string | undefined;
  if (value.agentSlug !== undefined) {
    agentSlug = collector.check(
      validateString(value.agentSlug, `${path}.agentSlug`, { minLength: 1, maxLength: 100 })
    );
  }

  let preferredProvider: string | undefined;
  if (value.preferredProvider !== undefined) {
    preferredProvider = collector.check(
      validateString(value.preferredProvider, `${path}.preferredProvider`, { minLength: 1, maxLength: 100 })
    );
  }

  let preferredModel: string | undefined;
  if (value.preferredModel !== undefined) {
    preferredModel = collector.check(
      validateString(value.preferredModel, `${path}.preferredModel`, { minLength: 1, maxLength: 100 })
    );
  }

  const requiredCapabilities = collector.check(
    validateArray(value.requiredCapabilities ?? [], `${path}.requiredCapabilities`, (c, cPath) =>
      validateString(c, cPath, { minLength: 1, maxLength: 100 })
    )
  );

  if (collector.hasIssues() || complexity === undefined || riskLevel === undefined) {
    return fail(collector.toError("RoutingCriteria validation failed"));
  }

  return ok({
    complexity,
    riskLevel,
    department,
    agentSlug,
    requiredCapabilities: requiredCapabilities ?? [],
    budgetConstraint: isRecord(value.budgetConstraint)
      ? {
          remainingSpendUsd:
            typeof value.budgetConstraint.remainingSpendUsd === "number"
              ? value.budgetConstraint.remainingSpendUsd
              : undefined,
          remainingTokens:
            typeof value.budgetConstraint.remainingTokens === "number"
              ? value.budgetConstraint.remainingTokens
              : undefined,
        }
      : undefined,
    preferredProvider,
    preferredModel,
  });
}

export function validateRoutingDecision(
  value: unknown,
  path = "routingDecision"
): Result<RoutingDecision, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const providerId = collector.check(
    validateString(value.providerId, `${path}.providerId`, { minLength: 1, maxLength: 100 })
  );
  const modelId = collector.check(
    validateString(value.modelId, `${path}.modelId`, { minLength: 1, maxLength: 100 })
  );
  const tier = collector.check(validateEnum(value.tier, `${path}.tier`, MODEL_TIERS));
  const rationale = collector.check(
    validateString(value.rationale, `${path}.rationale`, { minLength: 1, maxLength: 5000 })
  );
  const isFallback = collector.check(
    validateBoolean(value.isFallback ?? false, `${path}.isFallback`)
  );
  const estimatedCostPer1kTokens = collector.check(
    validateNumber(value.estimatedCostPer1kTokens, `${path}.estimatedCostPer1kTokens`, { min: 0 })
  );

  if (
    collector.hasIssues() ||
    providerId === undefined ||
    modelId === undefined ||
    tier === undefined ||
    rationale === undefined ||
    isFallback === undefined ||
    estimatedCostPer1kTokens === undefined
  ) {
    return fail(collector.toError("RoutingDecision validation failed"));
  }

  return ok({
    providerId,
    modelId,
    tier,
    rationale,
    isFallback,
    estimatedCostPer1kTokens,
    isEstimate: true,
  });
}
