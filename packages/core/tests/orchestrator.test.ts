/**
 * @terrarium/core - tests/orchestrator.test.ts
 *
 * Comprehensive integration test suite for demand-based selection and bounded orchestration.
 * Tests: full lifecycle, bounds enforcement, fault tolerance, retries, cancellation,
 * idempotency, output preservation, and dormancy verification.
 * Aligns strictly with PLAN.md Section 5 & Prompt 8 requirements.
 */

import { describe, expect, it } from "bun:test";
import {
  createAgentRegistry,
  createBoundedCoordinator,
  createCoreEngine,
  createDelegationManager,
  createSqliteDatabase,
  createTaskIntakeService,
  formatExecutionSummary,
  formatSelectionExplainability,
  MockAgentRuntime,
} from "../src/index.ts";
import { type TaskPlan } from "@terrarium/contracts";

describe("Bounded Orchestration & Demand-Based Selection Suite", () => {
  // Helper to generate a realistic approved TaskPlan
  async function generateApprovedPlan(prompt: string): Promise<TaskPlan> {
    const registry = createAgentRegistry();
    const intake = createTaskIntakeService({ registry });
    const res = await intake.processIntake({ prompt });
    if (!res.success) {
      throw new Error(`Failed to generate test plan: ${res.error.message}`);
    }
    return res.data.plan;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Full Lifecycle & Normal Execution
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Category 1: Full Lifecycle & Normal Plan Execution", () => {
    it("executes an approved architecture review plan cleanly through all lifecycle states", async () => {
      const plan = await generateApprovedPlan(
        "Conduct an architecture review of packages/core and verify boundaries"
      );
      const registry = createAgentRegistry();
      const coordinator = createBoundedCoordinator({ registry });

      const events: string[] = [];
      const res = await coordinator.executePlan({
        plan,
        onEvent: (e) => events.push(e.type),
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { task, stepResults, taskResult, status, isPartial, activeProfiles, dormantProfiles } =
          res.data;

        expect(status).toBe("completed");
        expect(isPartial).toBe(false);
        expect(task.status).toBe("completed");
        expect(stepResults.length).toBe(plan.steps.length);

        // Verify lifecycle events
        expect(events).toContain("task_started");
        expect(events).toContain("profile_selected");
        expect(events).toContain("step_started");
        expect(events).toContain("step_completed");
        expect(events).toContain("task_completed");

        // Verify output and evidence preservation
        expect(taskResult.success).toBe(true);
        expect(taskResult.evidence.length).toBeGreaterThan(0);
        expect(taskResult.metrics.tokensTotal).toBeGreaterThan(0);
        expect(taskResult.metrics.estimatedCostUsd).toBeGreaterThan(0);

        // Verify dormancy: only selected profiles active, rest remain dormant
        expect(activeProfiles.length).toBeGreaterThanOrEqual(1);
        expect(dormantProfiles.length).toBeGreaterThan(10);
      }
    });

    it("persists executions, steps, and task updates in SQLite repository", async () => {
      const db = createSqliteDatabase(":memory:");
      const registry = createAgentRegistry({ repository: db.agentProfiles });
      const coordinator = createBoundedCoordinator({ registry, repositories: db });
      const plan = await generateApprovedPlan("Write unit tests for packages/contracts");

      const res = await coordinator.executePlan({
        plan,
        autoApproveGates: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { task } = res.data;

        // Verify Task in DB is updated to 'completed'
        const dbTask = await db.tasks.findById(task.id);
        expect(dbTask.success).toBe(true);
        if (dbTask.success) {
          expect(dbTask.data?.status).toBe("completed");
        }

        // Verify Executions created in DB (one per executed step)
        const dbExecs = await db.executions.listByTaskId(task.id);
        expect(dbExecs.success).toBe(true);
        if (dbExecs.success && dbExecs.data) {
          expect(dbExecs.data.length).toBe(plan.steps.length);
          expect(dbExecs.data.every((e: any) => e.status === "completed")).toBe(true);
        }
      }

      db.close();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Bounds Enforcement (Concurrency, Delegation Depth, Spend, Timeouts)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Category 2: Bounds Enforcement", () => {
    it("enforces delegation depth limit and prevents recursion loops", () => {
      const dm = createDelegationManager();

      // Legal root delegation (depth 0 < max 2)
      const res1 = dm.canDelegate({
        currentDepth: 0,
        maxDepth: 2,
        targetDepartment: "engineering",
        objective: "Build API interface",
      });
      expect(res1.success).toBe(true);
      dm.recordDelegation(undefined, "engineering", "Build API interface");

      // Legal sub-delegation (depth 1 < max 2)
      const res2 = dm.canDelegate({
        currentDepth: 1,
        maxDepth: 2,
        parentTaskId: "t1",
        targetDepartment: "quality_assurance",
        objective: "Write tests",
      });
      expect(res2.success).toBe(true);
      dm.recordDelegation("t1", "quality_assurance", "Write tests");

      // Exceeded depth limit (depth 2 >= max 2)
      const res3 = dm.canDelegate({
        currentDepth: 2,
        maxDepth: 2,
        parentTaskId: "t2",
        targetDepartment: "engineering",
        objective: "Sub-sub task",
      });
      expect(res3.success).toBe(false);

      // Loop detection: exact same objective to same department
      const resLoop = dm.canDelegate({
        currentDepth: 1,
        maxDepth: 2,
        targetDepartment: "engineering",
        objective: "Build API interface",
      });
      expect(resLoop.success).toBe(false);
      if (!resLoop.success) {
        expect(resLoop.error.message).toContain("Unbounded loop prevented");
      }
    });

    it("enforces spend limit and halts execution with SpendLimitExceededError", async () => {
      const plan = await generateApprovedPlan("Conduct an architecture review of packages/core");
      const registry = createAgentRegistry();

      // Set extremely low budget cap
      const coordinator = createBoundedCoordinator({
        registry,
        defaultLimits: { budgetCapUsd: 0.01 }, // $0.01 cap will be exceeded after step 1
      });

      const res = await coordinator.executePlan({
        plan,
        limits: { budgetCapUsd: 0.01 },
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.isPartial).toBe(true);
        expect(res.data.status).toBe("failed");
        expect(res.data.failureReason).toContain("Spend limit exceeded");
      }
    });

    it("enforces task timeout and marks task failed cleanly", async () => {
      const plan = await generateApprovedPlan("Conduct an architecture review of packages/core");
      const registry = createAgentRegistry();

      // Runtime with simulated delay
      const runtime = new MockAgentRuntime({ delayMs: 50 });
      const coordinator = createBoundedCoordinator({
        registry,
        runtime,
      });

      // Total timeout of 30ms (smaller than step delay of 50ms)
      const res = await coordinator.executePlan({
        plan,
        limits: { totalTimeoutMs: 30 },
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.isPartial).toBe(true);
        expect(res.data.status).toBe("failed");
        expect(res.data.failureReason).toContain("total timeout limit");
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Fault Tolerance, Retries, Cancellation, and Idempotency
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Category 3: Fault Tolerance & Recovery", () => {
    it("handles transient provider failures with bounded retries and succeeds", async () => {
      const plan = await generateApprovedPlan("Conduct an architecture review of packages/core");
      const registry = createAgentRegistry();

      // Step 1 fails once transiently, then succeeds on retry 2
      const runtime = new MockAgentRuntime({
        transientFailures: { step_1: 1 },
      });
      const coordinator = createBoundedCoordinator({ registry, runtime });

      const events: string[] = [];
      const res = await coordinator.executePlan({
        plan,
        limits: { maxRetries: 2 },
        onEvent: (e) => events.push(e.type),
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.status).toBe("completed");
        expect(events).toContain("step_retry");

        const step1 = res.data.stepResults.find((s) => s.stepId === "step_1");
        expect(step1?.attempts).toBe(2);
        expect(step1?.status).toBe("completed");
      }
    });

    it("halts with partial completion when retries are exhausted", async () => {
      const plan = await generateApprovedPlan("Conduct an architecture review of packages/core");
      const registry = createAgentRegistry();

      // Step 2 permanently fails
      const runtime = new MockAgentRuntime({
        failStepIds: ["step_2"],
      });
      const coordinator = createBoundedCoordinator({ registry, runtime });

      const res = await coordinator.executePlan({
        plan,
        limits: { maxRetries: 1 },
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { status, isPartial, stepResults } = res.data;
        expect(status).toBe("failed");
        expect(isPartial).toBe(true);

        const step1 = stepResults.find((s) => s.stepId === "step_1");
        const step2 = stepResults.find((s) => s.stepId === "step_2");
        expect(step1?.status).toBe("completed");
        expect(step2?.status).toBe("failed");
        expect(step2?.attempts).toBe(2); // Initial attempt + 1 retry = 2 attempts
      }
    });

    it("stops cleanly on user cancellation and preserves completed step outputs", async () => {
      const plan = await generateApprovedPlan("Conduct an architecture review of packages/core");
      const registry = createAgentRegistry();
      const abortController = new AbortController();

      const runtime = new MockAgentRuntime({ delayMs: 30 });
      const coordinator = createBoundedCoordinator({ registry, runtime });

      // Abort immediately after starting
      setTimeout(() => {
        abortController.abort();
      }, 10);

      const res = await coordinator.executePlan({
        plan,
        abortSignal: abortController.signal,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.status).toBe("cancelled");
        expect(res.data.isPartial).toBe(true);
      }
    });

    it("is idempotent: re-executing with the same idempotency key returns cached result", async () => {
      const plan = await generateApprovedPlan("Conduct an architecture review of packages/core");
      const registry = createAgentRegistry();
      const coordinator = createBoundedCoordinator({ registry });

      const firstRun = await coordinator.executePlan({
        plan,
        idempotencyKey: "idem_test_key_01",
      });

      expect(firstRun.success).toBe(true);

      const secondRun = await coordinator.executePlan({
        plan,
        idempotencyKey: "idem_test_key_01",
      });

      expect(secondRun.success).toBe(true);
      if (firstRun.success && secondRun.success) {
        expect(secondRun.data.task.id).toBe(firstRun.data.task.id);
        expect(secondRun.data.metrics.tokensTotal).toBe(firstRun.data.metrics.tokensTotal);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Output, Evidence, and Disagreements Preservation
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Category 4: Evidence & Disagreements Preservation", () => {
    it("preserves simulated customer disagreements and evidence items", async () => {
      const plan = await generateApprovedPlan(
        "Simulate customer persona reactions to a $49/mo pricing tier"
      );
      const registry = createAgentRegistry();
      const coordinator = createBoundedCoordinator({ registry });

      const res = await coordinator.executePlan({ plan });

      expect(res.success).toBe(true);
      if (res.success) {
        const { taskResult } = res.data;
        expect(taskResult.evidence.length).toBeGreaterThan(0);
        expect(taskResult.evidence.some((e) => e.confidence === "simulated")).toBe(true);

        // Disagreement preservation
        expect(taskResult.disagreements.length).toBeGreaterThan(0);
        expect(taskResult.disagreements[0]?.topic).toContain("Pricing");
        expect(taskResult.disagreements[0]?.positions.length).toBeGreaterThan(0);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Presentation & Explainability
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Category 5: Selection Explainability & Formatting", () => {
    it("formats selection explainability proving dormant profiles remained uninstantiated", async () => {
      const plan = await generateApprovedPlan("Conduct an architecture review of packages/core");
      const registry = createAgentRegistry();
      const coordinator = createBoundedCoordinator({ registry });

      const res = await coordinator.executePlan({ plan });

      expect(res.success).toBe(true);
      if (res.success) {
        const output = formatSelectionExplainability(res.data, false);
        expect(output).toContain("TERRARIUM DEMAND-BASED SELECTION AUDIT");
        expect(output).toContain("Activated Profiles:");
        expect(output).toContain("Dormant Profiles:");
        expect(output).toContain("STEP-BY-STEP SELECTION RATIONALE");
        expect(output).toContain("DORMANT PROFILES AUDIT");
      }
    });

    it("formats complete execution summary with evidence and metrics", async () => {
      const plan = await generateApprovedPlan("Conduct an architecture review of packages/core");
      const registry = createAgentRegistry();
      const coordinator = createBoundedCoordinator({ registry });

      const res = await coordinator.executePlan({ plan });

      expect(res.success).toBe(true);
      if (res.success) {
        const output = formatExecutionSummary(res.data, false);
        expect(output).toContain("TERRARIUM EXECUTION RESULT");
        expect(output).toContain("[STATUS: COMPLETED]");
        expect(output).toContain("EXECUTION STEPS");
        expect(output).toContain("PRESERVED EVIDENCE");
        expect(output).toContain("RESOURCE CONSUMPTION & SPEND");
      }
    });
  });
});
