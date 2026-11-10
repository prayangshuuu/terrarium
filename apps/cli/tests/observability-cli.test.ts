/**
 * @terrarium/cli - tests/observability-cli.test.ts
 *
 * Tests for Observability, Activity Feed, and Structured Logs CLI commands (A4 & A5).
 * Validates terminal card rendering, milestone timeline formatting, metrics gauges,
 * secret redaction glyphs, and structured JSON outputs.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  TelemetryManager,
  createSqliteDatabase,
  type SqliteDatabase,
} from "@terrarium/core";
import {
  formatActivityFeedCard,
  formatMetricsCard,
  formatLogsCard,
  handleActivityFeed,
  handleMetricsSummary,
  handleLogsInspect,
} from "../src/commands/observability-commands.js";

describe("CLI Observability, Activity & Logs Suite (A4 & A5)", () => {
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

  describe("formatActivityFeedCard & handleActivityFeed", () => {
    it("renders formatted activity feed card with human milestone narratives", async () => {
      await telemetry.recordEvent({
        eventType: "task:created",
        entityType: "Task",
        entityId: "task-act-001",
        payload: { title: "Migrate Database Schema" },
      });

      await telemetry.recordEvent({
        eventType: "step:started",
        entityType: "TaskStep",
        entityId: "step-act-001",
        payload: { agentSlug: "lead-architect", title: "Plan Table DDL" },
      });

      const res = await handleActivityFeed(telemetry);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toContain("ACTIVITY FEED (HUMAN TIMELINE)");
        expect(res.data).toContain("Migrate Database Schema");
        expect(res.data).toContain("lead-architect");
        expect(res.data).toContain("Plan Table");
      }
    });

    it("outputs structured JSON when --json flag is provided for activity feed", async () => {
      await telemetry.recordEvent({
        eventType: "task:completed",
        entityType: "Task",
        entityId: "task-completed-1",
      });

      const res = await handleActivityFeed(telemetry, { json: true });
      expect(res.success).toBe(true);
      if (res.success) {
        const parsed = JSON.parse(res.data);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThan(0);
        expect(parsed[0].isMilestone).toBe(true);
      }
    });
  });

  describe("formatMetricsCard & handleMetricsSummary", () => {
    it("renders formatted metrics card with latency breakdown and spend estimation", async () => {
      telemetry.recordLatency(120);
      telemetry.recordLatency(250);
      telemetry.recordSuccess();
      telemetry.recordSuccess();
      telemetry.recordRetry();
      telemetry.recordQueueDelay(30);
      telemetry.recordUsage(8000, 0.08);

      const res = await handleMetricsSummary(telemetry);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toContain("RUNTIME TELEMETRY & SYSTEM PERFORMANCE");
        expect(res.data).toContain("SUCCESS RATE");
        expect(res.data).toContain("LATENCY DISTRIBUTION");
        expect(res.data).toContain("SCHEDULING & RETRIES");
        expect(res.data).toContain("8,000 tokens");
        expect(res.data).toContain("$0.0800 USD*");
        expect(res.data).toContain("*"); // estimate disclaimer
      }
    });

    it("outputs structured JSON when --json flag is provided for metrics summary", async () => {
      telemetry.recordSuccess();
      telemetry.recordFailure();

      const res = await handleMetricsSummary(telemetry, { json: true });
      expect(res.success).toBe(true);
      if (res.success) {
        const parsed = JSON.parse(res.data);
        expect(parsed.successCount).toBe(1);
        expect(parsed.failureCount).toBe(1);
        expect(parsed.successRatePercent).toBe(50.0);
        expect(parsed.isEstimate).toBe(true);
      }
    });
  });

  describe("formatLogsCard & handleLogsInspect", () => {
    it("renders formatted audit logs with redaction status and correlation IDs", async () => {
      await telemetry.info("User logged in with key sk-openai1234567890abcdef1234567890");
      await telemetry.warn("Transient rate limit encountered");

      const res = await handleLogsInspect(db.logs);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toContain("STRUCTURED AUDIT LOGS");
        expect(res.data).toContain("[INFO]");
        expect(res.data).toContain("[WARN]");
        expect(res.data).toContain("[REDACTED:OPENAI_");
        expect(res.data).toContain("🔒"); // redacted glyph
      }
    });

    it("outputs structured JSON when --json flag is provided for logs inspect", async () => {
      await telemetry.error("Operation failed");

      const res = await handleLogsInspect(db.logs, { json: true, level: "error" });
      expect(res.success).toBe(true);
      if (res.success) {
        const parsed = JSON.parse(res.data);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThan(0);
        expect(parsed[0].level).toBe("error");
      }
    });
  });
});
