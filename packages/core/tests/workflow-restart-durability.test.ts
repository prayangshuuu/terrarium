/**
 * packages/core/tests/workflow-restart-durability.test.ts
 *
 * Verifies persistence and state recovery across process restarts and engine re-instantiation.
 * Tests SQLite durable state preservation for Tasks, Plans, Approvals, Artifacts, and Reports.
 * Contributed by A3 (Data, Security & Reliability).
 */

import { describe, expect, it, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createCoreEngine } from "../src/index.ts";
import { getDefaultConfig } from "@terrarium/config";

describe("Workflow Restart & Durable State Persistence Suite (A3)", () => {
  const tempDbPaths: string[] = [];

  afterEach(() => {
    for (const p of tempDbPaths) {
      if (existsSync(p)) {
        try {
          unlinkSync(p);
        } catch {}
      }
    }
    tempDbPaths.length = 0;
  });

  it("persists task, plan, approvals, and artifacts across simulated engine crash and restart", async () => {
    const dbPath = join(tmpdir(), `terrarium_restart_test_${randomUUID().slice(0, 8)}.db`);
    tempDbPaths.push(dbPath);

    const baseConfig = getDefaultConfig();
    const config = {
      ...baseConfig,
      paths: {
        ...baseConfig.paths,
        dbPath,
      },
    };

    // -------------------------------------------------------------
    // INSTANCE 1: Initial Engine Run
    // -------------------------------------------------------------
    const engine1 = createCoreEngine({ config, enableDatabase: true });
    expect(engine1.db).toBeDefined();

    // Execute intake and pause at approval
    const runRes = await engine1.workflow.executeWorkflow({
      prompt: "Refactor core authentication interfaces and add JWT verification",
      targetDepartment: "engineering",
      autoApprove: false, // Halts at approval
    });

    expect(runRes.success).toBe(true);
    if (!runRes.success) return;
    const wf1 = runRes.data;
    const taskId = wf1.taskId;
    const planId = wf1.planId;
    const approvalId = wf1.approvalRequestId;

    expect(taskId).toBeDefined();
    expect(planId).toBeDefined();
    expect(approvalId).toBeDefined();

    // Verify written to DB in Instance 1
    const taskBefore = await engine1.db!.tasks.findById(taskId);
    expect(taskBefore.success).toBe(true);
    if (taskBefore.success) {
      expect(taskBefore.data?.id).toBe(taskId);
    }

    // Simulate abrupt crash / shutdown of Instance 1
    await engine1.shutdown();

    // -------------------------------------------------------------
    // INSTANCE 2: Restart Engine from Same SQLite Database File
    // -------------------------------------------------------------
    const engine2 = createCoreEngine({ config, enableDatabase: true });
    expect(engine2.db).toBeDefined();

    // 1. Verify Task survived restart
    const taskAfter = await engine2.db!.tasks.findById(taskId);
    expect(taskAfter.success).toBe(true);
    if (taskAfter.success) {
      expect(taskAfter.data).not.toBeNull();
      expect(taskAfter.data?.id).toBe(taskId);
      expect(taskAfter.data?.title).toContain("authentication");
    }

    // 2. Verify Plan survived restart
    const planAfter = await engine2.db!.plans.findById(planId!);
    expect(planAfter.success).toBe(true);
    if (planAfter.success) {
      expect(planAfter.data).not.toBeNull();
      expect(planAfter.data?.id).toBe(planId);
      expect(planAfter.data?.steps.length).toBeGreaterThan(0);
    }

    // 3. Verify Approval Request survived restart
    const pendingApprovals = await engine2.approvals.listPending(taskId);
    expect(pendingApprovals.success).toBe(true);
    if (pendingApprovals.success) {
      expect(pendingApprovals.data.length).toBeGreaterThan(0);
      expect(pendingApprovals.data[0]?.id).toBe(approvalId);
      expect(pendingApprovals.data[0]?.status).toBe("pending");
    }

    // 4. Grant approval on restarted instance
    const approveRes = await engine2.approvals.approve(approvalId!, "security_lead", "Approved after audit");
    expect(approveRes.success).toBe(true);

    const updatedApproval = await engine2.approvals.get(approvalId!);
    expect(updatedApproval.success).toBe(true);
    if (updatedApproval.success) {
      expect(updatedApproval.data?.status).toBe("approved");
    }

    await engine2.shutdown();
  });

  it("persists completed artifacts and final report across engine restart", async () => {
    const dbPath = join(tmpdir(), `terrarium_report_durability_${randomUUID().slice(0, 8)}.db`);
    tempDbPaths.push(dbPath);

    const baseConfig = getDefaultConfig();
    const config = {
      ...baseConfig,
      paths: {
        ...baseConfig.paths,
        dbPath,
      },
    };

    // Engine 1: run full pipeline to completion
    const engine1 = createCoreEngine({ config, enableDatabase: true });
    const runRes = await engine1.workflow.executeWorkflow({
      prompt: "Generate architectural review of packages/config",
      targetDepartment: "engineering",
      autoApprove: true,
    });

    expect(runRes.success).toBe(true);
    if (!runRes.success) return;
    const taskId = runRes.data.taskId;

    await engine1.shutdown();

    // Engine 2: restart and query artifacts & reports
    const engine2 = createCoreEngine({ config, enableDatabase: true });
    const artifactsRes = await engine2.db!.artifacts.listByTaskId(taskId);
    expect(artifactsRes.success).toBe(true);
    if (artifactsRes.success) {
      expect(artifactsRes.data.length).toBeGreaterThan(0);
    }

    const reportsRes = await engine2.db!.reports.listByTaskId(taskId);
    expect(reportsRes.success).toBe(true);
    if (reportsRes.success) {
      expect(reportsRes.data.length).toBeGreaterThan(0);
      expect(reportsRes.data[0]?.taskId).toBe(taskId);
    }

    await engine2.shutdown();
  });
});
