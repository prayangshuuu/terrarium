/**
 * apps/cli/src/commands/workflow-commands.ts
 *
 * CLI command handlers for end-to-end multi-agent workflows.
 * Supports: `workflow run`, `workflow status`, `workflow resume`, and `workflow list`.
 * Contributed by A5 (Senior Frontend/Product Interface Designer & Developer).
 */

import { type CoreEngine } from "@terrarium/core";
import { type WorkflowExecutionRecord, type WorkflowStage } from "@terrarium/contracts";

export interface WorkflowCliOptions {
  readonly json?: boolean;
  readonly autoApprove?: boolean;
  readonly budget?: number;
  readonly timeoutMs?: number;
  readonly department?: string;
  readonly quiet?: boolean;
}

export interface CliCommandResult {
  readonly success: boolean;
  readonly data: string;
}

/**
 * Executes a complete end-to-end workflow from CLI prompt.
 */
export async function handleWorkflowRun(
  engine: CoreEngine,
  prompt: string,
  options: WorkflowCliOptions = {}
): Promise<CliCommandResult> {
  if (!prompt || prompt.trim().length === 0) {
    return {
      success: false,
      data: "Error: Workflow prompt cannot be empty. Please provide a clear instruction.",
    };
  }

  const stageProgress: WorkflowStage[] = [];

  const res = await engine.workflow.executeWorkflow(
    {
      prompt,
      autoApprove: options.autoApprove ?? true,
      budgetLimitUsd: options.budget,
      timeoutMs: options.timeoutMs,
      targetDepartment: options.department as any,
    },
    {
      onStageChange: (stage) => {
        stageProgress.push(stage);
      },
    }
  );

  if (!res.success) {
    return {
      success: false,
      data: `Workflow execution failed: ${res.error.message}`,
    };
  }

  const record = res.data;

  if (options.json) {
    return {
      success: true,
      data: JSON.stringify(record, null, 2),
    };
  }

  const lines: string[] = [];
  lines.push("┌─────────────────────────────────────────────────────────────┐");
  lines.push(`│ TERRARIUM END-TO-END WORKFLOW PIPELINE                      │`);
  lines.push("└─────────────────────────────────────────────────────────────┘");
  lines.push("");
  lines.push(`  Prompt:    ${record.prompt}`);
  lines.push(`  Status:    [${record.status.toUpperCase()}]`);
  lines.push(`  Stage:     ${record.stage}`);
  lines.push(`  Workflow:  ${record.id}`);
  lines.push(`  Task ID:   ${record.taskId}`);
  lines.push("");
  lines.push(`  LIFECYCLE TRANSITIONS:`);
  lines.push(`  ${stageProgress.map((s) => `[${s}]`).join(" -> ")}`);
  lines.push("");

  if (record.stage === "approval") {
    lines.push("  [GATE] WORKFLOW PAUSED AT APPROVAL GATE");
    lines.push(`  Approval Request ID: ${record.approvalRequestId}`);
    lines.push("  Run 'terrarium workflow resume <id> --approve' to proceed.");
    lines.push("");
  }

  if (record.error) {
    lines.push(`  [FAIL] ERROR (${record.error.code}): ${record.error.message}`);
    if (record.error.failureMode) {
      lines.push(`  Failure Mode: ${record.error.failureMode}`);
    }
    lines.push("");
  }

  lines.push("  ORCHESTRATION METRICS:");
  lines.push(`  • Duration:        ${record.metrics.durationMs}ms`);
  lines.push(`  • Steps Completed: ${record.metrics.stepsCompleted} of ${record.metrics.stepsTotal}`);
  lines.push(`  • Total Tokens:    ${record.metrics.totalTokens.toLocaleString()}`);
  lines.push(`  • Estimated Cost:  $${record.metrics.totalCostUsd.toFixed(4)} USD`);
  lines.push(`  • Dormancy Proof:  ${record.dormantProfilesVerified ? "VERIFIED (dormant profiles isolated)" : "UNVERIFIED"}`);
  lines.push("");

  if (record.artifacts.length > 0) {
    lines.push(`  DELIVERABLES & ARTIFACTS (${record.artifacts.length}):`);
    for (const art of record.artifacts) {
      lines.push(`  • [${art.artifactType.toUpperCase()}] ${art.title} (${art.path})`);
    }
    lines.push("");
  }

  if (record.report) {
    lines.push("  FINAL SYNTHESIZED REPORT:");
    lines.push(`  Title:   ${record.report.title}`);
    lines.push(`  Summary: ${record.report.summary.slice(0, 150)}...`);
    lines.push("");
  }

  return {
    success: record.status !== "failed",
    data: lines.join("\n"),
  };
}

/**
 * Resumes a workflow waiting for approval.
 */
export async function handleWorkflowResume(
  engine: CoreEngine,
  workflowId: string,
  approve: boolean,
  options: WorkflowCliOptions = {}
): Promise<CliCommandResult> {
  const decision = approve ? "approved" : "rejected";
  const res = await engine.workflow.resumeWorkflow(
    workflowId,
    decision,
    "cli_operator",
    approve ? "Approved via CLI" : "Rejected via CLI"
  );

  if (!res.success) {
    return {
      success: false,
      data: `Failed to resume workflow: ${res.error.message}`,
    };
  }

  const record = res.data;
  if (options.json) {
    return {
      success: true,
      data: JSON.stringify(record, null, 2),
    };
  }

  return {
    success: record.status !== "failed",
    data: `Workflow ${record.id} resumed. Status: [${record.status.toUpperCase()}]. Stage: ${record.stage}.`,
  };
}

/**
 * Inspects status of an existing workflow.
 */
export async function handleWorkflowStatus(
  engine: CoreEngine,
  workflowId: string,
  options: WorkflowCliOptions = {}
): Promise<CliCommandResult> {
  const record = await engine.workflow.getWorkflow(workflowId);
  if (!record) {
    return {
      success: false,
      data: `Workflow '${workflowId}' not found.`,
    };
  }

  if (options.json) {
    return {
      success: true,
      data: JSON.stringify(record, null, 2),
    };
  }

  return {
    success: true,
    data: `Workflow ${record.id}: Stage=[${record.stage}] Status=[${record.status}] Steps=${record.metrics.stepsCompleted}/${record.metrics.stepsTotal}`,
  };
}

/**
 * Lists executed workflows.
 */
export async function handleWorkflowList(
  engine: CoreEngine,
  options: WorkflowCliOptions = {}
): Promise<CliCommandResult> {
  const list = await engine.workflow.listWorkflows();

  if (options.json) {
    return {
      success: true,
      data: JSON.stringify(list, null, 2),
    };
  }

  if (list.length === 0) {
    return {
      success: true,
      data: "No workflows have been executed yet.",
    };
  }

  const lines: string[] = [];
  lines.push("RECENT END-TO-END WORKFLOWS:");
  for (const wf of list) {
    lines.push(`• [${wf.status.toUpperCase()}] ${wf.id} - ${wf.prompt.slice(0, 45)} (Stage: ${wf.stage})`);
  }

  return {
    success: true,
    data: lines.join("\n"),
  };
}
