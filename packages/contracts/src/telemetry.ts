/**
 * @terrarium/contracts - telemetry.ts
 *
 * Contracts for structured logging, distributed correlation contexts,
 * metric collection (latency, retries, queue delay, usage, spend),
 * activity feeds, and retention policies.
 * Aligns strictly with PLAN.md Section 18 & 20 and PLAN_CONTEXT.md Section 7 & 8.
 */

import { type Result, ok, fail } from "./base.js";
import { DomainValidationError } from "./errors.js";
import {
  isRecord,
  validateEnum,
  validateIsoDateTime,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.js";

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const METRIC_TYPES = ["counter", "gauge", "histogram"] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

export const METRIC_UNITS = ["ms", "count", "tokens", "usd", "percent"] as const;
export type MetricUnit = (typeof METRIC_UNITS)[number];

/**
 * Distributed correlation context for tracing requests across agents, steps, and tool invocations.
 */
export interface CorrelationContext {
  readonly correlationId: string;
  readonly traceId: string;
  readonly spanId?: string;
  readonly parentSpanId?: string;
  readonly taskId?: string;
  readonly stepId?: string;
  readonly agentSlug?: string;
}

/**
 * Structured log entry with correlation IDs, diagnostics separation, and redaction flags.
 */
export interface StructuredLogRecord {
  readonly id: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly correlation: CorrelationContext;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly isDiagnostic: boolean;
  readonly isRedacted: boolean;
  readonly timestamp: string;
}

/**
 * Telemetry metric measurement.
 */
export interface TelemetryMetric {
  readonly name: string;
  readonly type: MetricType;
  readonly value: number;
  readonly unit?: MetricUnit;
  readonly tags?: Readonly<Record<string, string>>;
  readonly timestamp: string;
}

/**
 * Statistical latency distribution.
 */
export interface LatencyDistribution {
  readonly count: number;
  readonly avgMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly minMs: number;
  readonly maxMs: number;
}

/**
 * Consolidated telemetry metrics summary.
 */
export interface MetricsSummary {
  readonly latency: LatencyDistribution;
  readonly successCount: number;
  readonly failureCount: number;
  readonly successRatePercent: number;
  readonly retryCount: number;
  readonly queueDelay: {
    readonly count: number;
    readonly avgMs: number;
    readonly maxMs: number;
  };
  readonly totalTokens: number;
  readonly totalEstimatedSpendUsd: number;
  readonly isEstimate: true;
  readonly periodStart: string;
  readonly periodEnd: string;
}

/**
 * User-visible activity timeline item (separated from noisy internal diagnostics).
 */
export interface ActivityFeedItem {
  readonly id: string;
  readonly timestamp: string;
  readonly eventType: string;
  readonly actor: string;
  readonly summary: string;
  readonly status?: string;
  readonly taskId?: string;
  readonly durationMs?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly isMilestone: boolean;
}

/**
 * Retention policy for events, logs, and telemetry metrics.
 */
export interface RetentionPolicy {
  readonly maxLogAgeDays?: number; // default: 30 days
  readonly maxEventAgeDays?: number; // default: 90 days
  readonly maxLogRecords?: number; // default: 50,000 records
  readonly maxEventRecords?: number; // default: 100,000 records
  readonly cleanupIntervalMs?: number; // default: 1 hour
}

export const DEFAULT_RETENTION_POLICY: Required<RetentionPolicy> = {
  maxLogAgeDays: 30,
  maxEventAgeDays: 90,
  maxLogRecords: 50_000,
  maxEventRecords: 100_000,
  cleanupIntervalMs: 3_600_000,
};

/**
 * Validates a correlation context.
 */
export function validateCorrelationContext(
  value: unknown,
  path = "correlation"
): Result<CorrelationContext, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const correlationId = collector.check(
    validateString(value.correlationId, `${path}.correlationId`, { minLength: 1, maxLength: 100 })
  );
  const traceId = collector.check(
    validateString(value.traceId, `${path}.traceId`, { minLength: 1, maxLength: 100 })
  );

  let spanId: string | undefined;
  if (value.spanId !== undefined) {
    spanId = collector.check(validateString(value.spanId, `${path}.spanId`, { minLength: 1, maxLength: 100 }));
  }

  let parentSpanId: string | undefined;
  if (value.parentSpanId !== undefined) {
    parentSpanId = collector.check(
      validateString(value.parentSpanId, `${path}.parentSpanId`, { minLength: 1, maxLength: 100 })
    );
  }

  let taskId: string | undefined;
  if (value.taskId !== undefined) {
    taskId = collector.check(validateString(value.taskId, `${path}.taskId`, { minLength: 1, maxLength: 100 }));
  }

  let stepId: string | undefined;
  if (value.stepId !== undefined) {
    stepId = collector.check(validateString(value.stepId, `${path}.stepId`, { minLength: 1, maxLength: 100 }));
  }

  let agentSlug: string | undefined;
  if (value.agentSlug !== undefined) {
    agentSlug = collector.check(
      validateString(value.agentSlug, `${path}.agentSlug`, { minLength: 1, maxLength: 100 })
    );
  }

  if (collector.hasIssues() || correlationId === undefined || traceId === undefined) {
    return fail(collector.toError("CorrelationContext validation failed"));
  }

  return ok({
    correlationId,
    traceId,
    spanId,
    parentSpanId,
    taskId,
    stepId,
    agentSlug,
  });
}

/**
 * Validates a structured log record.
 */
export function validateStructuredLogRecord(
  value: unknown,
  path = "logRecord"
): Result<StructuredLogRecord, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const level = collector.check(validateEnum(value.level, `${path}.level`, LOG_LEVELS));
  const message = collector.check(validateString(value.message, `${path}.message`, { minLength: 1 }));
  const correlation = collector.check(validateCorrelationContext(value.correlation, `${path}.correlation`));
  const isDiagnostic = typeof value.isDiagnostic === "boolean" ? value.isDiagnostic : false;
  const isRedacted = typeof value.isRedacted === "boolean" ? value.isRedacted : false;
  const timestamp = collector.check(validateIsoDateTime(value.timestamp, `${path}.timestamp`));

  if (
    collector.hasIssues() ||
    id === undefined ||
    level === undefined ||
    message === undefined ||
    correlation === undefined ||
    timestamp === undefined
  ) {
    return fail(collector.toError("StructuredLogRecord validation failed"));
  }

  return ok({
    id,
    level,
    message,
    correlation,
    metadata: isRecord(value.metadata) ? (value.metadata as Record<string, unknown>) : undefined,
    isDiagnostic,
    isRedacted,
    timestamp,
  });
}
