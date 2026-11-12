/**
 * @terrarium/cli - tests/budget-cli.test.ts
 *
 * Tests for Budget & Model Routing CLI commands (A4 & A5).
 * Validates terminal card rendering, token/spend gauges, operational bounds,
 * transparent estimate disclaimers, and structured JSON output.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  type BudgetConfig,
  type RoutingCriteria,
} from "@terrarium/contracts";
import { BudgetManager, ModelRouter } from "@terrarium/core";
import {
  formatBudgetCard,
  formatRoutingCard,
  handleBudgetShow,
  handleBudgetSet,
  handleModelRoute,
} from "../src/commands/budget-commands.js";

describe("CLI Budget & Model Routing Commands Suite (A4 & A5)", () => {
  let budgetManager: BudgetManager;
  let modelRouter: ModelRouter;

  beforeEach(() => {
    budgetManager = new BudgetManager();
    modelRouter = new ModelRouter();
  });

  describe("formatBudgetCard & handleBudgetShow", () => {
    it("renders formatted budget card with token meter, spend meter, and disclaimer", async () => {
      const config: BudgetConfig = {
        scope: "task",
        targetId: "task-cli-1",
        maxTokens: 50000,
        maxSpendUsd: 2.0,
        maxConcurrency: 3,
        maxDurationMs: 120000,
        onLimitExceeded: "pause_and_request_approval",
      };
      await budgetManager.setConfig(config);

      const res = await handleBudgetShow("task", "task-cli-1", budgetManager);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toContain("[BUDGET] RESOURCE LIMITS");
        expect(res.data).toContain("TASK");
        expect(res.data).toContain("task-cli-1");
        expect(res.data).toContain("TOKEN UTILIZATION");
        expect(res.data).toContain("ESTIMATED SPEND");
        expect(res.data).toContain("Active Concurrency: 0 / 3 slots");
        expect(res.data).toContain("Max Duration: 120s");
        expect(res.data).toContain("PAUSE_AND_REQUEST_APPROVAL");
        expect(res.data).toContain("*"); // estimate disclaimer
      }
    });

    it("outputs structured JSON when --json flag is provided for budget show", async () => {
      const config: BudgetConfig = {
        scope: "task",
        targetId: "task-json-1",
        maxTokens: 25000,
        maxSpendUsd: 1.5,
      };
      await budgetManager.setConfig(config);

      const res = await handleBudgetShow("task", "task-json-1", budgetManager, { json: true });
      expect(res.success).toBe(true);
      if (res.success) {
        const parsed = JSON.parse(res.data);
        expect(parsed.summary.scope).toBe("task");
        expect(parsed.summary.targetId).toBe("task-json-1");
        expect(parsed.config.maxTokens).toBe(25000);
      }
    });
  });

  describe("handleBudgetSet", () => {
    it("sets budget limits and renders the updated terminal card", async () => {
      const config: BudgetConfig = {
        scope: "project",
        targetId: "proj-alpha",
        maxTokens: 100000,
        maxSpendUsd: 10.0,
        maxConcurrency: 5,
        onLimitExceeded: "stop",
      };

      const res = await handleBudgetSet(config, budgetManager);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toContain("PROJECT");
        expect(res.data).toContain("proj-alpha");
        expect(res.data).toContain("100,000");
      }
    });

    it("outputs structured JSON for budget set when requested", async () => {
      const config: BudgetConfig = {
        scope: "agent",
        targetId: "lead-architect",
        maxTokens: 30000,
        maxSpendUsd: 1.0,
      };

      const res = await handleBudgetSet(config, budgetManager, { json: true });
      expect(res.success).toBe(true);
      if (res.success) {
        const parsed = JSON.parse(res.data);
        expect(parsed.config.scope).toBe("agent");
        expect(parsed.config.targetId).toBe("lead-architect");
      }
    });
  });

  describe("formatRoutingCard & handleModelRoute", () => {
    it("renders formatted model routing card with transparent rationale", async () => {
      const criteria: RoutingCriteria = {
        taskId: "task-route-1",
        taskTitle: "Refactor core memory system",
        complexity: "high",
        riskLevel: "critical",
      };

      const res = await handleModelRoute(criteria, modelRouter);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toContain("MODEL ROUTING DECISION");
        expect(res.data).toContain("ADVANCED");
        expect(res.data).toContain("ROUTING CRITERIA");
        expect(res.data).toContain("HIGH");
        expect(res.data).toContain("CRITICAL");
        expect(res.data).toContain("TRANSPARENT RATIONALE");
      }
    });

    it("renders fallback indication clearly when budget constraint forces degradation", async () => {
      const criteria: RoutingCriteria = {
        taskId: "task-route-budget",
        taskTitle: "High complexity under budget cap",
        complexity: "high",
        riskLevel: "high",
        budgetConstraint: {
          remainingSpendUsd: 0.03,
        },
      };

      const res = await handleModelRoute(criteria, modelRouter);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toContain("YES (Degraded / Fallback)");
        expect(res.data).toContain("STANDARD");
      }
    });

    it("outputs structured JSON when --json flag is provided for model routing", async () => {
      const criteria: RoutingCriteria = {
        taskId: "task-route-json",
        taskTitle: "Status inquiry",
        complexity: "low",
        riskLevel: "read_only",
      };

      const res = await handleModelRoute(criteria, modelRouter, { json: true });
      expect(res.success).toBe(true);
      if (res.success) {
        const parsed = JSON.parse(res.data);
        expect(parsed.decision.tier).toBe("fast");
        expect(parsed.decision.isEstimate).toBe(true);
        expect(parsed.criteria.complexity).toBe("low");
      }
    });
  });
});
