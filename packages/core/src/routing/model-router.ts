/**
 * @terrarium/core - routing/model-router.ts
 *
 * Intelligent model router selecting model tiers by complexity, risk severity,
 * required capabilities, and remaining budget constraints.
 * Aligns strictly with PLAN.md Section 12 & 13 and PLAN_CONTEXT.md Section 7.
 */

import {
  type Result,
  ok,
  fail,
  type RoutingCriteria,
  type RoutingDecision,
  type ModelTier,
  validateRoutingDecision,
  ModelRoutingError,
  DEPARTMENTS,
  CANONICAL_MODEL_RATES,
} from "@terrarium/contracts";

export interface ModelOption {
  readonly providerId: string;
  readonly modelId: string;
  readonly tier: ModelTier;
  readonly capabilities: readonly string[];
  readonly costPer1kTokens: number;
}

export const DEFAULT_AVAILABLE_MODELS: readonly ModelOption[] = [
  // Fast tier
  {
    providerId: "mock",
    modelId: "mock-fast",
    tier: "fast",
    capabilities: ["streaming", "json_schema"],
    costPer1kTokens: 0.0003,
  },
  {
    providerId: "openai",
    modelId: "gpt-4o-mini",
    tier: "fast",
    capabilities: ["streaming", "json_schema", "tool_call", "vision"],
    costPer1kTokens: 0.00075,
  },
  {
    providerId: "gemini",
    modelId: "gemini-1.5-flash",
    tier: "fast",
    capabilities: ["streaming", "json_schema", "tool_call", "vision", "long_context"],
    costPer1kTokens: 0.000375,
  },

  // Standard tier
  {
    providerId: "mock",
    modelId: "mock-standard",
    tier: "standard",
    capabilities: ["streaming", "json_schema", "tool_call"],
    costPer1kTokens: 0.007,
  },
  {
    providerId: "openai",
    modelId: "gpt-4o",
    tier: "standard",
    capabilities: ["streaming", "json_schema", "tool_call", "vision"],
    costPer1kTokens: 0.0125,
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet",
    tier: "standard",
    capabilities: ["streaming", "json_schema", "tool_call", "vision"],
    costPer1kTokens: 0.018,
  },

  // Advanced tier
  {
    providerId: "mock",
    modelId: "mock-advanced",
    tier: "advanced",
    capabilities: ["streaming", "json_schema", "tool_call", "reasoning"],
    costPer1kTokens: 0.04,
  },
  {
    providerId: "openai",
    modelId: "o1",
    tier: "advanced",
    capabilities: ["reasoning", "json_schema"],
    costPer1kTokens: 0.075,
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-opus",
    tier: "advanced",
    capabilities: ["streaming", "json_schema", "tool_call", "reasoning"],
    costPer1kTokens: 0.09,
  },
];

export interface ModelRouterOptions {
  readonly availableModels?: readonly ModelOption[];
}

export class ModelRouter {
  private readonly availableModels: readonly ModelOption[];

  constructor(options?: ModelRouterOptions) {
    this.availableModels = options?.availableModels ?? DEFAULT_AVAILABLE_MODELS;
  }

  /**
   * Routes an incoming task/step to the optimal model based on complexity, risk, capabilities, and budget.
   */
  routeModel(criteria: RoutingCriteria): Result<RoutingDecision, ModelRoutingError> {
    // 1. Determine baseline tier from complexity and risk
    let targetTier: ModelTier = "standard";

    if (criteria.complexity === "low" && (criteria.riskLevel === "read_only" || criteria.riskLevel === "low")) {
      targetTier = "fast";
    } else if (criteria.complexity === "high" || criteria.riskLevel === "high" || criteria.riskLevel === "critical") {
      targetTier = "advanced";
    } else if (criteria.department && DEPARTMENTS[criteria.department]) {
      targetTier = DEPARTMENTS[criteria.department].defaultModelTier;
    }

    // 2. Evaluate budget constraints for graceful degradation
    let isFallback = false;
    let fallbackRationale = "";

    if (criteria.budgetConstraint?.remainingSpendUsd !== undefined) {
      const remainingSpend = criteria.budgetConstraint.remainingSpendUsd;

      // If budget is extremely constrained (< $0.05), downgrade advanced to standard or standard to fast
      if (remainingSpend < 0.05 && targetTier === "advanced") {
        targetTier = "standard";
        isFallback = true;
        fallbackRationale = `Budget constraint ($${remainingSpend.toFixed(2)} remaining) required downgrading from advanced to standard tier.`;
      }
      if (remainingSpend < 0.01 && targetTier !== "fast") {
        targetTier = "fast";
        isFallback = true;
        fallbackRationale = `Low budget ($${remainingSpend.toFixed(2)} remaining) required routing to economical fast tier.`;
      }
    }

    // 3. Filter candidates matching required capabilities and tier
    let candidates = this.availableModels.filter((m) => m.tier === targetTier);

    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      candidates = candidates.filter((m) =>
        criteria.requiredCapabilities!.every((cap) => m.capabilities.includes(cap))
      );
    }

    // If no candidate matches in target tier with required capabilities, check adjacent tiers
    if (candidates.length === 0) {
      candidates = this.availableModels.filter((m) =>
        (criteria.requiredCapabilities ?? []).every((cap) => m.capabilities.includes(cap))
      );
      if (candidates.length > 0) {
        isFallback = true;
        fallbackRationale = `Capability requirements (${criteria.requiredCapabilities?.join(", ")}) required routing outside target tier.`;
      }
    }

    if (candidates.length === 0) {
      return fail(
        new ModelRoutingError("No model satisfied capability and tier requirements.", {
          criteria,
        })
      );
    }

    // 4. Honor preferred provider or model if requested
    let selected = candidates[0]!;
    if (criteria.preferredModel) {
      const match = candidates.find((m) => m.modelId === criteria.preferredModel);
      if (match) selected = match;
    } else if (criteria.preferredProvider) {
      const match = candidates.find((m) => m.providerId === criteria.preferredProvider);
      if (match) selected = match;
    }

    // 5. Construct transparent rationale
    const rationaleParts: string[] = [];
    if (isFallback) {
      rationaleParts.push(`[FALLBACK] ${fallbackRationale}`);
    }
    rationaleParts.push(
      `Selected ${selected.providerId}/${selected.modelId} (${selected.tier} tier) for ${criteria.complexity} complexity and ${criteria.riskLevel} risk.`
    );

    const decision: RoutingDecision = {
      providerId: selected.providerId,
      modelId: selected.modelId,
      tier: selected.tier,
      rationale: rationaleParts.join(" "),
      isFallback,
      estimatedCostPer1kTokens: selected.costPer1kTokens,
      isEstimate: true,
    };

    const valRes = validateRoutingDecision(decision);
    if (!valRes.success) {
      return fail(new ModelRoutingError(valRes.error.message, { decision }));
    }

    return ok(valRes.data);
  }
}
