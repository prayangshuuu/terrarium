/**
 * @terrarium/core - observability/metrics-collector.ts
 *
 * Aggregates runtime telemetry metrics: execution latencies, success/failure counts,
 * retry attempts, queue delays, token consumption, and estimated spend.
 * Aligns strictly with PLAN.md Section 18 & 20 and Prompt 13 specifications.
 */

import {
  type MetricsSummary,
  type LatencyDistribution,
  type TelemetryMetric,
  type MetricType,
  type MetricUnit,
} from "@terrarium/contracts";

export class MetricsCollector {
  private readonly latencySamples: number[] = [];
  private readonly queueDelaySamples: number[] = [];
  private successCount = 0;
  private failureCount = 0;
  private retryCount = 0;
  private totalTokens = 0;
  private totalSpendUsd = 0;
  private readonly periodStart: string;

  constructor(private readonly maxSamples = 10_000) {
    this.periodStart = new Date().toISOString();
  }

  /**
   * Records execution latency in milliseconds.
   */
  recordLatency(durationMs: number): void {
    if (durationMs < 0 || isNaN(durationMs)) return;
    if (this.latencySamples.length >= this.maxSamples) {
      this.latencySamples.shift();
    }
    this.latencySamples.push(durationMs);
  }

  /**
   * Records task step queue delay in milliseconds.
   */
  recordQueueDelay(delayMs: number): void {
    if (delayMs < 0 || isNaN(delayMs)) return;
    if (this.queueDelaySamples.length >= this.maxSamples) {
      this.queueDelaySamples.shift();
    }
    this.queueDelaySamples.push(delayMs);
  }

  /**
   * Records successful operation.
   */
  recordSuccess(): void {
    this.successCount += 1;
  }

  /**
   * Records failed operation.
   */
  recordFailure(): void {
    this.failureCount += 1;
  }

  /**
   * Records retry attempt.
   */
  recordRetry(): void {
    this.retryCount += 1;
  }

  /**
   * Records token usage and estimated USD spend.
   */
  recordUsage(tokens: number, estimatedSpendUsd = 0): void {
    if (tokens > 0) this.totalTokens += tokens;
    if (estimatedSpendUsd > 0) this.totalSpendUsd += estimatedSpendUsd;
  }

  private calculatePercentile(sorted: readonly number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? 0;
  }

  private computeDistribution(samples: readonly number[]): LatencyDistribution {
    if (samples.length === 0) {
      return {
        count: 0,
        avgMs: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        minMs: 0,
        maxMs: 0,
      };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const avgMs = Number((sum / sorted.length).toFixed(2));
    const minMs = sorted[0]!;
    const maxMs = sorted[sorted.length - 1]!;
    const p50Ms = this.calculatePercentile(sorted, 50);
    const p95Ms = this.calculatePercentile(sorted, 95);
    const p99Ms = this.calculatePercentile(sorted, 99);

    return {
      count: sorted.length,
      avgMs,
      p50Ms,
      p95Ms,
      p99Ms,
      minMs,
      maxMs,
    };
  }

  /**
   * Compiles consolidated metrics summary.
   */
  getSummary(): MetricsSummary {
    const totalOps = this.successCount + this.failureCount;
    const successRatePercent = totalOps > 0 ? Number(((this.successCount / totalOps) * 100).toFixed(2)) : 100.0;

    const latencyDist = this.computeDistribution(this.latencySamples);

    let queueAvg = 0;
    let queueMax = 0;
    if (this.queueDelaySamples.length > 0) {
      const qSum = this.queueDelaySamples.reduce((a, b) => a + b, 0);
      queueAvg = Number((qSum / this.queueDelaySamples.length).toFixed(2));
      queueMax = Math.max(...this.queueDelaySamples);
    }

    return {
      latency: latencyDist,
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRatePercent,
      retryCount: this.retryCount,
      queueDelay: {
        count: this.queueDelaySamples.length,
        avgMs: queueAvg,
        maxMs: queueMax,
      },
      totalTokens: this.totalTokens,
      totalEstimatedSpendUsd: Number(this.totalSpendUsd.toFixed(6)),
      isEstimate: true,
      periodStart: this.periodStart,
      periodEnd: new Date().toISOString(),
    };
  }

  /**
   * Resets all metric aggregations.
   */
  reset(): void {
    this.latencySamples.length = 0;
    this.queueDelaySamples.length = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.retryCount = 0;
    this.totalTokens = 0;
    this.totalSpendUsd = 0;
  }
}
