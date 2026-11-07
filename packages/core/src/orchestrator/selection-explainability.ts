/**
 * @terrarium/core - orchestrator/selection-explainability.ts
 *
 * Presentation formatters for selection decisions, dormancy proofs, and execution outcomes.
 * Aligns with PLAN.md Section 5.1 & Prompt 8 requirements (A5 - selection explainability).
 */

import { type OrchestrationResult } from "@terrarium/contracts";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

function colorize(text: string, color: string, useColor = true): string {
  return useColor ? `${color}${text}${ANSI.reset}` : text;
}

/**
 * Formats a comprehensive selection explainability report proving demand-based activation.
 */
export function formatSelectionExplainability(
  result: OrchestrationResult,
  useColor = true
): string {
  const lines: string[] = [];
  const divider = "─".repeat(78);

  lines.push(divider);
  lines.push(
    `${colorize("TERRARIUM DEMAND-BASED SELECTION AUDIT", ANSI.bold + ANSI.cyan, useColor)}`
  );
  lines.push(divider);

  // Activation vs Dormancy summary
  const activeCount = result.activeProfiles.length;
  const dormantCount = result.dormantProfiles.length;
  const totalCount = activeCount + dormantCount;
  const dormancyPct = totalCount > 0 ? ((dormantCount / totalCount) * 100).toFixed(0) : "100";

  lines.push(
    `Virtual Organization Catalog: ${totalCount} registered profiles\n` +
      `  • Activated Profiles: ${colorize(String(activeCount), ANSI.green + ANSI.bold, useColor)} (instantiated on demand)\n` +
      `  • Dormant Profiles:   ${colorize(String(dormantCount), ANSI.dim, useColor)} (${dormancyPct}% remained dormant with 0 compute/token spend)`
  );

  lines.push("");
  lines.push(colorize("── STEP-BY-STEP SELECTION RATIONALE ──────────────────────────────────", ANSI.cyan, useColor));

  for (const decision of result.selectionDecisions) {
    const step = result.plan.steps.find((s) => s.id === decision.stepId);
    const stepTitle = step ? step.title : decision.stepId;

    lines.push(`\n${colorize(`Step [${decision.stepId}]:`, ANSI.bold, useColor)} ${stepTitle}`);
    lines.push(`  ${colorize("Chosen Agent:", ANSI.green, useColor)} ${decision.selectedProfile.displayName}`);
    lines.push(`  ${colorize("Department:", ANSI.dim, useColor)}   ${decision.selectedProfile.department} (${decision.selectedProfile.role})`);
    lines.push(`  ${colorize("Model Tier:", ANSI.dim, useColor)}   ${decision.selectedProfile.modelPreference.tier} (${decision.selectedProfile.modelPreference.preferredModel})`);
    lines.push(`  ${colorize("Rationale:", ANSI.dim, useColor)}    ${decision.rationale}`);

    if (decision.candidateScores.length > 1) {
      lines.push(`  ${colorize("Evaluated Candidates:", ANSI.dim, useColor)}`);
      for (const candidate of decision.candidateScores.slice(0, 3)) {
        const mark = candidate.profile.id === decision.selectedProfile.id ? "✓" : "•";
        lines.push(
          `    ${mark} ${candidate.profile.displayName} (score: ${candidate.score})`
        );
      }
    }
  }

  lines.push("");
  lines.push(colorize("── DORMANT PROFILES AUDIT (UNINSTANTIATED) ───────────────────────────", ANSI.dim, useColor));
  if (result.dormantProfiles.length === 0) {
    lines.push("  (All registered profiles were activated)");
  } else {
    const dormantList = result.dormantProfiles.map((p) => p.slug).join(", ");
    lines.push(`  ${dormantList}`);
  }

  lines.push(divider);
  return lines.join("\n");
}

/**
 * Formats a complete execution outcome summary preserving evidence, disagreements, and metrics.
 */
export function formatExecutionSummary(
  result: OrchestrationResult,
  useColor = true
): string {
  const lines: string[] = [];
  const divider = "─".repeat(78);

  const statusColor =
    result.status === "completed"
      ? ANSI.green + ANSI.bold
      : result.status === "cancelled"
      ? ANSI.yellow + ANSI.bold
      : ANSI.red + ANSI.bold;

  lines.push(divider);
  lines.push(
    `${colorize("TERRARIUM EXECUTION RESULT", ANSI.bold + ANSI.cyan, useColor)}  ${colorize(
      `[STATUS: ${result.status.toUpperCase()}]`,
      statusColor,
      useColor
    )}`
  );
  lines.push(divider);

  lines.push(`${colorize("Task ID:", ANSI.dim, useColor)}      ${result.task.id}`);
  lines.push(`${colorize("Plan ID:", ANSI.dim, useColor)}      ${result.plan.id}`);
  lines.push(`${colorize("Task Type:", ANSI.dim, useColor)}    ${result.plan.classification.taskType}`);
  lines.push(`${colorize("Department:", ANSI.dim, useColor)}   ${result.task.department}`);
  lines.push(`${colorize("Summary:", ANSI.dim, useColor)}      ${result.taskResult.summary}`);

  if (result.failureReason) {
    lines.push(`${colorize("Failure Reason:", ANSI.red, useColor)} ${result.failureReason}`);
  }

  // Step Results Table
  lines.push("");
  lines.push(colorize("── EXECUTION STEPS ───────────────────────────────────────────────────", ANSI.cyan, useColor));
  for (const stepRes of result.stepResults) {
    const stepBadge =
      stepRes.status === "completed"
        ? colorize("[DONE]", ANSI.green, useColor)
        : stepRes.status === "failed"
        ? colorize("[FAIL]", ANSI.red, useColor)
        : colorize(`[${stepRes.status.toUpperCase()}]`, ANSI.dim, useColor);

    const step = result.plan.steps.find((s) => s.id === stepRes.stepId);
    const title = step ? step.title : stepRes.stepId;

    lines.push(`  ${stepBadge} ${colorize(title, ANSI.bold, useColor)}`);
    lines.push(
      `         Agent: ${stepRes.agentSlug} | Attempts: ${stepRes.attempts} | Duration: ${stepRes.metrics.durationMs}ms | Tokens: ~${stepRes.metrics.tokensTotal}`
    );
    if (stepRes.error) {
      lines.push(`         ${colorize("Error:", ANSI.red, useColor)} ${stepRes.error}`);
    }
  }

  // Preserved Evidence
  if (result.taskResult.evidence.length > 0) {
    lines.push("");
    lines.push(colorize("── PRESERVED EVIDENCE ────────────────────────────────────────────────", ANSI.cyan, useColor));
    for (const ev of result.taskResult.evidence) {
      const confBadge =
        ev.confidence === "verified"
          ? colorize("[VERIFIED]", ANSI.green, useColor)
          : ev.confidence === "simulated"
          ? colorize("[SIMULATED]", ANSI.magenta, useColor)
          : colorize(`[${ev.confidence.toUpperCase()}]`, ANSI.dim, useColor);

      lines.push(`  ${confBadge} ${ev.claim}`);
      if (ev.sourceReference) {
        lines.push(`    ${colorize("Source:", ANSI.dim, useColor)} ${ev.sourceReference}`);
      }
    }
  }

  // Preserved Disagreements (Crucial: Disagreement is Useful principle)
  if (result.taskResult.disagreements.length > 0) {
    lines.push("");
    lines.push(
      colorize("── PRESERVED DISAGREEMENTS & DIVERGENT STANCES ────────────────────────", ANSI.yellow, useColor)
    );
    for (const dis of result.taskResult.disagreements) {
      lines.push(`  • ${colorize(dis.topic, ANSI.bold, useColor)} [status: ${dis.resolutionStatus}]`);
      for (const pos of dis.positions) {
        lines.push(`    - ${pos.role}: "${pos.stance}" — ${pos.argument}`);
      }
      if (dis.synthesisNotes) {
        lines.push(`    ${colorize("Synthesis Note:", ANSI.dim, useColor)} ${dis.synthesisNotes}`);
      }
    }
  }

  // Unresolved Questions
  if (result.taskResult.unresolvedQuestions.length > 0) {
    lines.push("");
    lines.push(colorize("── UNRESOLVED QUESTIONS (HUMAN DECISION NEEDED) ──────────────────────", ANSI.yellow, useColor));
    for (const q of result.taskResult.unresolvedQuestions) {
      lines.push(`  ? ${q.question} (Impact: ${q.impact})`);
      lines.push(`    Action: ${q.recommendedAction}`);
    }
  }

  // Final Resource Metrics
  lines.push("");
  lines.push(colorize("── RESOURCE CONSUMPTION & SPEND ──────────────────────────────────────", ANSI.cyan, useColor));
  const m = result.metrics;
  lines.push(
    `  Total Tokens:   ~${m.tokensTotal.toLocaleString()} (${m.tokensPrompt.toLocaleString()} prompt + ${m.tokensCompletion.toLocaleString()} completion)\n` +
      `  Total Spend:    ~$${m.estimatedCostUsd.toFixed(3)} USD\n` +
      `  Total Duration: ${Math.round(m.durationMs)}ms`
  );

  lines.push(divider);
  return lines.join("\n");
}
