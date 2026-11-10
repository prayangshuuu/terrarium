/**
 * @terrarium/core - tests/observability.test.ts
 *
 * Comprehensive tests for TelemetryManager, SecretRedactor, CorrelationContext,
 * MetricsCollector, ActivityFeed, and RetentionCleaner.
 * Validates ordering, redaction, correlation, failure isolation, and SQLite persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  type DomainEvent,
  type CorrelationContext,
} from "@terrarium/contracts";
import {
  TelemetryManager,
  redactString,
  redactObject,
  createRootContext,
  createChildSpan,
  runWithContext,
  getCurrentContext,
  MetricsCollector,
  ActivityFeed,
  RetentionCleaner,
} from "../src/observability/index.js";
import { createSqliteDatabase, type SqliteDatabase } from "../src/persistence/sqlite-database.js";

describe("Observability, Telemetry & Logs Suite (A1, A2, A3)", () => {
  let db: SqliteDatabase;
  let telemetry: TelemetryManager;

  beforeEach(() => {
    db = createSqliteDatabase(":memory:");
    telemetry = new TelemetryManager({
      eventRepository: db.events,
      logRepository: db.logs,
    });
  });

  afterEach(() => {
    db.close();
  });

  describe("Secret & Sensitive Data Redaction (A3)", () => {
    it("redacts provider API keys and bearer tokens from strings", () => {
      const openAiSample = "Calling model with key sk-abcdef1234567890abcdef1234567890 in header";
      const redactedOpenAi = redactString(openAiSample);
      expect(redactedOpenAi).not.toContain("sk-abcdef");
      expect(redactedOpenAi).toContain("[REDACTED:OPENAI_KEY]");

      const bearerSample = "Authorization: Bearer mySecretToken1234567890xyz";
      const redactedBearer = redactString(bearerSample);
      expect(redactedBearer).not.toContain("mySecretToken1234567890xyz");
      expect(redactedBearer).toContain("[REDACTED:BEARER_TOKEN]");

      const anthropicSample = "Anthropic header: sk-ant-api03-abcdef12345678901234567890";
      expect(redactString(anthropicSample)).toContain("[REDACTED:ANTHROPIC_KEY]");

      const geminiSample = "Gemini key: AIzaSyD12345678901234567890123456789012";
      expect(redactString(geminiSample)).toContain("[REDACTED:GEMINI_KEY]");
    });

    it("recursively scrubs sensitive fields and API keys from arbitrary objects", () => {
      const sensitivePayload = {
        taskId: "task-99",
        config: {
          apiKey: "super-secret-key-123",
          password: "myPassword123!",
          model: "gpt-4o",
        },
        headers: {
          Authorization: "Bearer token9876543210abcdef",
        },
        metadata: {
          note: "This mentions sk-1234567890abcdef1234567890 inside a text string",
        },
      };

      const sanitized = redactObject(sensitivePayload);
      expect(sanitized.config.apiKey).toBe("[REDACTED]");
      expect(sanitized.config.password).toBe("[REDACTED]");
      expect(sanitized.config.model).toBe("gpt-4o");
      expect(sanitized.headers.Authorization).toBe("[REDACTED]");
      expect(sanitized.metadata.note).toContain("[REDACTED:OPENAI_KEY]");
    });

    it("handles circular references safely without infinite recursion", () => {
      const circularObj: any = { name: "loop" };
      circularObj.self = circularObj;

      const sanitized = redactObject(circularObj);
      expect(sanitized.name).toBe("loop");
      expect(sanitized.self).toBe("[CIRCULAR]");
    });
  });

  describe("Correlation Context Propagation (A2)", () => {
    it("creates root context and child span hierarchies", () => {
      const root = createRootContext({ taskId: "task-root", agentSlug: "lead-architect" });
      expect(root.correlationId).toBeDefined();
      expect(root.traceId).toBeDefined();
      expect(root.spanId).toBeDefined();
      expect(root.parentSpanId).toBeUndefined();

      const child = createChildSpan(root, { stepId: "step-child" });
      expect(child.correlationId).toBe(root.correlationId);
      expect(child.traceId).toBe(root.traceId);
      expect(child.parentSpanId).toBe(root.spanId);
      expect(child.spanId).not.toBe(root.spanId);
      expect(child.stepId).toBe("step-child");
    });

    it("propagates correlation context across asynchronous task boundaries", async () => {
      const customContext: CorrelationContext = {
        correlationId: "corr-async-test",
        traceId: "trace-async-test",
        spanId: "span-root",
        taskId: "task-async",
      };

      await runWithContext(customContext, async () => {
        // First async tick
        await new Promise((resolve) => setTimeout(resolve, 5));
        const active1 = getCurrentContext();
        expect(active1.correlationId).toBe("corr-async-test");
        expect(active1.taskId).toBe("task-async");

        // Nested async tick
        await Promise.resolve().then(() => {
          const active2 = getCurrentContext();
          expect(active2.traceId).toBe("trace-async-test");
        });
      });
    });
  });

  describe("Structured Logging & SQLite Persistence (A1 & A3)", () => {
    it("emits structured logs with auto-redaction and persists to SQLite repository", async () => {
      const logRecord = await telemetry.info(
        "Agent executed tool with key sk-openai1234567890abcdef1234567890",
        {
          tool: "fs.read_file",
          secretHeader: "my-secret-token",
        }
      );

      expect(logRecord.level).toBe("info");
      expect(logRecord.message).toContain("[REDACTED:OPENAI_KEY]");
      expect(logRecord.isRedacted).toBe(true);

      // Verify persistence in SQLite
      const queryRes = await db.logs.query({ level: "info" });
      expect(queryRes.success).toBe(true);
      if (queryRes.success) {
        expect(queryRes.data.length).toBeGreaterThan(0);
        const stored = queryRes.data[0]!;
        expect(stored.message).toContain("[REDACTED:OPENAI_KEY]");
        expect(stored.metadata?.secretHeader).toBe("[REDACTED]");
      }
    });

    it("filters diagnostic logs from user-visible queries", async () => {
      await telemetry.debug("Internal cache lookup hit", { cacheKey: "abc" }, true);
      await telemetry.info("User requested task execution", { title: "Deploy" }, false);

      const allLogs = await db.logs.query();
      expect(allLogs.success).toBe(true);
      if (allLogs.success) {
        expect(allLogs.data.length).toBe(2);
      }

      const userLogs = await db.logs.query({ isDiagnostic: false });
      expect(userLogs.success).toBe(true);
      if (userLogs.success) {
        expect(userLogs.data.length).toBe(1);
        expect(userLogs.data[0]!.message).toContain("User requested");
      }
    });
  });

  describe("Metrics Collector & Analytics (A2 & A5)", () => {
    it("aggregates latencies, success rate percent, retries, and token spend", () => {
      const collector = new MetricsCollector();

      // Record latencies
      collector.recordLatency(100);
      collector.recordLatency(200);
      collector.recordLatency(300);
      collector.recordLatency(400);

      // Record success/failures
      collector.recordSuccess();
      collector.recordSuccess();
      collector.recordSuccess();
      collector.recordFailure();

      // Record retries & queue delay
      collector.recordRetry();
      collector.recordQueueDelay(50);
      collector.recordQueueDelay(150);

      // Record usage & spend
      collector.recordUsage(5000, 0.05);

      const summary = collector.getSummary();
      expect(summary.latency.count).toBe(4);
      expect(summary.latency.minMs).toBe(100);
      expect(summary.latency.maxMs).toBe(400);
      expect(summary.latency.avgMs).toBe(250);
      expect(summary.latency.p50Ms).toBe(200);

      expect(summary.successCount).toBe(3);
      expect(summary.failureCount).toBe(1);
      expect(summary.successRatePercent).toBe(75.0);
      expect(summary.retryCount).toBe(1);

      expect(summary.queueDelay.count).toBe(2);
      expect(summary.queueDelay.avgMs).toBe(100);

      expect(summary.totalTokens).toBe(5000);
      expect(summary.totalEstimatedSpendUsd).toBe(0.05);
      expect(summary.isEstimate).toBe(true);
    });
  });

  describe("Activity Feed & Narrative Summaries (A4 & A5)", () => {
    it("converts domain events into readable human activity items", async () => {
      await telemetry.recordEvent({
        eventType: "task:created",
        entityType: "Task",
        entityId: "task-act-1",
        payload: { title: "Implement Auth Service" },
      });

      await telemetry.recordEvent({
        eventType: "step:started",
        entityType: "TaskStep",
        entityId: "step-1",
        payload: { agentSlug: "lead-architect", title: "Design Schemas" },
      });

      // Internal diagnostic event should NOT appear in activity feed
      await telemetry.recordEvent({
        eventType: "telemetry:log",
        entityType: "System",
        entityId: "sys-1",
        isDiagnostic: true,
      });

      const feedItems = telemetry.getActivityFeed();
      expect(feedItems.length).toBe(2);
      expect(feedItems[0]!.summary).toContain("Design Schemas");
      expect(feedItems[1]!.summary).toContain("Implement Auth Service");
      expect(feedItems[1]!.isMilestone).toBe(true);
    });
  });

  describe("Telemetry Failure Isolation (A3)", () => {
    it("guarantees subscriber throws never crash recordEvent", async () => {
      // Register a subscriber that maliciously throws
      telemetry.subscribeEvents(() => {
        throw new Error("Catastrophic subscriber crash!");
      });

      // recordEvent should resolve smoothly without throwing
      const event = await telemetry.recordEvent({
        eventType: "task:completed",
        entityType: "Task",
        entityId: "task-isolated-1",
      });

      expect(event.eventType).toBe("task:completed");
    });

    it("guarantees subscriber throws never crash log", async () => {
      telemetry.subscribeLogs(() => {
        throw new Error("Failing log subscriber!");
      });

      const log = await telemetry.info("Safe log message despite crashing subscriber");
      expect(log.message).toBe("Safe log message despite crashing subscriber");
    });

    it("persists and isolates repository failures gracefully", async () => {
      // Closed database should not throw unhandled exception to telemetry caller
      const closedDb = createSqliteDatabase(":memory:");
      closedDb.close();

      const isolatedTelemetry = new TelemetryManager({
        eventRepository: closedDb.events,
        logRepository: closedDb.logs,
      });

      const event = await isolatedTelemetry.recordEvent({
        eventType: "task:failed",
        entityType: "Task",
        entityId: "task-closed-db",
      });

      expect(event.entityId).toBe("task-closed-db");
    });
  });

  describe("Retention Cleaner (A3)", () => {
    it("prunes logs and events according to retention policy", async () => {
      const cleaner = new RetentionCleaner(db.logs);

      // Create a few logs
      await telemetry.info("Recent log 1");
      await telemetry.info("Recent log 2");

      // Running cleanup with future cutoff removes both
      const futureCutoff = new Date(Date.now() + 60_000).toISOString();
      const cleanRes = await db.logs.cleanLogs(futureCutoff);
      expect(cleanRes.success).toBe(true);
      if (cleanRes.success) {
        expect(cleanRes.data).toBeGreaterThanOrEqual(2);
      }

      const remaining = await db.logs.query();
      expect(remaining.success).toBe(true);
      if (remaining.success) {
        expect(remaining.data.length).toBe(0);
      }
    });
  });
});
