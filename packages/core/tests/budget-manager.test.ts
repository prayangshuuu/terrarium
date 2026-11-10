/**
 * @terrarium/core - tests/budget-manager.test.ts
 *
 * Comprehensive tests for BudgetManager, BudgetLedger, BoundsEnforcer, and CostEstimator.
 * Validates concurrency safety, atomic ledger settlement, bounds enforcement,
 * approval pause gates, and SQLite repository persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  type BudgetConfig,
  type TokenUsage,
  BudgetExhaustedError,
  ConcurrencyLimitExceededError,
  DurationLimitExceededError,
} from "@terrarium/contracts";
import { BudgetManager } from "../src/budget/budget-manager.js";
import { BoundsEnforcer } from "../src/budget/bounds-enforcer.js";
import { normalizeTokenUsage, estimateTokensFromChars } from "../src/budget/cost-estimator.js";
import { ApprovalManager } from "../src/approvals/approval-manager.js";
import { createSqliteDatabase, type SqliteDatabase } from "../src/persistence/sqlite-database.js";

describe("Budget & Bounds Management Suite (A1, A2 & A3)", () => {
  let db: SqliteDatabase;
  let approvals: ApprovalManager;
  let budgetManager: BudgetManager;

  beforeEach(() => {
    db = createSqliteDatabase(":memory:");
    approvals = new ApprovalManager({ repository: db.approvals });
    budgetManager = new BudgetManager({
      repository: db.budgets,
      approvals,
    });
  });

  afterEach(() => {
    db.close();
  });

  describe("Cost Estimator & Token Normalization", () => {
    it("normalizes diverse provider usage and calculates estimated spend", () => {
      const raw = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      };

      const normalized = normalizeTokenUsage(raw, "mock", "mock-standard");
      expect(normalized.promptTokens).toBe(1000);
      expect(normalized.completionTokens).toBe(500);
      expect(normalized.totalTokens).toBe(1500);
      expect(normalized.estimatedCostUsd).toBeGreaterThan(0);
      expect(normalized.isEstimate).toBe(true);
    });

    it("falls back to character heuristics when token metrics are missing", () => {
      const estimatedTokens = estimateTokensFromChars("Hello world! This is Terrarium multi-agent framework.");
      expect(estimatedTokens).toBeGreaterThan(0);
      expect(estimatedTokens).toBeLessThan(100);

      const normalized = normalizeTokenUsage(undefined, "openai", "gpt-4o", "Hello world!");
      expect(normalized.totalTokens).toBeGreaterThan(0);
      expect(normalized.isEstimate).toBe(true);
    });
  });

  describe("Budget Configuration & Scope Management", () => {
    it("sets, persists, and retrieves task-level budget configuration", async () => {
      const config: BudgetConfig = {
        scope: "task",
        targetId: "task-100",
        maxTokens: 50000,
        maxSpendUsd: 2.5,
        maxDurationMs: 60000,
        maxConcurrency: 3,
        onLimitExceeded: "stop",
      };

      const setRes = await budgetManager.setConfig(config);
      expect(setRes.success).toBe(true);

      const getRes = await budgetManager.getConfig("task", "task-100");
      expect(getRes.success).toBe(true);
      if (getRes.success) {
        expect(getRes.data.maxTokens).toBe(50000);
        expect(getRes.data.maxSpendUsd).toBe(2.5);
        expect(getRes.data.onLimitExceeded).toBe("stop");
      }
    });

    it("provides default budget configuration when none is set", async () => {
      const getRes = await budgetManager.getConfig("task", "unconfigured-task");
      expect(getRes.success).toBe(true);
      if (getRes.success) {
        expect(getRes.data.scope).toBe("task");
        expect(getRes.data.targetId).toBe("unconfigured-task");
        expect(getRes.data.maxTokens).toBeGreaterThan(0);
      }
    });
  });

  describe("Reservations, Commitments & Ledger Settling", () => {
    it("reserves tokens, commits actual usage, and tracks ledger balance", async () => {
      const config: BudgetConfig = {
        scope: "task",
        targetId: "task-res-1",
        maxTokens: 10000,
        maxSpendUsd: 1.0,
        onLimitExceeded: "stop",
      };
      await budgetManager.setConfig(config);

      // Reserve 2000 tokens
      const reserveRes = await budgetManager.reserve({
        taskId: "task-res-1",
        agentSlug: "lead-architect",
        scope: "task",
        targetId: "task-res-1",
        estimatedTokens: 2000,
        estimatedSpendUsd: 0.05,
      });

      expect(reserveRes.success).toBe(true);
      if (!reserveRes.success) return;
      const reservationId = reserveRes.data.id;
      expect(reserveRes.data.status).toBe("active");

      // Verify summary shows reserved tokens
      let summaryRes = await budgetManager.getSummary("task", "task-res-1");
      expect(summaryRes.success).toBe(true);
      if (summaryRes.success) {
        expect(summaryRes.data.reservedTokens).toBe(2000);
        expect(summaryRes.data.usedTokens).toBe(0);
        expect(summaryRes.data.remainingTokens).toBe(8000);
      }

      // Commit actual usage (1500 tokens used)
      const usage: TokenUsage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        estimatedCostUsd: 0.03,
      };

      const commitRes = await budgetManager.commitUsage({
        reservationId,
        taskId: "task-res-1",
        agentSlug: "lead-architect",
        scope: "task",
        targetId: "task-res-1",
        providerId: "mock",
        modelId: "mock-standard",
        usage,
      });

      expect(commitRes.success).toBe(true);

      // Verify summary shows committed usage and reservation cleared
      summaryRes = await budgetManager.getSummary("task", "task-res-1");
      expect(summaryRes.success).toBe(true);
      if (summaryRes.success) {
        expect(summaryRes.data.usedTokens).toBe(1500);
        expect(summaryRes.data.reservedTokens).toBe(0);
        expect(summaryRes.data.remainingTokens).toBe(8500);
        expect(summaryRes.data.usedSpendUsd).toBe(0.03);
      }
    });

    it("releases reservation on execution failure or cancellation", async () => {
      const config: BudgetConfig = {
        scope: "task",
        targetId: "task-rel-1",
        maxTokens: 5000,
        onLimitExceeded: "stop",
      };
      await budgetManager.setConfig(config);

      const reserveRes = await budgetManager.reserve({
        taskId: "task-rel-1",
        agentSlug: "backend-developer",
        scope: "task",
        targetId: "task-rel-1",
        estimatedTokens: 2500,
      });

      expect(reserveRes.success).toBe(true);
      if (!reserveRes.success) return;

      const releaseRes = await budgetManager.releaseReservation(reserveRes.data.id, "Step cancelled");
      expect(releaseRes.success).toBe(true);

      const summaryRes = await budgetManager.getSummary("task", "task-rel-1");
      expect(summaryRes.success).toBe(true);
      if (summaryRes.success) {
        expect(summaryRes.data.reservedTokens).toBe(0);
        expect(summaryRes.data.remainingTokens).toBe(5000);
      }
    });

    it("rejects reservation when budget is exhausted with stop policy", async () => {
      const config: BudgetConfig = {
        scope: "task",
        targetId: "task-exhausted",
        maxTokens: 1000,
        onLimitExceeded: "stop",
      };
      await budgetManager.setConfig(config);

      // Request reservation exceeding limit
      const reserveRes = await budgetManager.reserve({
        taskId: "task-exhausted",
        agentSlug: "worker",
        scope: "task",
        targetId: "task-exhausted",
        estimatedTokens: 1500,
      });

      expect(reserveRes.success).toBe(false);
      if (!reserveRes.success) {
        expect(reserveRes.error).toBeInstanceOf(BudgetExhaustedError);
        expect(reserveRes.error.message).toContain("Budget limit exceeded");
      }
    });

    it("triggers approval request when onLimitExceeded is pause_and_request_approval", async () => {
      // Seed task to satisfy foreign key constraint on approvals table
      await db.tasks.create({
        id: "task-approval-gate",
        title: "Approval Gate Task",
        description: "Task for approval testing",
        department: "engineering",
        status: "running",
        priority: "medium",
        delegationDepth: 0,
        contextRefs: [],
        expectedDeliverables: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const config: BudgetConfig = {
        scope: "task",
        targetId: "task-approval-gate",
        maxTokens: 1000,
        onLimitExceeded: "pause_and_request_approval",
      };
      await budgetManager.setConfig(config);

      const reserveRes = await budgetManager.reserve({
        taskId: "task-approval-gate",
        agentSlug: "orchestrator",
        scope: "task",
        targetId: "task-approval-gate",
        estimatedTokens: 2000,
      });

      expect(reserveRes.success).toBe(false);
      if (!reserveRes.success) {
        expect(reserveRes.error.message).toContain("approval");
      }

      // Verify an approval was registered in ApprovalManager
      const pendingRes = await approvals.listPending();
      expect(pendingRes.success).toBe(true);
      if (pendingRes.success) {
        const matching = pendingRes.data.filter((a) => a.actionType === "budget_override");
        expect(matching.length).toBeGreaterThan(0);
        expect(matching[0]!.riskLevel).toBe("high");
      }
    });
  });

  describe("Bounds Enforcer (Concurrency, Duration, Debates, Retries)", () => {
    it("enforces maxConcurrency slots and frees them upon release", () => {
      const enforcer = new BoundsEnforcer({
        scope: "task",
        targetId: "task-bounds",
        maxConcurrency: 2,
        maxRetries: 3,
        maxDebateRounds: 2,
      });

      // Acquire two slots
      const s1 = enforcer.acquireConcurrencySlot("worker-1");
      const s2 = enforcer.acquireConcurrencySlot("worker-2");
      expect(s1.success).toBe(true);
      expect(s2.success).toBe(true);
      expect(enforcer.getActiveConcurrency()).toBe(2);

      // Third acquisition should fail
      const s3 = enforcer.acquireConcurrencySlot("worker-3");
      expect(s3.success).toBe(false);
      if (!s3.success) {
        expect(s3.error).toBeInstanceOf(ConcurrencyLimitExceededError);
      }

      // Release a slot and verify subsequent acquisition succeeds
      enforcer.releaseConcurrencySlot("worker-1");
      expect(enforcer.getActiveConcurrency()).toBe(1);

      const s4 = enforcer.acquireConcurrencySlot("worker-3");
      expect(s4.success).toBe(true);
      expect(enforcer.getActiveConcurrency()).toBe(2);
    });

    it("enforces duration limit bounds", () => {
      const enforcer = new BoundsEnforcer({
        scope: "task",
        targetId: "task-dur",
        maxDurationMs: 50,
      });

      // Simulate passage of time
      enforcer.recordStartTime(Date.now() - 100);
      const checkRes = enforcer.checkDuration();
      expect(checkRes.success).toBe(false);
      if (!checkRes.success) {
        expect(checkRes.error).toBeInstanceOf(DurationLimitExceededError);
      }
    });

    it("tracks and limits debate rounds and retries", () => {
      const enforcer = new BoundsEnforcer({
        scope: "task",
        targetId: "task-debate",
        maxDebateRounds: 2,
        maxRetries: 2,
      });

      // Debate rounds
      expect(enforcer.incrementDebateRound().success).toBe(true);
      expect(enforcer.incrementDebateRound().success).toBe(true);
      const debateExcess = enforcer.incrementDebateRound();
      expect(debateExcess.success).toBe(false);

      // Retries
      expect(enforcer.incrementRetry().success).toBe(true);
      expect(enforcer.incrementRetry().success).toBe(true);
      const retryExcess = enforcer.incrementRetry();
      expect(retryExcess.success).toBe(false);
    });
  });
});
