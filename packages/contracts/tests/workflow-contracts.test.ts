/**
 * packages/contracts/tests/workflow-contracts.test.ts
 *
 * Unit tests for end-to-end workflow contracts, stage transitions, and validators.
 * Contributed by A1 (Platform & Architecture).
 */

import { describe, expect, it } from "bun:test";
import {
  WORKFLOW_STAGES,
  WORKFLOW_FAILURE_MODES,
  assertWorkflowStageTransition,
  validateWorkflowRequest,
  validateWorkflowRecord,
  WorkflowError,
  InvalidStateTransitionError,
} from "../src/index.ts";

describe("Workflow Contracts & State Transitions Suite (A1)", () => {
  it("defines all canonical workflow stages in sequential order", () => {
    expect(WORKFLOW_STAGES).toContain("intake");
    expect(WORKFLOW_STAGES).toContain("planning");
    expect(WORKFLOW_STAGES).toContain("approval");
    expect(WORKFLOW_STAGES).toContain("execution");
    expect(WORKFLOW_STAGES).toContain("artifacts");
    expect(WORKFLOW_STAGES).toContain("reporting");
    expect(WORKFLOW_STAGES).toContain("completed");
    expect(WORKFLOW_STAGES).toContain("failed");
    expect(WORKFLOW_STAGES).toContain("cancelled");
  });

  it("defines all failure modes required for reliability testing", () => {
    expect(WORKFLOW_FAILURE_MODES).toContain("cancellation");
    expect(WORKFLOW_FAILURE_MODES).toContain("timeout");
    expect(WORKFLOW_FAILURE_MODES).toContain("provider_outage");
    expect(WORKFLOW_FAILURE_MODES).toContain("rate_limit");
    expect(WORKFLOW_FAILURE_MODES).toContain("malformed_output");
    expect(WORKFLOW_FAILURE_MODES).toContain("budget_exhaustion");
    expect(WORKFLOW_FAILURE_MODES).toContain("permission_denial");
    expect(WORKFLOW_FAILURE_MODES).toContain("partial_completion");
  });

  it("validates legal stage transitions", () => {
    expect(() => assertWorkflowStageTransition("intake", "planning")).not.toThrow();
    expect(() => assertWorkflowStageTransition("planning", "approval")).not.toThrow();
    expect(() => assertWorkflowStageTransition("planning", "execution")).not.toThrow();
    expect(() => assertWorkflowStageTransition("approval", "execution")).not.toThrow();
    expect(() => assertWorkflowStageTransition("execution", "artifacts")).not.toThrow();
    expect(() => assertWorkflowStageTransition("artifacts", "reporting")).not.toThrow();
    expect(() => assertWorkflowStageTransition("reporting", "completed")).not.toThrow();

    // Any stage can transition to failed or cancelled
    expect(() => assertWorkflowStageTransition("intake", "failed")).not.toThrow();
    expect(() => assertWorkflowStageTransition("execution", "cancelled")).not.toThrow();
  });

  it("throws InvalidStateTransitionError on illegal stage transitions", () => {
    expect(() => assertWorkflowStageTransition("completed", "intake")).toThrow(InvalidStateTransitionError);
    expect(() => assertWorkflowStageTransition("failed", "execution")).toThrow(InvalidStateTransitionError);
    expect(() => assertWorkflowStageTransition("intake", "artifacts")).toThrow(InvalidStateTransitionError);
  });

  it("validates a compliant WorkflowRequest", () => {
    const res = validateWorkflowRequest({
      prompt: "Perform security audit on packages/core and generate report",
      targetDepartment: "engineering",
      autoApprove: false,
      budgetLimitUsd: 2.5,
      timeoutMs: 30000,
      contextFiles: ["packages/core/src/index.ts"],
      simulatedPersonas: ["security_officer"],
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.prompt).toContain("security audit");
      expect(res.data.targetDepartment).toBe("engineering");
      expect(res.data.budgetLimitUsd).toBe(2.5);
    }
  });

  it("rejects invalid WorkflowRequest with empty prompt or negative budget", () => {
    const res = validateWorkflowRequest({
      prompt: "ab",
      budgetLimitUsd: -5,
    });

    expect(res.success).toBe(false);
  });

  it("validates a compliant WorkflowExecutionRecord", () => {
    const now = new Date().toISOString();
    const res = validateWorkflowRecord({
      id: "wf_123456",
      prompt: "Review architecture",
      stage: "completed",
      status: "completed",
      taskId: "task_123",
      dormantProfilesVerified: true,
      activeProfileSlugs: ["staff_architect"],
      dormantProfileSlugs: ["marketing_specialist", "sales_lead"],
      startedAt: now,
      createdAt: now,
      updatedAt: now,
      artifacts: [],
      metrics: {
        totalTokens: 1200,
        totalCostUsd: 0.0036,
        durationMs: 850,
        stepsCompleted: 2,
        stepsTotal: 2,
      },
    });

    expect(res.success).toBe(true);
  });

  it("instantiates strongly typed WorkflowError with stage and workflowId", () => {
    const err = new WorkflowError("Workflow step execution failed", "wf_abc", "execution", {
      reason: "budget_exceeded",
    });
    expect(err.code).toBe("WORKFLOW_ERROR");
    expect(err.workflowId).toBe("wf_abc");
    expect(err.stage).toBe("execution");
    expect(err.message).toContain("failed");
  });
});
