/**
 * @terrarium/core - context/history-summarizer.ts
 *
 * Condenses long conversation and execution turn histories into compact summaries
 * while explicitly extracting and retaining decision, artifact, commit, and task references.
 * Aligns with PLAN_CONTEXT.md Section 6 (Context & Memory Discipline) and PLAN.md Section 14.
 */

import { type HistoryTurn, type HistorySummary } from "@terrarium/contracts";

export interface SummarizeHistoryOptions {
  readonly preserveRecentTurns?: number; // Number of turns to keep verbatim (default: 3)
  readonly maxSummaryChars?: number;
}

const DECISION_REGEX = /(?:decision|dec)[-:\s]+([a-z0-9_-]+)/gi;
const ARTIFACT_REGEX = /(?:docs\/[^\s]+|packages\/[^\s]+|apps\/[^\s]+|report:[a-z0-9_-]+|art-[a-z0-9_-]+)/gi;
const TASK_REGEX = /task-[a-z0-9_-]+/gi;
const COMMIT_REGEX = /\b[0-9a-f]{7,40}\b/gi;

/**
 * Extracts distinct matches for a regex against raw string text.
 */
function extractMatches(text: string, regex: RegExp): string[] {
  const matches = new Set<string>();
  const re = new RegExp(regex.source, regex.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match[0]) {
      const cleaned = match[0].trim().replace(/[.,;:!?]+$/, "");
      if (cleaned.length > 0) {
        matches.add(cleaned);
      }
    }
  }
  return Array.from(matches);
}

/**
 * Summarizes long turn histories, compressing older turns while preserving critical citations.
 */
export function summarizeHistory(
  turns: readonly HistoryTurn[],
  options?: SummarizeHistoryOptions
): HistorySummary {
  const preserveRecent = options?.preserveRecentTurns ?? 3;
  const originalTurnsCount = turns.length;

  if (turns.length === 0) {
    return {
      summary: "No prior conversation history recorded.",
      retainedDecisions: [],
      retainedArtifacts: [],
      retainedTasks: [],
      retainedCommits: [],
      originalTurnsCount: 0,
      summarizedTurnsCount: 0,
    };
  }

  // If turn count is small, no compression needed
  if (turns.length <= preserveRecent) {
    const allText = turns.map((t) => t.content).join(" ");
    return {
      summary: turns.map((t) => `[${t.role.toUpperCase()}]: ${t.content}`).join("\n"),
      retainedDecisions: extractMatches(allText, DECISION_REGEX),
      retainedArtifacts: extractMatches(allText, ARTIFACT_REGEX),
      retainedTasks: extractMatches(allText, TASK_REGEX),
      retainedCommits: extractMatches(allText, COMMIT_REGEX),
      originalTurnsCount,
      summarizedTurnsCount: 0,
    };
  }

  const turnsToSummarize = turns.slice(0, turns.length - preserveRecent);
  const turnsToPreserve = turns.slice(turns.length - preserveRecent);

  const retainedDecisions = new Set<string>();
  const retainedArtifacts = new Set<string>();
  const retainedTasks = new Set<string>();
  const retainedCommits = new Set<string>();

  const summaryBullets: string[] = [];

  for (const turn of turnsToSummarize) {
    // 1. Collect explicit structured references if provided
    if (turn.references?.decisions) turn.references.decisions.forEach((d) => retainedDecisions.add(d));
    if (turn.references?.artifacts) turn.references.artifacts.forEach((a) => retainedArtifacts.add(a));
    if (turn.references?.tasks) turn.references.tasks.forEach((t) => retainedTasks.add(t));
    if (turn.references?.commits) turn.references.commits.forEach((c) => retainedCommits.add(c));

    // 2. Extract citations from content via regex
    extractMatches(turn.content, DECISION_REGEX).forEach((d) => retainedDecisions.add(d));
    extractMatches(turn.content, ARTIFACT_REGEX).forEach((a) => retainedArtifacts.add(a));
    extractMatches(turn.content, TASK_REGEX).forEach((t) => retainedTasks.add(t));
    extractMatches(turn.content, COMMIT_REGEX).forEach((c) => retainedCommits.add(c));

    // 3. Create condensed turn bullet
    const snippet = turn.content.length > 120 ? `${turn.content.slice(0, 117)}...` : turn.content;
    summaryBullets.push(`- (${turn.role}): ${snippet}`);
  }

  // Also collect references from preserved turns so nothing is lost
  for (const turn of turnsToPreserve) {
    extractMatches(turn.content, DECISION_REGEX).forEach((d) => retainedDecisions.add(d));
    extractMatches(turn.content, ARTIFACT_REGEX).forEach((a) => retainedArtifacts.add(a));
    extractMatches(turn.content, TASK_REGEX).forEach((t) => retainedTasks.add(t));
    extractMatches(turn.content, COMMIT_REGEX).forEach((c) => retainedCommits.add(c));
  }

  const summaryParts: string[] = [];
  summaryParts.push(`### Historical Summary (${turnsToSummarize.length} turns condensed):`);
  summaryParts.push(summaryBullets.join("\n"));

  if (retainedDecisions.size > 0 || retainedArtifacts.size > 0 || retainedTasks.size > 0) {
    summaryParts.push("\n### Preserved References:");
    if (retainedDecisions.size > 0) {
      summaryParts.push(`- Decisions: ${Array.from(retainedDecisions).join(", ")}`);
    }
    if (retainedArtifacts.size > 0) {
      summaryParts.push(`- Artifacts: ${Array.from(retainedArtifacts).join(", ")}`);
    }
    if (retainedTasks.size > 0) {
      summaryParts.push(`- Tasks: ${Array.from(retainedTasks).join(", ")}`);
    }
    if (retainedCommits.size > 0) {
      summaryParts.push(`- Commits: ${Array.from(retainedCommits).join(", ")}`);
    }
  }

  summaryParts.push(`\n### Recent Turns (${turnsToPreserve.length} preserved in full):`);
  for (const turn of turnsToPreserve) {
    summaryParts.push(`[${turn.role.toUpperCase()}]: ${turn.content}`);
  }

  return {
    summary: summaryParts.join("\n"),
    retainedDecisions: Array.from(retainedDecisions),
    retainedArtifacts: Array.from(retainedArtifacts),
    retainedTasks: Array.from(retainedTasks),
    retainedCommits: Array.from(retainedCommits),
    originalTurnsCount,
    summarizedTurnsCount: turnsToSummarize.length,
  };
}
