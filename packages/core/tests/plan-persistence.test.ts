/**
 * @terrarium/core - tests/plan-persistence.test.ts
 *
 * Persistence integration test suite for SqlitePlanRepository.
 */

import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { type TaskPlan, type Task } from "@terrarium/contracts";
import { MigrationRunner } from "../src/persistence/migrations/migration-runner.ts";
import { SqliteTaskRepository } from "../src/persistence/repositories/sqlite-task-repository.ts";
import { SqlitePlanRepository } from "../src/persistence/repositories/sqlite-plan-repository.ts";

describe("SqlitePlanRepository Integration Suite", () => {
  function setupTestDb() {
    const db = new Database(":memory:");
    db.run("PRAGMA foreign_keys = ON;");
    const runner = new MigrationRunner(db);
    runner.runMigrations();
    const taskRepo = new SqliteTaskRepository(db);
    const planRepo = new SqlitePlanRepository(db);
    return { db, taskRepo, planRepo };
  }

  const now = new Date().toISOString();

  function makeSamplePlan(id: string, taskId?: string, overrides: Partial<TaskPlan> = {}): TaskPlan {
    return {
      id,
      taskId,
      rawInput: "Review architecture of contracts package",
      normalizedInput: "Review architecture of contracts package",
      classification: {
        taskType: "architecture_review",
        confidence: 0.9,
        primaryDepartment: "engineering",
        secondaryDepartments: ["research"],
        requiredCapabilities: ["architecture_analysis"],
        expectedOutputs: ["architecture_review_report"],
        projectContext: {
          scope: "module",
          fileTargets: ["packages/contracts"],
        },
        risk: {
          level: "low",
          score: 10,
          factors: ["Read-only inspection"],
          mitigations: [],
          requiresApproval: false,
          sensitiveOperations: [],
        },
        uncertainty: {
          level: "low",
          score: 10,
          reasons: [],
          missingInformation: [],
        },
        isSupported: true,
      },
      steps: [
        {
          id: "step_1",
          stepIndex: 0,
          title: "Inspect Contracts",
          description: "Analyze contracts interfaces",
          department: "engineering",
          candidateCapabilities: ["architecture_analysis"],
          candidateAgentSlugs: ["principal-software-architect"],
          dependsOn: [],
          estimatedTokens: 3000,
          estimatedDurationMs: 4000,
          estimatedCostUsd: 0.03,
          requiresApproval: false,
          completionCriteria: ["Contracts inspected"],
        },
      ],
      budgetEstimate: {
        totalEstimatedTokens: 3000,
        totalEstimatedCostUsd: 0.03,
        estimatedDurationMs: 4000,
        modelTierDistribution: { fast: 0, standard: 1, advanced: 0 },
      },
      selectionRationale: {
        taskTypeRationale: "Architecture review requested",
        departmentRationale: "Engineering department assigned",
        capabilityRationale: "Requires architecture_analysis",
        stepSequenceRationale: "Single step evaluation",
        riskMitigationRationale: "Low risk read-only",
      },
      clarificationQuestions: [],
      completionCriteria: ["Report delivered"],
      status: "ready",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  it("persists a plan without task ID and retrieves it by ID", async () => {
    const { db, planRepo } = setupTestDb();

    const plan = makeSamplePlan("plan_01");
    const createRes = await planRepo.create(plan);
    expect(createRes.success).toBe(true);

    const findRes = await planRepo.findById("plan_01");
    expect(findRes.success).toBe(true);
    if (findRes.success && findRes.data) {
      expect(findRes.data.id).toBe("plan_01");
      expect(findRes.data.classification.taskType).toBe("architecture_review");
      expect(findRes.data.steps.length).toBe(1);
      expect(findRes.data.status).toBe("ready");
    }

    db.close();
  });

  it("links plan to a persisted draft task and retrieves by task ID", async () => {
    const { db, taskRepo, planRepo } = setupTestDb();

    const task: Task = {
      id: "task_01",
      title: "Architecture Review",
      description: "Review architecture",
      department: "engineering",
      status: "draft",
      priority: "medium",
      contextRefs: [],
      expectedDeliverables: ["report"],
      delegationDepth: 0,
      createdAt: now,
      updatedAt: now,
    };

    const taskCreateRes = await taskRepo.create(task);
    expect(taskCreateRes.success).toBe(true);

    const plan = makeSamplePlan("plan_02", "task_01");
    const planCreateRes = await planRepo.create(plan);
    expect(planCreateRes.success).toBe(true);

    const findByTaskRes = await planRepo.findByTaskId("task_01");
    expect(findByTaskRes.success).toBe(true);
    if (findByTaskRes.success && findByTaskRes.data) {
      expect(findByTaskRes.data.id).toBe("plan_02");
      expect(findByTaskRes.data.taskId).toBe("task_01");
    }

    db.close();
  });

  it("filters plans by status, taskType, and riskLevel", async () => {
    const { db, planRepo } = setupTestDb();

    const p1 = makeSamplePlan("p1", undefined, { status: "ready" });
    const p2 = makeSamplePlan("p2", undefined, {
      status: "needs_clarification",
      classification: {
        ...p1.classification,
        taskType: "bug_fix",
        risk: { ...p1.classification.risk, level: "high" },
      },
    });

    await planRepo.create(p1);
    await planRepo.create(p2);

    const filterStatus = await planRepo.list({ status: "needs_clarification" });
    expect(filterStatus.success).toBe(true);
    if (filterStatus.success) {
      expect(filterStatus.data.length).toBe(1);
      expect(filterStatus.data[0]?.id).toBe("p2");
    }

    const filterType = await planRepo.list({ taskType: "bug_fix" });
    expect(filterType.success).toBe(true);
    if (filterType.success) {
      expect(filterType.data.length).toBe(1);
      expect(filterType.data[0]?.id).toBe("p2");
    }

    const filterRisk = await planRepo.list({ riskLevel: "high" });
    expect(filterRisk.success).toBe(true);
    if (filterRisk.success) {
      expect(filterRisk.data.length).toBe(1);
      expect(filterRisk.data[0]?.id).toBe("p2");
    }

    db.close();
  });

  it("updates and deletes a plan", async () => {
    const { db, planRepo } = setupTestDb();

    const plan = makeSamplePlan("p_up");
    await planRepo.create(plan);

    const updated = {
      ...plan,
      status: "approved" as const,
      updatedAt: new Date().toISOString(),
    };

    const updateRes = await planRepo.update(updated);
    expect(updateRes.success).toBe(true);

    const findRes = await planRepo.findById("p_up");
    if (findRes.success && findRes.data) {
      expect(findRes.data.status).toBe("approved");
    }

    const deleteRes = await planRepo.delete("p_up");
    expect(deleteRes.success).toBe(true);

    const findAfterDelete = await planRepo.findById("p_up");
    if (findAfterDelete.success) {
      expect(findAfterDelete.data).toBeNull();
    }

    db.close();
  });
});
