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

  lines.push(`┌─────────────────────────────────────────────────────────────────────────────┐`);
  lines.push(`│ [BUDGET] RESOURCE LIMITS                                                    │`);
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ Scope:       ${summary.scope.toUpperCase().padEnd(61)} │`);
  lines.push(`│ Target ID:   ${summary.targetId.padEnd(61)} │`);
  lines.push(`│ Status:      ${statusBadge.padEnd(61)} │`);
  lines.push(`│ Checked At:  ${summary.lastCheckedAt.padEnd(61)} │`);

  // Token Gauge
  const tokenBlocks = Math.floor(tokenPct / 5);
  const tokenGauge = `[${"█".repeat(tokenBlocks)}${"-".repeat(20 - tokenBlocks)}] ${tokenPct}% (${totalCommittedTokens.toLocaleString()} / ${maxTokens > 0 ? maxTokens.toLocaleString() : "unlimited"} tokens)`;
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ [TOKENS] TOKEN UTILIZATION:                                                 │`);
  lines.push(`│   ${tokenGauge.padEnd(74)}│`);
  lines.push(`│   • Used: ${summary.usedTokens.toLocaleString()} tokens | Reserved: ${summary.reservedTokens.toLocaleString()} tokens`.padEnd(78) + `│`);

  // Spend Gauge
  const spendBlocks = Math.floor(spendPct / 5);
  const spendGauge = `[${"█".repeat(spendBlocks)}${"-".repeat(20 - spendBlocks)}] ${spendPct}% ($${totalCommittedSpend.toFixed(4)} / ${maxSpend > 0 ? `$${maxSpend.toFixed(2)}` : "unlimited"} USD)*`;
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ [SPEND] ESTIMATED SPEND:                                                    │`);
  lines.push(`│   ${spendGauge.padEnd(74)}│`);
  lines.push(`│   • Used: $${summary.usedSpendUsd.toFixed(4)} | Reserved: $${summary.reservedSpendUsd.toFixed(4)}`.padEnd(78) + `│`);
  lines.push(`│   * ${ESTIMATE_DISCLAIMER.slice(0, 72).padEnd(72)}│`);

  // Operational Bounds
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ [POLICY] OPERATIONAL BOUNDS & POLICIES:                                     │`);
  const concurrencyStr = `Active Concurrency: ${summary.activeConcurrency} / ${config?.maxConcurrency ?? "unlimited"} slots`;
  const durationStr = `Max Duration: ${config?.maxDurationMs ? `${config.maxDurationMs / 1000}s` : "unlimited"}`;
  const onLimitStr = `On Limit Action: ${(config?.onLimitExceeded ?? "stop").toUpperCase()}`;
  lines.push(`│   • ${concurrencyStr.padEnd(72)}│`);
  lines.push(`│   • ${durationStr.padEnd(72)}│`);
  lines.push(`│   • ${onLimitStr.padEnd(72)}│`);
  if (config?.maxRetries !== undefined || config?.maxDebateRounds !== undefined) {
    const limitsStr = `Max Retries: ${config?.maxRetries ?? 3} | Max Debate Rounds: ${config?.maxDebateRounds ?? 3}`;
    lines.push(`│   • ${limitsStr.padEnd(72)}│`);
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

  lines.push(`┌─────────────────────────────────────────────────────────────────────────────┐`);
  lines.push(`│ [ROUTING] MODEL ROUTING DECISION                                            │`);
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ Model:       ${(decision.providerId + "/" + decision.modelId).padEnd(61)} │`);
  lines.push(`│ Tier:        ${tierGlyph.padEnd(61)} │`);
  lines.push(`│ Fallback:    ${(decision.isFallback ? "[WARN] YES (Degraded / Fallback)" : "[OK] NO (Optimal Selection)").padEnd(61)} │`);
  lines.push(`│ Est. Rate:   $${decision.estimatedCostPer1kTokens.toFixed(6)} / 1k tokens (estimate)*`.padEnd(77) + `│`);

  if (criteria) {
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ [CRITERIA] ROUTING CRITERIA:                                                │`);
    lines.push(`│   • Complexity:  ${criteria.complexity.toUpperCase().padEnd(58)}│`);
    lines.push(`│   • Risk Level:  ${criteria.riskLevel.toUpperCase().padEnd(58)}│`);
    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      lines.push(`│   • Required:    ${criteria.requiredCapabilities.join(", ").padEnd(58)}│`);
    }
  }

  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ [RATIONALE] TRANSPARENT RATIONALE:                                          │`);
  const wrapped = decision.rationale.length > 70 ? `${decision.rationale.slice(0, 68)}...` : decision.rationale;
  lines.push(`│   ${wrapped.padEnd(74)}│`);
  lines.push(`│   * ${ESTIMATE_DISCLAIMER.slice(0, 72).padEnd(72)}│`);
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
