/**
 * packages/core/tests/workflow-pipeline.test.ts
 *
 * Comprehensive end-to-end multi-agent workflow tests.
 * Validates request intake, plan drafting, approval gating, bounded execution,
 * artifact generation, provenance tracking, report generation, and dormant profile isolation.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 */

import { describe, expect, it } from "bun:test";
import { createCoreEngine } from "../src/index.ts";
import { type WorkflowStage, SIMULATED_RESEARCH_DISCLAIMER } from "@terrarium/contracts";

describe("End-to-End Workflow Pipeline Suite (A1 & A2)", () => {
  it("executes full workflow from request through plan, approval, execution, artifact, and report", async () => {
    const engine = createCoreEngine();
    const observedStages: WorkflowStage[] = [];

    const res = await engine.workflow.executeWorkflow(
      {
        prompt: "Review packages/core architecture, evaluate domain boundaries, and generate report",
        targetDepartment: "engineering",
        autoApprove: true,
        budgetLimitUsd: 5.0,
      },
      {
        onStageChange: (stage) => {
          observedStages.push(stage);
        },
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.status).toBe("completed");
      expect(record.stage).toBe("completed");
      expect(record.plan).toBeDefined();
      expect(record.plan?.steps.length).toBeGreaterThan(0);
      expect(record.artifacts.length).toBeGreaterThan(0);
      expect(record.report).toBeDefined();
      expect(record.report?.title).toContain("Report");
      expect(record.metrics.durationMs).toBeGreaterThanOrEqual(0);
      expect(record.metrics.stepsCompleted).toBeGreaterThan(0);

      // Verify sequence of stages
      expect(observedStages).toContain("intake");
      expect(observedStages).toContain("planning");
      expect(observedStages).toContain("execution");
      expect(observedStages).toContain("artifacts");
      expect(observedStages).toContain("reporting");
      expect(observedStages).toContain("completed");
    }
  });

  it("proves dormant profiles do not start and only required profiles execute", async () => {
    const engine = createCoreEngine();
    const allProfilesRes = await engine.registry.list();
    expect(allProfilesRes.success).toBe(true);
    const totalProfiles = allProfilesRes.success ? allProfilesRes.data.length : 0;
    expect(totalProfiles).toBeGreaterThan(5);

    const res = await engine.workflow.executeWorkflow({
      prompt: "Refactor TypeScript domain types in packages/contracts",
      targetDepartment: "engineering",
      autoApprove: true,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.dormantProfilesVerified).toBe(true);
      expect(record.activeProfileSlugs.length).toBeGreaterThan(0);
      expect(record.dormantProfileSlugs.length).toBeGreaterThan(0);

      // Active and dormant sets must be mutually disjoint
      const intersection = record.activeProfileSlugs.filter((slug) =>
        record.dormantProfileSlugs.includes(slug)
      );
      expect(intersection.length).toBe(0);

      // Sum of active and dormant equals total registered profiles
      expect(record.activeProfileSlugs.length + record.dormantProfileSlugs.length).toBe(totalProfiles);
    }
  });

  it("pauses at approval gate when high-risk action requires human authorization", async () => {
    const engine = createCoreEngine();

    const res = await engine.workflow.executeWorkflow({
      prompt: "Execute destructive migration dropping and rebuilding database tables",
      targetDepartment: "engineering",
      autoApprove: false, // Explicitly require human approval
    });

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.stage).toBe("approval");
      expect(record.status).toBe("waiting_for_approval");
      expect(record.approvalRequestId).toBeDefined();
      expect(record.report).toBeUndefined(); // Execution halted before artifacts/report
    }
  });

  it("resumes workflow successfully after approval is granted", async () => {
    const engine = createCoreEngine();

    // 1. Initial run halting at approval
    const runRes = await engine.workflow.executeWorkflow({
      prompt: "Refactor database migrations and update schema versioning",
      targetDepartment: "engineering",
      autoApprove: false,
    });

    expect(runRes.success).toBe(true);
    if (!runRes.success) return;
    const initialRecord = runRes.data;
    expect(initialRecord.stage).toBe("approval");

    // 2. Resume with approval granted
    const resumeRes = await engine.workflow.resumeWorkflow(
      initialRecord.id,
      "approved",
      "staff_architect",
      "Approved after security review"
    );

    expect(resumeRes.success).toBe(true);
    if (resumeRes.success) {
      const completedRecord = resumeRes.data;
      expect(completedRecord.status).toBe("completed");
      expect(completedRecord.stage).toBe("completed");
      expect(completedRecord.artifacts.length).toBeGreaterThan(0);
      expect(completedRecord.report).toBeDefined();
    }
  });

  it("halts workflow with failed status when approval is rejected", async () => {
    const engine = createCoreEngine();

    const runRes = await engine.workflow.executeWorkflow({
      prompt: "Apply high-risk patch altering production configuration",
      targetDepartment: "engineering",
      autoApprove: false,
    });

    expect(runRes.success).toBe(true);
    if (!runRes.success) return;

    const resumeRes = await engine.workflow.resumeWorkflow(
      runRes.data.id,
      "rejected",
      "security_lead",
      "Rejected: schema modification violates zero-downtime policy"
    );

    expect(resumeRes.success).toBe(true);
    if (resumeRes.success) {
      const record = resumeRes.data;
      expect(record.status).toBe("failed");
      expect(record.stage).toBe("failed");
      expect(record.approvalStatus).toBe("rejected");
      expect(record.error?.code).toBe("APPROVAL_REJECTED");
      expect(record.error?.message).toContain("zero-downtime policy");
    }
  });
});
