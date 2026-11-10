/**
 * @terrarium/core - tests/model-router.test.ts
 *
 * Comprehensive tests for ModelRouter.
 * Validates intelligent model selection by task complexity, risk severity,
 * required capabilities, budget constraints (graceful degradation),
 * fallback rationale transparency, and estimate tags.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  type RoutingCriteria,
  ModelRoutingError,
} from "@terrarium/contracts";
import { ModelRouter } from "../src/routing/model-router.js";

describe("Intelligent Model Router Suite (A1 & A2)", () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter();
  });

  describe("Tier Selection by Complexity & Risk", () => {
    it("routes to fast economical tier for low complexity and read_only risk", () => {
      const criteria: RoutingCriteria = {
        taskId: "task-low-1",
        taskTitle: "Fetch project status",
        complexity: "low",
        riskLevel: "read_only",
      };

      const result = router.routeModel(criteria);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe("fast");
        expect(result.data.isFallback).toBe(false);
        expect(result.data.isEstimate).toBe(true);
        expect(result.data.rationale).toContain("fast tier");
      }
    });

    it("routes to standard tier for medium complexity and medium risk", () => {
      const criteria: RoutingCriteria = {
        taskId: "task-med-1",
        taskTitle: "Implement API router endpoint",
        complexity: "medium",
        riskLevel: "medium",
      };

      const result = router.routeModel(criteria);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe("standard");
        expect(result.data.isFallback).toBe(false);
        expect(result.data.isEstimate).toBe(true);
      }
    });

    it("routes to advanced tier for high complexity and critical risk", () => {
      const criteria: RoutingCriteria = {
        taskId: "task-high-1",
        taskTitle: "Refactor core concurrency kernel",
        complexity: "high",
        riskLevel: "critical",
      };

      const result = router.routeModel(criteria);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe("advanced");
        expect(result.data.isFallback).toBe(false);
        expect(result.data.isEstimate).toBe(true);
      }
    });
  });

  describe("Budget Constraints & Graceful Degradation", () => {
    it("degrades from advanced to standard tier when remaining budget is constrained (< $0.05)", () => {
      const criteria: RoutingCriteria = {
        taskId: "task-degrade-1",
        taskTitle: "Complex architectural review",
        complexity: "high",
        riskLevel: "high",
        budgetConstraint: {
          remainingSpendUsd: 0.04,
        },
      };

      const result = router.routeModel(criteria);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe("standard");
        expect(result.data.isFallback).toBe(true);
        expect(result.data.rationale).toContain("[FALLBACK]");
        expect(result.data.rationale).toContain("Budget constraint");
      }
    });

    it("degrades to fast economical tier when remaining budget is critically low (< $0.01)", () => {
      const criteria: RoutingCriteria = {
        taskId: "task-crit-budget",
        taskTitle: "Complex refactor under severe budget limit",
        complexity: "high",
        riskLevel: "high",
        budgetConstraint: {
          remainingSpendUsd: 0.005,
        },
      };

      const result = router.routeModel(criteria);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe("fast");
        expect(result.data.isFallback).toBe(true);
        expect(result.data.rationale).toContain("[FALLBACK]");
      }
    });
  });

  describe("Capability Matching & Preferred Overrides", () => {
    it("filters models matching required capabilities such as reasoning", () => {
      const criteria: RoutingCriteria = {
        taskId: "task-reasoning",
        taskTitle: "Formal verification analysis",
        complexity: "medium",
        riskLevel: "low",
        requiredCapabilities: ["reasoning"],
      };

      const result = router.routeModel(criteria);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tier).toBe("advanced"); // only advanced models offer reasoning in default list
        expect(result.data.isFallback).toBe(true); // cross-tier fallback
      }
    });

    it("honors preferred model selection when available", () => {
      const criteria: RoutingCriteria = {
        taskId: "task-pref-model",
        taskTitle: "Fast prompt test",
        complexity: "low",
        riskLevel: "read_only",
        preferredModel: "gemini-1.5-flash",
      };

      const result = router.routeModel(criteria);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.modelId).toBe("gemini-1.5-flash");
        expect(result.data.providerId).toBe("gemini");
      }
    });

    it("returns ModelRoutingError when no model satisfies capability requirements", () => {
      const criteria: RoutingCriteria = {
        taskId: "task-impossible",
        taskTitle: "Quantum hardware interface",
        complexity: "high",
        riskLevel: "critical",
        requiredCapabilities: ["quantum_entanglement_simulation"],
      };

      const result = router.routeModel(criteria);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ModelRoutingError);
      }
    });
  });
});
