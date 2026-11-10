/**
 * @terrarium/contracts - tests/telemetry-contracts.test.ts
 *
 * Tests for telemetry, correlation context, structured logs, and domain events contracts (A1).
 */

import { describe, it, expect } from "bun:test";
import {
  EVENT_TYPES,
  validateDomainEvent,
  validateCorrelationContext,
  validateStructuredLogRecord,
  DEFAULT_RETENTION_POLICY,
  TelemetryError,
  SecretLeakDetectedError,
} from "../src/index.js";

describe("Telemetry & Observability Contracts Suite (A1)", () => {
  describe("Domain Event Contracts", () => {
    it("recognizes all standard lifecycle event types including execution, usage, and telemetry", () => {
      expect(EVENT_TYPES).toContain("task:created");
      expect(EVENT_TYPES).toContain("execution:queued");
      expect(EVENT_TYPES).toContain("execution:started");
      expect(EVENT_TYPES).toContain("execution:completed");
      expect(EVENT_TYPES).toContain("execution:failed");
      expect(EVENT_TYPES).toContain("tool:invoked");
      expect(EVENT_TYPES).toContain("approval:requested");
      expect(EVENT_TYPES).toContain("usage:recorded");
      expect(EVENT_TYPES).toContain("budget:reserved");
      expect(EVENT_TYPES).toContain("artifact:published");
      expect(EVENT_TYPES).toContain("telemetry:metric");
      expect(EVENT_TYPES).toContain("telemetry:log");
    });

    it("validates a domain event with correlation IDs and diagnostic flag", () => {
      const raw = {
        id: "evt-test-1",
        eventType: "execution:started",
        source: "orchestrator",
        entityType: "Execution",
        entityId: "exec-123",
        correlationId: "corr-123",
        traceId: "trace-456",
        spanId: "span-789",
        level: "info",
        isDiagnostic: false,
        durationMs: 45,
        timestamp: new Date().toISOString(),
      };

      const res = validateDomainEvent(raw);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.correlationId).toBe("corr-123");
        expect(res.data.traceId).toBe("trace-456");
        expect(res.data.isDiagnostic).toBe(false);
        expect(res.data.durationMs).toBe(45);
      }
    });
  });

  describe("Correlation Context Validation", () => {
    it("validates a full correlation context", () => {
      const valid = {
        correlationId: "corr-abc",
        traceId: "trace-xyz",
        spanId: "span-001",
        parentSpanId: "span-parent",
        taskId: "task-001",
        stepId: "step-001",
        agentSlug: "lead-architect",
      };

      const res = validateCorrelationContext(valid);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.correlationId).toBe("corr-abc");
        expect(res.data.agentSlug).toBe("lead-architect");
      }
    });

    it("rejects context missing required correlationId or traceId", () => {
      const invalid = {
        spanId: "span-only",
      };

      const res = validateCorrelationContext(invalid);
      expect(res.success).toBe(false);
    });
  });

  describe("Structured Log Record Validation", () => {
    it("validates a structured log record with correlation and metadata", () => {
      const record = {
        id: "log-1",
        level: "info",
        message: "Agent activated for task step execution",
        correlation: {
          correlationId: "c-1",
          traceId: "t-1",
          agentSlug: "frontend-developer",
        },
        metadata: {
          attempt: 1,
        },
        isDiagnostic: false,
        isRedacted: true,
        timestamp: new Date().toISOString(),
      };

      const res = validateStructuredLogRecord(record);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.level).toBe("info");
        expect(res.data.isRedacted).toBe(true);
        expect(res.data.correlation.agentSlug).toBe("frontend-developer");
      }
    });

    it("rejects invalid log level", () => {
      const record = {
        id: "log-bad",
        level: "verbose_unsupported",
        message: "bad level",
        correlation: { correlationId: "c-1", traceId: "t-1" },
        timestamp: new Date().toISOString(),
      };

      const res = validateStructuredLogRecord(record);
      expect(res.success).toBe(false);
    });
  });

  describe("Telemetry Error Hierarchy", () => {
    it("constructs TelemetryError and SecretLeakDetectedError with correct codes", () => {
      const telErr = new TelemetryError("Failed to flush log buffer", { droppedCount: 5 });
      expect(telErr.code).toBe("TELEMETRY_ERROR");
      expect(telErr.details?.droppedCount).toBe(5);

      const leakErr = new SecretLeakDetectedError("API_KEY", "headers.authorization");
      expect(leakErr.code).toBe("SECRET_LEAK_DETECTED");
      expect(leakErr.secretType).toBe("API_KEY");
      expect(leakErr.message).toContain("authorization");
    });
  });

  describe("Default Retention Policy", () => {
    it("defines sensible default retention limits", () => {
      expect(DEFAULT_RETENTION_POLICY.maxLogAgeDays).toBe(30);
      expect(DEFAULT_RETENTION_POLICY.maxEventAgeDays).toBe(90);
      expect(DEFAULT_RETENTION_POLICY.maxLogRecords).toBe(50000);
      expect(DEFAULT_RETENTION_POLICY.maxEventRecords).toBe(100000);
    });
  });
});
