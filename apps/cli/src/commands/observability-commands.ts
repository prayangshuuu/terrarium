/**
 * @terrarium/cli - commands/observability-commands.ts
 *
 * Terminal commands for human-facing activity feeds, telemetry metrics summaries,
 * and structured audit log inspection.
 * Contributed by A4 (CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns with PLAN.md Section 18 & 20 and Prompt 13 requirements.
 */

import {
  type Result,
  ok,
  type ActivityFeedItem,
  type MetricsSummary,
  type StructuredLogRecord,
  type LogLevel,
  ESTIMATE_DISCLAIMER,
  TerrariumError,
} from "@terrarium/contracts";
import { TelemetryManager, SqliteLogRepository } from "@terrarium/core";

export interface ObservabilityCommandOptions {
  readonly json?: boolean;
  readonly taskId?: string;
  readonly milestonesOnly?: boolean;
  readonly level?: LogLevel;
  readonly correlationId?: string;
  readonly isDiagnostic?: boolean;
  readonly limit?: number;
}

/**
 * Formats user-visible activity feed items into an OpenTUI terminal timeline.
 */
export function formatActivityFeedCard(items: readonly ActivityFeedItem[]): string {
  const lines: string[] = [];

  lines.push(`┌─────────────────────────────────────────────────────────────────────────────┐`);
  lines.push(`│ [ACTIVITY] ACTIVITY FEED (HUMAN TIMELINE)                                   │`);
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);

  if (items.length === 0) {
    lines.push(`│ (No recent activity recorded)                                               │`);
    lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  for (const item of items) {
    let glyph = "•";
    if (item.eventType.includes("completed") || item.eventType.includes("approved") || item.eventType.includes("succeeded")) {
      glyph = "[OK]";
    } else if (item.eventType.includes("failed") || item.eventType.includes("rejected")) {
      glyph = "[FAIL]";
    } else if (item.eventType.includes("approval") || item.eventType.includes("budget")) {
      glyph = "[GATE]";
    } else if (item.eventType.includes("started") || item.eventType.includes("invoked")) {
      glyph = "[RUN]";
    }

    const time = item.timestamp.slice(11, 19);
    const actor = item.actor.slice(0, 15).padEnd(15);
    const summary = item.summary.length > 46 ? `${item.summary.slice(0, 43)}...` : item.summary;
    const lineStr = `│ [${time}] ${glyph} ${actor} │ ${summary}`;
    lines.push(lineStr.padEnd(78) + `│`);
  }

  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);
  return lines.join("\n");
}

/**
 * Formats runtime telemetry metrics into an OpenTUI terminal card.
 */
export function formatMetricsCard(summary: MetricsSummary): string {
  const lines: string[] = [];

  const pct = Math.min(100, Math.round(summary.successRatePercent));
  const blocks = Math.floor(pct / 5);
  const successGauge = `[${"█".repeat(blocks)}${"-".repeat(20 - blocks)}] ${pct}% (${summary.successCount} passed / ${summary.failureCount} failed)`;

  lines.push(`┌─────────────────────────────────────────────────────────────────────────────┐`);
  lines.push(`│ [TELEMETRY] RUNTIME TELEMETRY & SYSTEM PERFORMANCE                          │`);
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ Reporting Window: ${summary.periodStart.slice(0, 19)} to ${summary.periodEnd.slice(0, 19)} │`);

  // Success Rate
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ [METRICS] SUCCESS RATE:                                                     │`);
  lines.push(`│   ${successGauge.padEnd(74)}│`);

  // Latency Percentiles
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ [LATENCY] LATENCY DISTRIBUTION (ms):                                        │`);
  const lat = summary.latency;
  const latStr1 = `Samples: ${lat.count} | Avg: ${lat.avgMs}ms | Min: ${lat.minMs}ms | Max: ${lat.maxMs}ms`;
  const latStr2 = `Percentiles: p50: ${lat.p50Ms}ms | p95: ${lat.p95Ms}ms | p99: ${lat.p99Ms}ms`;
  lines.push(`│   • ${latStr1.padEnd(72)}│`);
  lines.push(`│   • ${latStr2.padEnd(72)}│`);

  // Queue & Retries
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ [SCHEDULING] SCHEDULING & RETRIES:                                          │`);
  const queueStr = `Queue Delay: avg ${summary.queueDelay.avgMs}ms (max ${summary.queueDelay.maxMs}ms, ${summary.queueDelay.count} samples)`;
  const retryStr = `Retry Count: ${summary.retryCount} transient recovery attempts`;
  lines.push(`│   • ${queueStr.padEnd(72)}│`);
  lines.push(`│   • ${retryStr.padEnd(72)}│`);

  // Token Usage & Spend
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ [BUDGET] USAGE & SPEND ACCUMULATION:                                        │`);
  const usageStr = `Total Tokens: ${summary.totalTokens.toLocaleString()} tokens`;
  const spendStr = `Estimated Spend: $${summary.totalEstimatedSpendUsd.toFixed(4)} USD*`;
  lines.push(`│   • ${usageStr.padEnd(72)}│`);
  lines.push(`│   • ${spendStr.padEnd(72)}│`);
  lines.push(`│   * ${ESTIMATE_DISCLAIMER.slice(0, 72).padEnd(72)}│`);
  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);

  return lines.join("\n");
}

/**
 * Formats structured audit logs into an OpenTUI terminal card.
 */
export function formatLogsCard(logs: readonly StructuredLogRecord[]): string {
  const lines: string[] = [];

  lines.push(`┌─────────────────────────────────────────────────────────────────────────────┐`);
  lines.push(`│ [AUDIT] STRUCTURED AUDIT LOGS                                               │`);
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);

  if (logs.length === 0) {
    lines.push(`│ (No log records matched query)                                              │`);
    lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);
    return lines.join("\n");
  }

  for (const log of logs) {
    const time = log.timestamp.slice(11, 19);
    const lvl = `[${log.level.toUpperCase()}]`.padEnd(7);
    const corr = `[${log.correlation.correlationId.slice(0, 8)}]`;
    const red = log.isRedacted ? "[SEC]" : "     ";
    const msg = log.message.length > 40 ? `${log.message.slice(0, 37)}...` : log.message;

    const lineStr = `│ ${time} ${lvl} ${corr} ${red} ${msg}`;
    lines.push(lineStr.padEnd(78) + `│`);
  }

  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);
  return lines.join("\n");
}

/**
 * CLI Handler for displaying the user-visible activity feed.
 */
export async function handleActivityFeed(
  telemetry: TelemetryManager,
  options?: ObservabilityCommandOptions
): Promise<Result<string, TerrariumError>> {
  const items = telemetry.getActivityFeed({
    taskId: options?.taskId,
    milestonesOnly: options?.milestonesOnly,
    limit: options?.limit ?? 50,
  });

  if (options?.json) {
    return ok(JSON.stringify(items, null, 2));
  }

  return ok(formatActivityFeedCard(items));
}

/**
 * CLI Handler for displaying performance telemetry metrics.
 */
export async function handleMetricsSummary(
  telemetry: TelemetryManager,
  options?: ObservabilityCommandOptions
): Promise<Result<string, TerrariumError>> {
  const summary = telemetry.getMetricsSummary();

  if (options?.json) {
    return ok(JSON.stringify(summary, null, 2));
  }

  return ok(formatMetricsCard(summary));
}

/**
 * CLI Handler for querying structured audit logs.
 */
export async function handleLogsInspect(
  logRepository: SqliteLogRepository,
  options?: ObservabilityCommandOptions
): Promise<Result<string, TerrariumError>> {
  const queryRes = await logRepository.query({
    level: options?.level,
    correlationId: options?.correlationId,
    taskId: options?.taskId,
    isDiagnostic: options?.isDiagnostic,
    limit: options?.limit ?? 50,
  });

  if (!queryRes.success) return queryRes;

  if (options?.json) {
    return ok(JSON.stringify(queryRes.data, null, 2));
  }

  return ok(formatLogsCard(queryRes.data));
}
