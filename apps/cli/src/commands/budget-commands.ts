/**
 * @terrarium/cli - commands/budget-commands.ts
 *
 * Terminal commands for budget management, token & spend tracking,
 * operational bounds inspection, and intelligent model routing visualization.
 * Contributed by A4 (CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns with PLAN.md Section 12 & 13 and PLAN_CONTEXT.md Section 7 & 8.
 */

import {
  type Result,
  ok,
  fail,
  type BudgetConfig,
  type BudgetScope,
  type BudgetSummary,
  type RoutingCriteria,
  type RoutingDecision,
  ESTIMATE_DISCLAIMER,
  TerrariumError,
} from "@terrarium/contracts";
import { BudgetManager, ModelRouter } from "@terrarium/core";

export interface BudgetCommandOptions {
  readonly json?: boolean;
}

/**
 * Formats a budget summary and configuration into an OpenTUI terminal card.
 */
export function formatBudgetCard(summary: BudgetSummary, config?: BudgetConfig | null): string {
  const lines: string[] = [];

  const maxTokens = summary.allocatedTokens ?? config?.maxTokens ?? 0;
  const maxSpend = summary.allocatedSpendUsd ?? config?.maxSpendUsd ?? 0;

  const totalCommittedTokens = summary.usedTokens + summary.reservedTokens;
  const tokenPct = maxTokens > 0 ? Math.min(100, Math.round((totalCommittedTokens / maxTokens) * 100)) : 0;

  const totalCommittedSpend = summary.usedSpendUsd + summary.reservedSpendUsd;
  const spendPct = maxSpend > 0 ? Math.min(100, Math.round((totalCommittedSpend / maxSpend) * 100)) : 0;

  let statusBadge = "[OK] NORMAL";
  if (summary.isExceeded) {
    statusBadge = "[EXCEEDED] LIMIT EXCEEDED";
  } else if (summary.isWarning) {
    statusBadge = "[WARN] BUDGET WARNING (>80%)";
  }

  const row = (text: string) => `│ ${text.slice(0, 75).padEnd(75)} │`;

  lines.push(`┌─────────────────────────────────────────────────────────────────────────────┐`);
  lines.push(row(`[BUDGET] RESOURCE LIMITS`));
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(row(`Scope:       ${summary.scope.toUpperCase()}`));
  lines.push(row(`Target ID:   ${summary.targetId}`));
  lines.push(row(`Status:      ${statusBadge}`));
  lines.push(row(`Checked At:  ${summary.lastCheckedAt}`));

  // Token Gauge
  const tokenBlocks = Math.floor(tokenPct / 5);
  const tokenGauge = `[${"█".repeat(tokenBlocks)}${"-".repeat(20 - tokenBlocks)}] ${tokenPct}% (${totalCommittedTokens.toLocaleString()} / ${maxTokens > 0 ? maxTokens.toLocaleString() : "unlimited"} tokens)`;
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(row(`[TOKENS] TOKEN UTILIZATION:`));
  lines.push(row(`  ${tokenGauge}`));
  lines.push(row(`  • Used: ${summary.usedTokens.toLocaleString()} tokens | Reserved: ${summary.reservedTokens.toLocaleString()} tokens`));

  // Spend Gauge
  const spendBlocks = Math.floor(spendPct / 5);
  const spendGauge = `[${"█".repeat(spendBlocks)}${"-".repeat(20 - spendBlocks)}] ${spendPct}% ($${totalCommittedSpend.toFixed(4)} / ${maxSpend > 0 ? `$${maxSpend.toFixed(2)}` : "unlimited"} USD)*`;
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(row(`[SPEND] ESTIMATED SPEND:`));
  lines.push(row(`  ${spendGauge}`));
  lines.push(row(`  • Used: $${summary.usedSpendUsd.toFixed(4)} | Reserved: $${summary.reservedSpendUsd.toFixed(4)}`));
  lines.push(row(`  * ${ESTIMATE_DISCLAIMER}`));

  // Operational Bounds
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(row(`[POLICY] OPERATIONAL BOUNDS & POLICIES:`));
  const concurrencyStr = `Active Concurrency: ${summary.activeConcurrency} / ${config?.maxConcurrency ?? "unlimited"} slots`;
  const durationStr = `Max Duration: ${config?.maxDurationMs ? `${config.maxDurationMs / 1000}s` : "unlimited"}`;
  const onLimitStr = `On Limit Action: ${(config?.onLimitExceeded ?? "stop").toUpperCase()}`;
  lines.push(row(`  • ${concurrencyStr}`));
  lines.push(row(`  • ${durationStr}`));
  lines.push(row(`  • ${onLimitStr}`));
  if (config?.maxRetries !== undefined || config?.maxDebateRounds !== undefined) {
    const limitsStr = `Max Retries: ${config?.maxRetries ?? 3} | Max Debate Rounds: ${config?.maxDebateRounds ?? 3}`;
    lines.push(row(`  • ${limitsStr}`));
  }
  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);

  return lines.join("\n");
}

/**
 * Formats a model routing decision into an OpenTUI terminal card.
 */
export function formatRoutingCard(decision: RoutingDecision, criteria?: RoutingCriteria): string {
  const lines: string[] = [];

  let tierGlyph = "[STD] STANDARD";
  if (decision.tier === "fast") tierGlyph = "[FAST] FAST";
  if (decision.tier === "advanced") tierGlyph = "[ADV] ADVANCED";

  const row = (text: string) => `│ ${text.slice(0, 75).padEnd(75)} │`;

  lines.push(`┌─────────────────────────────────────────────────────────────────────────────┐`);
  lines.push(row(`[ROUTING] MODEL ROUTING DECISION`));
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(row(`Model:       ${decision.providerId}/${decision.modelId}`));
  lines.push(row(`Tier:        ${tierGlyph}`));
  lines.push(row(`Fallback:    ${decision.isFallback ? "[WARN] YES (Degraded / Fallback)" : "[OK] NO (Optimal Selection)"}`));
  lines.push(row(`Est. Rate:   $${decision.estimatedCostPer1kTokens.toFixed(6)} / 1k tokens (estimate)*`));

  if (criteria) {
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(row(`[CRITERIA] ROUTING CRITERIA:`));
    lines.push(row(`  • Complexity:  ${criteria.complexity.toUpperCase()}`));
    lines.push(row(`  • Risk Level:  ${criteria.riskLevel.toUpperCase()}`));
    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      lines.push(row(`  • Required:    ${criteria.requiredCapabilities.join(", ")}`));
    }
  }

  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(row(`[RATIONALE] TRANSPARENT RATIONALE:`));
  lines.push(row(`  ${decision.rationale}`));
  lines.push(row(`  * ${ESTIMATE_DISCLAIMER}`));
  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);

  return lines.join("\n");
}

/**
 * CLI Handler for displaying budget configuration and usage summary.
 */
export async function handleBudgetShow(
  scope: BudgetScope,
  targetId: string,
  budgetManager: BudgetManager,
  options?: BudgetCommandOptions
): Promise<Result<string, TerrariumError>> {
  const summaryRes = await budgetManager.getSummary(scope, targetId);
  if (!summaryRes.success) return summaryRes;

  const configRes = await budgetManager.getConfig(scope, targetId);
  const config = configRes.success ? configRes.data : null;

  if (options?.json) {
    return ok(
      JSON.stringify(
        {
          summary: summaryRes.data,
          config,
        },
        null,
        2
      )
    );
  }

  return ok(formatBudgetCard(summaryRes.data, config));
}

/**
 * CLI Handler for setting budget limits.
 */
export async function handleBudgetSet(
  config: BudgetConfig,
  budgetManager: BudgetManager,
  options?: BudgetCommandOptions
): Promise<Result<string, TerrariumError>> {
  const setRes = await budgetManager.setConfig(config);
  if (!setRes.success) return setRes;

  const summaryRes = await budgetManager.getSummary(config.scope, config.targetId ?? "default");
  if (!summaryRes.success) return summaryRes;

  if (options?.json) {
    return ok(
      JSON.stringify(
        {
          config: setRes.data,
          summary: summaryRes.data,
        },
        null,
        2
      )
    );
  }

  return ok(formatBudgetCard(summaryRes.data, setRes.data));
}

/**
 * CLI Handler for testing or querying model routing decisions.
 */
export async function handleModelRoute(
  criteria: RoutingCriteria,
  modelRouter: ModelRouter,
  options?: BudgetCommandOptions
): Promise<Result<string, TerrariumError>> {
  const decisionRes = modelRouter.routeModel(criteria);
  if (!decisionRes.success) return decisionRes;

  if (options?.json) {
    return ok(
      JSON.stringify(
        {
          criteria,
          decision: decisionRes.data,
        },
        null,
        2
      )
    );
  }

  return ok(formatRoutingCard(decisionRes.data, criteria));
}
