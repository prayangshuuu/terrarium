/**
 * @terrarium/contracts - tests/budget-routing-contracts.test.ts
 *
 * Tests for Budget, Token Usage, and Model Routing contracts (A1 & A5).
 */

import { describe, it, expect } from "bun:test";
import {
  BUDGET_SCOPES,
  LIMIT_EXCEEDED_ACTIONS,
  MODEL_TIERS,
  TASK_COMPLEXITIES,
  validateBudgetConfig,
  evaluateBudget,
  calculateEstimatedCostUsd,
  validateRoutingCriteria,
  validateRoutingDecision,
  ConcurrencyLimitExceededError,
  DurationLimitExceededError,
  ModelRoutingError,
  ReservationExhaustedError,
  CANONICAL_MODEL_RATES,
  USER_FACING_TERMS,
} from "../src/index.ts";

describe("Budget, Token Usage, & Model Routing Contracts (A1 & A5)", () => {
  it("exports canonical budget scopes including agent and workflow", () => {
    expect(BUDGET_SCOPES).toContain("task");
    expect(BUDGET_SCOPES).toContain("workflow");
    expect(BUDGET_SCOPES).toContain("session");
    expect(BUDGET_SCOPES).toContain("project");
    expect(BUDGET_SCOPES).toContain("provider");
    expect(BUDGET_SCOPES).toContain("agent");
  });

  it("exports limit exceeded actions: stop, pause_and_request_approval, warn_only", () => {
    expect(LIMIT_EXCEEDED_ACTIONS).toEqual([
      "stop",
      "pause_and_request_approval",
      "warn_only",
    ]);
  });

  it("validates comprehensive BudgetConfig with bounds and concurrency limits", () => {
    const valid = {
      scope: "agent",
      targetId: "security-auditor",
      maxTokens: 50000,
      maxSpendUsd: 5.0,
      maxDurationMs: 60000,
      maxConcurrency: 4,
      maxDelegationDepth: 2,
      maxRetries: 3,
      maxDebateRounds: 2,
      warningThresholdPercent: 80,
      isHardLimit: true,
      onLimitExceeded: "pause_and_request_approval",
    };

    const res = validateBudgetConfig(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.scope).toBe("agent");
      expect(res.data.maxConcurrency).toBe(4);
      expect(res.data.onLimitExceeded).toBe("pause_and_request_approval");
      expect(res.data.maxDebateRounds).toBe(2);
    }
  });

  it("evaluates budget thresholds and generates typed BudgetExceededError", () => {
    const configRes = validateBudgetConfig({
      scope: "project",
      targetId: "proj-alpha",
      maxTokens: 10000,
      maxSpendUsd: 2.0,
      warningThresholdPercent: 75,
      isHardLimit: true,
    });
    expect(configRes.success).toBe(true);
    if (!configRes.success) return;

    // Normal usage (50%)
    const evalNormal = evaluateBudget(configRes.data, 5000, 1.0);
    expect(evalNormal.isWarning).toBe(false);
    expect(evalNormal.isExceeded).toBe(false);

    // Warning threshold reached (80%)
    const evalWarning = evaluateBudget(configRes.data, 8000, 1.6);
    expect(evalWarning.isWarning).toBe(true);
    expect(evalWarning.isExceeded).toBe(false);

    // Limit exceeded (105%)
    const evalExceeded = evaluateBudget(configRes.data, 10500, 2.1);
    expect(evalExceeded.isWarning).toBe(true);
    expect(evalExceeded.isExceeded).toBe(true);
    expect(evalExceeded.exceededError).toBeDefined();
    expect(evalExceeded.exceededError?.code).toBe("BUDGET_EXCEEDED");
  });

  it("calculates estimated USD cost from token counts and always marks as estimate", () => {
    const fastCost = calculateEstimatedCostUsd("gpt-4o-mini", 10000, 2000);
    expect(fastCost.isEstimate).toBe(true);
    expect(fastCost.estimatedCostUsd).toBeGreaterThan(0);
    // 10k prompt * 0.00015/1k = 0.0015, 2k completion * 0.0006/1k = 0.0012 => total = 0.0027
    expect(fastCost.estimatedCostUsd).toBe(0.0027);

    const standardCost = calculateEstimatedCostUsd("gpt-4o", 10000, 2000);
    expect(standardCost.isEstimate).toBe(true);
    // 10k * 0.0025 + 2k * 0.01 = 0.025 + 0.02 = 0.045
    expect(standardCost.estimatedCostUsd).toBe(0.045);
  });

  it("validates RoutingCriteria and RoutingDecision", () => {
    expect(MODEL_TIERS).toEqual(["fast", "standard", "advanced"]);
    expect(TASK_COMPLEXITIES).toEqual(["low", "medium", "high"]);

    const criteria = {
      complexity: "high",
      riskLevel: "critical",
      department: "security",
      agentSlug: "security-auditor",
      requiredCapabilities: ["streaming", "json_schema"],
      budgetConstraint: { remainingSpendUsd: 10.0, remainingTokens: 100000 },
    };
    const critRes = validateRoutingCriteria(criteria);
    expect(critRes.success).toBe(true);
    if (critRes.success) {
      expect(critRes.data.complexity).toBe("high");
      expect(critRes.data.riskLevel).toBe("critical");
      expect(critRes.data.requiredCapabilities).toContain("streaming");
    }

    const decision = {
      providerId: "mock-provider",
      modelId: "mock-advanced",
      tier: "advanced",
      rationale: "Routed to advanced tier due to critical security risk and high architectural complexity.",
      isFallback: false,
      estimatedCostPer1kTokens: 0.02,
    };
    const decRes = validateRoutingDecision(decision);
    expect(decRes.success).toBe(true);
    if (decRes.success) {
      expect(decRes.data.tier).toBe("advanced");
      expect(decRes.data.isEstimate).toBe(true);
    }
  });

  it("verifies typed error constructors for concurrency, duration, and routing", () => {
    const conc = new ConcurrencyLimitExceededError("task", 5, 3);
    expect(conc.code).toBe("BUDGET_EXCEEDED");
    expect(conc.activeConcurrency).toBe(5);
    expect(conc.maxConcurrency).toBe(3);

    const dur = new DurationLimitExceededError("workflow", 120000, 60000);
    expect(dur.code).toBe("BUDGET_EXCEEDED");
    expect(dur.elapsedMs).toBe(120000);

    const routing = new ModelRoutingError("No model satisfied capability", { req: "vision" });
    expect(routing.code).toBe("MODEL_ROUTING_ERROR");

    const exhaust = new ReservationExhaustedError("project", 50000, 20000);
    expect(exhaust.code).toBe("BUDGET_EXCEEDED");
    expect(exhaust.requestedTokens).toBe(50000);
    expect(exhaust.availableTokens).toBe(20000);
  });

  it("verifies user-facing estimate disclaimer terms", () => {
    expect(USER_FACING_TERMS.ESTIMATED_SPEND).toBe("Estimated Cost (Simulated)");
    expect(USER_FACING_TERMS.ESTIMATE_DISCLAIMER).toContain("PLAN.md Section 13.3");
  });
});
