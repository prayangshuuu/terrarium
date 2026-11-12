/**
 * @terrarium/core - intake/plan-formatter.ts
 *
 * Rich terminal and Markdown presentation formatters for inspectable plans.
 * Aligns with PLAN.md Section 5.1 (Activation Policy), Section 14 (CLI / TUI),
 * and Prompt 7 requirements (A5 - plan readability).
 */

import { type ClarificationQuestion, type PlanStep, type TaskPlan } from "@terrarium/contracts";

export interface FormatPlanOptions {
  readonly useColor?: boolean;
  readonly includeRationale?: boolean;
}

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

function colorize(text: string, color: string, useColor = true): string {
  return useColor ? `${color}${text}${ANSI.reset}` : text;
}

function getStatusBadge(status: TaskPlan["status"], useColor = true): string {
  switch (status) {
    case "ready":
      return colorize("[PLAN READY]", ANSI.green + ANSI.bold, useColor);
    case "needs_clarification":
      return colorize("[NEEDS CLARIFICATION]", ANSI.yellow + ANSI.bold, useColor);
    case "rejected":
      return colorize("[REJECTED / UNSUPPORTED]", ANSI.red + ANSI.bold, useColor);
    case "approved":
      return colorize("[APPROVED]", ANSI.cyan + ANSI.bold, useColor);
    case "draft":
    default:
      return colorize("[DRAFT]", ANSI.dim, useColor);
  }
}

function getRiskBadge(level: string, useColor = true): string {
  switch (level) {
    case "critical":
      return colorize(`[RISK: CRITICAL]`, ANSI.red + ANSI.bold, useColor);
    case "high":
      return colorize(`[RISK: HIGH]`, ANSI.red, useColor);
    case "medium":
      return colorize(`[RISK: MEDIUM]`, ANSI.yellow, useColor);
    case "low":
    default:
      return colorize(`[RISK: LOW]`, ANSI.green, useColor);
  }
}

function getUncertaintyBadge(level: string, useColor = true): string {
  switch (level) {
    case "high":
      return colorize(`[UNCERTAINTY: HIGH]`, ANSI.yellow + ANSI.bold, useColor);
    case "medium":
      return colorize(`[UNCERTAINTY: MEDIUM]`, ANSI.yellow, useColor);
    case "low":
    default:
      return colorize(`[UNCERTAINTY: LOW]`, ANSI.dim, useColor);
  }
}

/**
 * Formats an inspectable plan for terminal output with ANSI styling and clear visual hierarchy.
 */
export function formatPlanTerminal(plan: TaskPlan, options: FormatPlanOptions = {}): string {
  const useColor = options.useColor ?? true;
  const includeRationale = options.includeRationale ?? true;
  const lines: string[] = [];

  const divider = "─".repeat(78);
  lines.push(divider);
  lines.push(
    `${colorize("TERRARIUM TASK PLAN", ANSI.bold + ANSI.cyan, useColor)}  ${getStatusBadge(
      plan.status,
      useColor
    )}  ${getRiskBadge(plan.classification.risk.level, useColor)}  ${getUncertaintyBadge(
      plan.classification.uncertainty.level,
      useColor
    )}`
  );
  lines.push(divider);

  // Summary Metadata
  lines.push(`${colorize("Plan ID:", ANSI.dim, useColor)}         ${plan.id}`);
  if (plan.taskId) {
    lines.push(`${colorize("Draft Task ID:", ANSI.dim, useColor)}   ${plan.taskId}`);
  }
  lines.push(`${colorize("Task Type:", ANSI.dim, useColor)}       ${plan.classification.taskType}`);
  lines.push(
    `${colorize("Department:", ANSI.dim, useColor)}      ${plan.classification.primaryDepartment}` +
      (plan.classification.secondaryDepartments.length > 0
        ? ` (secondary: ${plan.classification.secondaryDepartments.join(", ")})`
        : "")
  );
  lines.push(`${colorize("Target Scope:", ANSI.dim, useColor)}    ${plan.classification.projectContext.scope}`);
  if (plan.classification.projectContext.fileTargets?.length) {
    lines.push(
      `${colorize("File Targets:", ANSI.dim, useColor)}    ${plan.classification.projectContext.fileTargets.join(", ")}`
    );
  }
  lines.push(
    `${colorize("Deliverables:", ANSI.dim, useColor)}    ${plan.classification.expectedOutputs.join(", ")}`
  );
  if (plan.classification.risk.level !== "low" && plan.classification.risk.factors.length > 0) {
    lines.push(
      `${colorize("Risk Factors:", ANSI.dim, useColor)}   ${plan.classification.risk.factors.join("; ")}`
    );
  }

  // Clarification Questions (if any)
  if (plan.clarificationQuestions.length > 0) {
    lines.push("");
    lines.push(
      colorize("── MISSING FACTS & CLARIFICATION REQUIRED ────────────────────────────", ANSI.yellow, useColor)
    );
    for (const q of plan.clarificationQuestions) {
      const critBadge =
        q.criticality === "blocking"
          ? colorize("[BLOCKING]", ANSI.red + ANSI.bold, useColor)
          : colorize("[ADVISORY]", ANSI.dim, useColor);
      lines.push(`${critBadge} (${q.id}) ${colorize(q.question, ANSI.bold, useColor)}`);
      lines.push(`  ${colorize("Rationale:", ANSI.dim, useColor)} ${q.rationale}`);
      if (q.suggestedOptions?.length) {
        lines.push(`  ${colorize("Options:", ANSI.dim, useColor)}`);
        for (const opt of q.suggestedOptions) {
          lines.push(`    • ${opt}`);
        }
      }
    }
  }

  // Execution Steps & DAG
  lines.push("");
  lines.push(colorize("── PROPOSED EXECUTION STEPS (DAG) ───────────────────────────────────", ANSI.cyan, useColor));

  if (plan.steps.length === 0) {
    lines.push(`  ${colorize("(No execution steps generated)", ANSI.dim, useColor)}`);
    if (plan.classification.unsupportedReason) {
      lines.push(`  ${colorize("Reason:", ANSI.red, useColor)} ${plan.classification.unsupportedReason}`);
    }
  } else {
    for (const step of plan.steps) {
      const stepNum = `${step.stepIndex + 1}.`;
      const depInfo =
        step.dependsOn.length > 0
          ? colorize(`[depends on: ${step.dependsOn.join(", ")}]`, ANSI.dim, useColor)
          : colorize(`[initial step]`, ANSI.green, useColor);

      lines.push(`\n${colorize(stepNum, ANSI.bold, useColor)} ${colorize(step.title, ANSI.bold, useColor)} ${depInfo}`);
      lines.push(`   ${step.description}`);
      lines.push(
        `   ${colorize("Department:", ANSI.dim, useColor)} ${step.department}  |  ${colorize(
          "Candidates:",
          ANSI.dim,
          useColor
        )} ${step.candidateAgentSlugs.join(", ") || "none resolved"}`
      );
      lines.push(
        `   ${colorize("Est. Budget:", ANSI.dim, useColor)} ~${step.estimatedTokens.toLocaleString()} tokens  |  ~$${step.estimatedCostUsd.toFixed(
          3
        )}  |  ~${Math.round(step.estimatedDurationMs / 1000)}s`
      );

      if (step.requiresApproval) {
        lines.push(
          `   ${colorize("[GATE] APPROVAL GATE REQUIRED:", ANSI.yellow + ANSI.bold, useColor)} ${
            step.approvalReason ?? "User authorization required"
          }`
        );
      }

      if (step.completionCriteria.length > 0) {
        lines.push(`   ${colorize("Completion Criteria:", ANSI.dim, useColor)}`);
        for (const cc of step.completionCriteria) {
          lines.push(`     • ${cc}`);
        }
      }
    }
  }

  // Budget Estimate Summary
  lines.push("");
  lines.push(colorize("── RESOURCE & BUDGET ESTIMATE ─────────────────────────────────────────", ANSI.cyan, useColor));
  const b = plan.budgetEstimate;
  lines.push(
    `  Total Tokens:   ~${b.totalEstimatedTokens.toLocaleString()} tokens\n` +
      `  Estimated Cost: ~$${b.totalEstimatedCostUsd.toFixed(3)} USD\n` +
      `  Duration:       ~${Math.round(b.estimatedDurationMs / 1000)}s\n` +
      `  Model Routing:  Fast: ${b.modelTierDistribution.fast} | Standard: ${b.modelTierDistribution.standard} | Advanced: ${b.modelTierDistribution.advanced}`
  );

  // Selection Rationale
  if (includeRationale) {
    lines.push("");
    lines.push(colorize("── SELECTION RATIONALE ─────────────────────────────────────────────────", ANSI.dim, useColor));
    lines.push(`  • Task Type:   ${plan.selectionRationale.taskTypeRationale}`);
    lines.push(`  • Department:  ${plan.selectionRationale.departmentRationale}`);
    lines.push(`  • Capability:  ${plan.selectionRationale.capabilityRationale}`);
    lines.push(`  • Sequence:    ${plan.selectionRationale.stepSequenceRationale}`);
    lines.push(`  • Safety Gate: ${plan.selectionRationale.riskMitigationRationale}`);
  }

  lines.push(divider);
  return lines.join("\n");
}

/**
 * Formats an inspectable plan into GitHub Flavored Markdown suitable for file export or web Studio.
 */
export function formatPlanMarkdown(plan: TaskPlan): string {
  const lines: string[] = [];

  lines.push(`# Terrarium Task Plan: ${plan.classification.taskType}\n`);
  lines.push(`- **Plan ID:** \`${plan.id}\``);
  if (plan.taskId) {
    lines.push(`- **Draft Task ID:** \`${plan.taskId}\``);
  }
  lines.push(`- **Status:** \`${plan.status}\``);
  lines.push(`- **Primary Department:** \`${plan.classification.primaryDepartment}\``);
  lines.push(`- **Risk Level:** \`${plan.classification.risk.level}\` (Score: ${plan.classification.risk.score}/100)`);
  lines.push(
    `- **Uncertainty Level:** \`${plan.classification.uncertainty.level}\` (Score: ${plan.classification.uncertainty.score}/100)\n`
  );

  if (plan.classification.risk.requiresApproval) {
    lines.push(`> [!WARNING]`);
    lines.push(`> **Approval Gate Required:** ${plan.selectionRationale.riskMitigationRationale}\n`);
  }

  if (plan.clarificationQuestions.length > 0) {
    lines.push(`## Clarification Required\n`);
    for (const q of plan.clarificationQuestions) {
      lines.push(`### ${q.criticality === "blocking" ? "[BLOCKING]" : "[ADVISORY]"} ${q.question}`);
      lines.push(`- **ID:** \`${q.id}\``);
      lines.push(`- **Rationale:** ${q.rationale}`);
      if (q.suggestedOptions?.length) {
        lines.push(`- **Suggested Options:**`);
        for (const opt of q.suggestedOptions) {
          lines.push(`  - ${opt}`);
        }
      }
      lines.push("");
    }
  }

  // Mermaid DAG
  if (plan.steps.length > 0) {
    lines.push(`## Execution Flow (Mermaid DAG)\n`);
    lines.push("```mermaid");
    lines.push("flowchart TD");
    for (const step of plan.steps) {
      const label = `"${step.stepIndex + 1}. ${step.title} (${step.department})"`;
      lines.push(`  ${step.id}[${label}]`);
    }
    for (const step of plan.steps) {
      for (const dep of step.dependsOn) {
        lines.push(`  ${dep} --> ${step.id}`);
      }
    }
    lines.push("```\n");
  }

  // Steps Table
  lines.push(`## Execution Steps\n`);
  if (plan.steps.length === 0) {
    lines.push(`*No execution steps generated.* ${plan.classification.unsupportedReason ?? ""}\n`);
  } else {
    for (const step of plan.steps) {
      lines.push(`### Step ${step.stepIndex + 1}: ${step.title}\n`);
      lines.push(`- **Department:** \`${step.department}\``);
      lines.push(`- **Candidate Profiles:** ${step.candidateAgentSlugs.map((s) => `\`${s}\``).join(", ") || "None"}`);
      lines.push(
        `- **Estimate:** ~${step.estimatedTokens.toLocaleString()} tokens | ~$${step.estimatedCostUsd.toFixed(
          3
        )} | ~${Math.round(step.estimatedDurationMs / 1000)}s`
      );
      lines.push(`- **Description:** ${step.description}`);
      if (step.requiresApproval) {
        lines.push(`- **Approval Required:** ${step.approvalReason}`);
      }
      lines.push(`- **Completion Criteria:**`);
      for (const cc of step.completionCriteria) {
        lines.push(`  - ${cc}`);
      }
      lines.push("");
    }
  }

  // Budget
  lines.push(`## Budget Estimate\n`);
  lines.push(`| Metric | Estimate |`);
  lines.push(`| :--- | :--- |`);
  lines.push(`| **Total Tokens** | ~${plan.budgetEstimate.totalEstimatedTokens.toLocaleString()} tokens |`);
  lines.push(`| **Estimated Cost** | ~$${plan.budgetEstimate.totalEstimatedCostUsd.toFixed(3)} USD |`);
  lines.push(`| **Estimated Duration** | ~${Math.round(plan.budgetEstimate.estimatedDurationMs / 1000)} seconds |`);
  lines.push(
    `| **Model Tiers** | Fast: ${plan.budgetEstimate.modelTierDistribution.fast}, Standard: ${plan.budgetEstimate.modelTierDistribution.standard}, Advanced: ${plan.budgetEstimate.modelTierDistribution.advanced} |\n`
  );

  // Rationale
  lines.push(`## Selection Rationale\n`);
  lines.push(`- **Task Type:** ${plan.selectionRationale.taskTypeRationale}`);
  lines.push(`- **Department:** ${plan.selectionRationale.departmentRationale}`);
  lines.push(`- **Capabilities:** ${plan.selectionRationale.capabilityRationale}`);
  lines.push(`- **Step Sequencing:** ${plan.selectionRationale.stepSequenceRationale}`);
  lines.push(`- **Risk & Approvals:** ${plan.selectionRationale.riskMitigationRationale}\n`);

  return lines.join("\n");
}
