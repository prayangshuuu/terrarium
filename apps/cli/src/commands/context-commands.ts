/**
 * @terrarium/cli - commands/context-commands.ts
 *
 * Terminal commands for per-agent context assembly, token budget inspection,
 * and scoped context package visualization.
 * Contributed by A4 (CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns with PLAN.md Section 14 & 16 and PLAN_CONTEXT.md Section 6.
 */

import {
  type Result,
  ok,
  fail,
  type AgentContextPackage,
  type ContextAssemblyRequest,
  type AgentProfile,
  type Task,
  type HistoryTurn,
  type ArtifactReference,
  TerrariumError,
} from "@terrarium/contracts";
import { ContextAssembler } from "@terrarium/core";

export interface ContextCommandOptions {
  readonly json?: boolean;
  readonly profile?: AgentProfile;
  readonly task?: Task;
  readonly historyTurns?: readonly HistoryTurn[];
  readonly artifacts?: readonly ArtifactReference[];
  readonly strictBudget?: boolean;
}

/**
 * Formats an assembled AgentContextPackage for operator terminal inspection.
 */
export function formatContextPackageCard(pkg: AgentContextPackage): string {
  const lines: string[] = [];
  const pctUsed = Math.min(100, Math.round((pkg.tokenEstimate / pkg.tokenLimit) * 100));

  lines.push(`┌─────────────────────────────────────────────────────────────────────────────┐`);
  lines.push(`│ [CONTEXT] AGENT CONTEXT PACKAGE                                             │`);
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ ID:          ${pkg.id.padEnd(61)} │`);
  lines.push(`│ Agent:       ${pkg.agentSlug.padEnd(61)} │`);
  lines.push(`│ Department:  ${pkg.department.toUpperCase().padEnd(61)} │`);
  lines.push(`│ Project:     ${pkg.projectId.padEnd(61)} │`);
  lines.push(`│ Task ID:     ${pkg.taskId.padEnd(61)} │`);
  lines.push(`│ Task Title:  ${pkg.taskContext.title.slice(0, 61).padEnd(61)} │`);
  lines.push(`│ Assembled:   ${pkg.assembledAt.padEnd(61)} │`);

  // Token budget gauge
  const budgetBar = `[${"█".repeat(Math.floor(pctUsed / 5))}${"-".repeat(20 - Math.floor(pctUsed / 5))}] ${pctUsed}% (${pkg.tokenEstimate} / ${pkg.tokenLimit} tokens)`;
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ [TOKENS] TOKEN BUDGET:                                                      │`);
  lines.push(`│   ${budgetBar.padEnd(74)}│`);

  // Warnings
  if (pkg.warnings.length > 0) {
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ [WARN] CONTEXT WARNINGS (${pkg.warnings.length}):                                          │`);
    for (const w of pkg.warnings) {
      const wrapped = w.length > 70 ? `${w.slice(0, 67)}...` : w;
      lines.push(`│   • ${wrapped.padEnd(72)}│`);
    }
  }

  // Active constraints
  if (pkg.activeConstraints.length > 0) {
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ [CONSTRAINTS] ACTIVE CONSTRAINTS (${pkg.activeConstraints.length}):                        │`);
    for (const c of pkg.activeConstraints) {
      const wrapped = c.length > 70 ? `${c.slice(0, 67)}...` : c;
      lines.push(`│   • ${wrapped.padEnd(72)}│`);
    }
  }

  // Durable decisions
  if (pkg.durableDecisions.length > 0) {
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ [DECISIONS] DURABLE DECISIONS RETAINED (${pkg.durableDecisions.length}):                    │`);
    for (const d of pkg.durableDecisions) {
      const title = `${d.key}: ${d.content.slice(0, 50)}...`;
      lines.push(`│   • ${title.padEnd(72)}│`);
    }
  }

  // Relevant memories
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ [MEMORIES] RELEVANT MEMORIES (${pkg.relevantMemories.length}):                             │`);
  for (const m of pkg.relevantMemories.slice(0, 5)) {
    const summary = `${m.category} | ${m.key} (${m.confidence})`;
    lines.push(`│   • ${summary.padEnd(72)}│`);
  }
  if (pkg.relevantMemories.length > 5) {
    lines.push(`│   ... and ${pkg.relevantMemories.length - 5} more memories retained                      │`);
  }

  // Conversation history summary
  if (pkg.conversationSummary) {
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ [CONVERSATION] CONVERSATION SUMMARY:                                        │`);
    const summaryLines = pkg.conversationSummary.split("\n").slice(0, 4);
    for (const s of summaryLines) {
      const wrapped = s.length > 70 ? `${s.slice(0, 67)}...` : s;
      lines.push(`│   ${wrapped.padEnd(74)}│`);
    }
  }

  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);
  return lines.join("\n");
}

/**
 * Handles `terrarium context assemble` command.
 */
export async function handleContextAssemble(
  request: ContextAssemblyRequest,
  contextAssembler: ContextAssembler,
  options?: ContextCommandOptions
): Promise<Result<{ pkg: AgentContextPackage; output: string }, TerrariumError>> {
  const res = await contextAssembler.assembleContext(request, {
    profile: options?.profile,
    task: options?.task,
    historyTurns: options?.historyTurns,
    artifacts: options?.artifacts,
    strictBudget: options?.strictBudget,
  });

  if (!res.success) return fail(res.error);
  const pkg = res.data;

  if (options?.json) {
    return ok({
      pkg,
      output: JSON.stringify(pkg, null, 2),
    });
  }

  return ok({
    pkg,
    output: formatContextPackageCard(pkg),
  });
}
