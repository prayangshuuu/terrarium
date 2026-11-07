/**
 * @terrarium/contracts - tests/orchestration-contracts.test.ts
 *
 * Boundary validation tests for orchestration domain contracts.
 */

import { describe, expect, it } from "bun:test";
import {
  DEFAULT_ORCHESTRATION_LIMITS,
  validateOrchestrationLimits,
  type OrchestrationLimits,
} from "../src/index.ts";

describe("Orchestration Contracts & Limits Validation", () => {
  it("provides safe default orchestration limits", () => {
    expect(DEFAULT_ORCHESTRATION_LIMITS.maxDelegationDepth).toBe(2);
    expect(DEFAULT_ORCHESTRATION_LIMITS.maxConcurrency).toBe(3);
    expect(DEFAULT_ORCHESTRATION_LIMITS.maxRetries).toBe(2);
    expect(DEFAULT_ORCHESTRATION_LIMITS.stepTimeoutMs).toBe(15000);
    expect(DEFAULT_ORCHESTRATION_LIMITS.totalTimeoutMs).toBe(60000);
    expect(DEFAULT_ORCHESTRATION_LIMITS.budgetCapUsd).toBe(1.0);
    expect(DEFAULT_ORCHESTRATION_LIMITS.maxTotalTokens).toBe(50000);
  });

  it("validates compliant orchestration limits", () => {
    const limits: OrchestrationLimits = {
      maxDelegationDepth: 1,
      maxConcurrency: 2,
      maxRounds: 3,
      maxRetries: 1,
      stepTimeoutMs: 10000,
      totalTimeoutMs: 30000,
      budgetCapUsd: 0.5,
      maxTotalTokens: 25000,
    };

    const res = validateOrchestrationLimits(limits);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.maxDelegationDepth).toBe(1);
      expect(res.data.maxConcurrency).toBe(2);
      expect(res.data.budgetCapUsd).toBe(0.5);
    }
  });

  it("rejects limits outside safe operational bounds", () => {
    const res = validateOrchestrationLimits({
      maxDelegationDepth: -1,
      maxConcurrency: 0,
      maxRetries: 10,
      stepTimeoutMs: 50,
      totalTimeoutMs: 50,
      budgetCapUsd: -5,
      maxTotalTokens: -100,
    });
    expect(res.success).toBe(false);
  });
});
