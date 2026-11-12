/**
 * apps/cli/tests/workflow-cli.test.ts
 *
 * Integration test suite for CLI workflow command handlers.
 * Contributed by A5 (Senior Frontend/Product Interface Designer & Developer).
 */

import { describe, expect, it } from "bun:test";
import { createCoreEngine } from "@terrarium/core";
import {
  handleWorkflowRun,
  handleWorkflowResume,
  handleWorkflowStatus,
  handleWorkflowList,
} from "../src/commands/workflow-commands.ts";

describe("CLI End-to-End Workflow Commands Suite (A5)", () => {
  it("executes workflow run command and outputs formatted summary card", async () => {
    const engine = createCoreEngine();
    const res = await handleWorkflowRun(
      engine,
      "Perform architecture review of contracts and core",
      { autoApprove: true }
    );

    expect(res.success).toBe(true);
    expect(res.data).toContain("TERRARIUM END-TO-END WORKFLOW PIPELINE");
    expect(res.data).toContain("Status:    [COMPLETED]");
    expect(res.data).toContain("Stage:     completed");
    expect(res.data).toContain("ORCHESTRATION METRICS:");
    expect(res.data).toContain("DELIVERABLES & ARTIFACTS");
    expect(res.data).toContain("FINAL SYNTHESIZED REPORT");
  });

  it("outputs structured JSON when --json flag is provided", async () => {
    const engine = createCoreEngine();
    const res = await handleWorkflowRun(
      engine,
      "Conduct architecture and dependency analysis across package manifests in the repository",
      { autoApprove: true, json: true }
    );

    expect(res.success).toBe(true);
    const parsed = JSON.parse(res.data);
    expect(parsed.id).toBeDefined();
    expect(parsed.status).toBe("completed");
    expect(parsed.stage).toBe("completed");
    expect(parsed.dormantProfilesVerified).toBe(true);
    expect(parsed.metrics.stepsCompleted).toBeGreaterThan(0);
  });

  it("pauses at approval gate and resumes via CLI command", async () => {
    const engine = createCoreEngine();

    // 1. Initial run pausing at approval
    const runRes = await handleWorkflowRun(
      engine,
      "Modify database schema and execute migration",
      { autoApprove: false, json: true }
    );

    expect(runRes.success).toBe(true);
    const parsedInitial = JSON.parse(runRes.data);
    expect(parsedInitial.stage).toBe("approval");
    expect(parsedInitial.status).toBe("waiting_for_approval");
    const workflowId = parsedInitial.id;

    // 2. Check workflow status
    const statusRes = await handleWorkflowStatus(engine, workflowId);
    expect(statusRes.success).toBe(true);
    expect(statusRes.data).toContain("Stage=[approval]");

    // 3. Resume with approval
    const resumeRes = await handleWorkflowResume(engine, workflowId, true);
    expect(resumeRes.success).toBe(true);
    expect(resumeRes.data).toContain("Status: [COMPLETED]");

    // 4. Verify in workflow list
    const listRes = await handleWorkflowList(engine);
    expect(listRes.success).toBe(true);
    expect(listRes.data).toContain("RECENT END-TO-END WORKFLOWS:");
    expect(listRes.data).toContain(workflowId);
  });

  it("returns error message when prompt is empty", async () => {
    const engine = createCoreEngine();
    const res = await handleWorkflowRun(engine, "   ");
    expect(res.success).toBe(false);
    expect(res.data).toContain("cannot be empty");
  });
});
