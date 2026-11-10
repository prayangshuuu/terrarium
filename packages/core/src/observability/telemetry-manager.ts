/**
 * @terrarium/core - observability/telemetry-manager.ts
 *
 * Central telemetry and observability coordinator.
 * Manages structured logging, domain event dispatch, secret redaction,
 * correlation tracking, metrics aggregation, activity feed separation, and retention.
 *
 * FAILURE ISOLATION GUARANTEE:
 * Telemetry failures (repository errors, subscriber throws, I/O errors) are isolated
 * and will NEVER crash the core orchestration runtime or abort business transactions.
 * Aligns strictly with PLAN.md Section 18 & Prompt 13 requirements.
 */

import { randomUUID } from "node:crypto";
import {
  type DomainEvent,
  type EventType,
  type EventSource,
  type StructuredLogRecord,
  type LogLevel,
  type TelemetryMetric,
  type MetricsSummary,
  type ActivityFeedItem,
  type CorrelationContext,
  type EventRepository,
} from "@terrarium/contracts";
import { SqliteLogRepository } from "../persistence/repositories/sqlite-log-repository.js";
import { redactObject, redactString } from "./secret-redactor.js";
import { getCurrentContext } from "./correlation-context.js";
import { MetricsCollector } from "./metrics-collector.js";
import { ActivityFeed } from "./activity-feed.js";
import { RetentionCleaner } from "./retention-cleaner.js";

export type EventSubscriber = (event: DomainEvent) => void | Promise<void>;
export type LogSubscriber = (log: StructuredLogRecord) => void | Promise<void>;

export interface TelemetryManagerOptions {
  readonly eventRepository?: EventRepository;
  readonly logRepository?: SqliteLogRepository;
  readonly enableConsoleLogs?: boolean;
}

export class TelemetryManager {
  readonly metrics: MetricsCollector;
  readonly feed: ActivityFeed;
  readonly retention: RetentionCleaner;
  private readonly eventRepository?: EventRepository;
  private readonly logRepository?: SqliteLogRepository;
  private readonly enableConsoleLogs: boolean;

  private readonly eventSubscribers = new Set<EventSubscriber>();
  private readonly logSubscribers = new Set<LogSubscriber>();

  constructor(options?: TelemetryManagerOptions) {
    this.eventRepository = options?.eventRepository;
    this.logRepository = options?.logRepository;
    this.enableConsoleLogs = options?.enableConsoleLogs ?? false;

    this.metrics = new MetricsCollector();
    this.feed = new ActivityFeed();
    this.retention = new RetentionCleaner(this.logRepository);
  }

  /**
   * Registers a subscriber for domain events.
   * Returns an unsubscribe function.
   */
  subscribeEvents(subscriber: EventSubscriber): () => void {
    this.eventSubscribers.add(subscriber);
    return () => this.eventSubscribers.delete(subscriber);
  }

  /**
   * Registers a subscriber for structured log records.
   * Returns an unsubscribe function.
   */
  subscribeLogs(subscriber: LogSubscriber): () => void {
    this.logSubscribers.add(subscriber);
    return () => this.logSubscribers.delete(subscriber);
  }

  /**
   * Records and dispatches a domain event.
   * Applies secret redaction, correlates context, and isolates telemetry failures.
   */
  async recordEvent(
    eventInput: {
      id?: string;
      eventType: EventType;
      source?: EventSource;
      entityType: string;
      entityId: string;
      payload?: Record<string, unknown>;
      correlationId?: string;
      traceId?: string;
      spanId?: string;
      parentSpanId?: string;
      level?: LogLevel;
      isDiagnostic?: boolean;
      durationMs?: number;
      timestamp?: string;
    }
  ): Promise<DomainEvent> {
    const context = getCurrentContext();

    const sanitizedPayload = eventInput.payload ? redactObject(eventInput.payload) : undefined;

    const event: DomainEvent = {
      id: eventInput.id ?? `evt-${randomUUID()}`,
      eventType: eventInput.eventType,
      source: eventInput.source ?? "orchestrator",
      entityType: eventInput.entityType,
      entityId: eventInput.entityId,
      payload: sanitizedPayload,
      correlationId: eventInput.correlationId ?? context.correlationId,
      traceId: eventInput.traceId ?? context.traceId,
      spanId: eventInput.spanId ?? context.spanId,
      parentSpanId: eventInput.parentSpanId ?? context.parentSpanId,
      level: eventInput.level ?? "info",
      isDiagnostic: eventInput.isDiagnostic ?? false,
      durationMs: eventInput.durationMs,
      timestamp: eventInput.timestamp ?? new Date().toISOString(),
    };

    // 1. Ingest into user-visible activity feed if not internal diagnostic
    try {
      this.feed.ingest(event);
    } catch (err) {
      // Failure isolation: never crash host
      console.error("Activity feed ingest non-fatal error:", err);
    }

    // 2. Persist to EventRepository if available
    if (this.eventRepository) {
      try {
        await this.eventRepository.record(event);
      } catch (err) {
        // Failure isolation: log error but do not break orchestrator
        console.error("Event repository non-fatal persistence error:", err);
      }
    }

    // 3. Notify subscribers asynchronously with failure isolation
    for (const sub of this.eventSubscribers) {
      try {
        const res = sub(event);
        if (res instanceof Promise) {
          res.catch((err) => console.error("Event subscriber non-fatal error:", err));
        }
      } catch (err) {
        console.error("Event subscriber non-fatal synchronous error:", err);
      }
    }

    return event;
  }

  /**
   * Emits a structured log record with correlation context and automatic secret redaction.
   * Guaranteed failure isolation: logger failure never compromises calling code.
   */
  async log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    isDiagnostic = false,
    contextOverride?: Partial<CorrelationContext>
  ): Promise<StructuredLogRecord> {
    const activeContext = getCurrentContext();
    const correlation: CorrelationContext = {
      ...activeContext,
      ...contextOverride,
    };

    const redactedMessage = redactString(message);
    const sanitizedMetadata = metadata ? redactObject(metadata) : undefined;
    const isRedacted = redactedMessage !== message || (metadata !== undefined && JSON.stringify(metadata) !== JSON.stringify(sanitizedMetadata));

    const record: StructuredLogRecord = {
      id: `log-${randomUUID()}`,
      level,
      message: redactedMessage,
      correlation,
      metadata: sanitizedMetadata,
      isDiagnostic,
      isRedacted,
      timestamp: new Date().toISOString(),
    };

    if (this.enableConsoleLogs) {
      const prefix = `[${record.timestamp}] [${record.level.toUpperCase()}] [${correlation.correlationId.slice(0, 8)}]`;
      if (level === "error") {
        console.error(prefix, redactedMessage, sanitizedMetadata ?? "");
      } else if (level === "warn") {
        console.warn(prefix, redactedMessage, sanitizedMetadata ?? "");
      } else {
        console.log(prefix, redactedMessage, sanitizedMetadata ?? "");
      }
    }

    // Persist to LogRepository if available
    if (this.logRepository) {
      try {
        await this.logRepository.record(record);
      } catch (err) {
        console.error("Log repository non-fatal persistence error:", err);
      }
    }

    // Notify subscribers asynchronously
    for (const sub of this.logSubscribers) {
      try {
        const res = sub(record);
        if (res instanceof Promise) {
          res.catch((err) => console.error("Log subscriber non-fatal error:", err));
        }
      } catch (err) {
        console.error("Log subscriber non-fatal synchronous error:", err);
      }
    }

    return record;
  }

  debug(message: string, metadata?: Record<string, unknown>, isDiagnostic = true): Promise<StructuredLogRecord> {
    return this.log("debug", message, metadata, isDiagnostic);
  }

  info(message: string, metadata?: Record<string, unknown>, isDiagnostic = false): Promise<StructuredLogRecord> {
    return this.log("info", message, metadata, isDiagnostic);
  }

  warn(message: string, metadata?: Record<string, unknown>, isDiagnostic = false): Promise<StructuredLogRecord> {
    return this.log("warn", message, metadata, isDiagnostic);
  }

  error(message: string, metadata?: Record<string, unknown>, isDiagnostic = false): Promise<StructuredLogRecord> {
    return this.log("error", message, metadata, isDiagnostic);
  }

  /**
   * Helper methods for recording metrics.
   */
  recordLatency(durationMs: number): void {
    this.metrics.recordLatency(durationMs);
  }

  recordSuccess(): void {
    this.metrics.recordSuccess();
  }

  recordFailure(): void {
    this.metrics.recordFailure();
  }

  recordRetry(): void {
    this.metrics.recordRetry();
  }

  recordQueueDelay(delayMs: number): void {
    this.metrics.recordQueueDelay(delayMs);
  }

  recordUsage(tokens: number, estimatedSpendUsd = 0): void {
    this.metrics.recordUsage(tokens, estimatedSpendUsd);
  }

  getMetricsSummary(): MetricsSummary {
    return this.metrics.getSummary();
  }

  getActivityFeed(options?: {
    taskId?: string;
    milestonesOnly?: boolean;
    limit?: number;
  }): readonly ActivityFeedItem[] {
    return this.feed.getItems(options);
  }
}
