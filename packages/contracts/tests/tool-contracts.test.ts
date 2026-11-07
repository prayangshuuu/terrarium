import { describe, it, expect } from "bun:test";
import {
  TOOL_RISK_LEVELS,
  TOOL_RISK_SEVERITY,
  TOOL_SIDE_EFFECT_CLASSES,
  TOOL_PERMISSIONS,
  type ToolDefinition,
  type ToolJsonSchema,
  validateToolJsonSchema,
  validateToolInput,
  validateToolOutput,
  validateToolDefinition,
  ToolNotFoundError,
  ToolValidationError,
  ToolExecutionError,
  ToolTimeoutError,
  ApprovalRequiredError,
  ApprovalRejectedError,
  ApprovalExpiredError,
  ApprovalCancelledError,
  DuplicateExecutionError,
  isValidApprovalTransition,
  assertApprovalTransition,
  validateApprovalRequest,
  type ApprovalRequest,
  ok,
} from "../src/index.ts";

describe("Tool Contracts & Schemas Suite (A1)", () => {
  describe("Metadata, Risk Severity, and Side-Effects", () => {
    it("defines canonical risk levels with monotonic severity order", () => {
      expect(TOOL_RISK_LEVELS).toEqual(["read_only", "low", "medium", "high", "critical"]);
      expect(TOOL_RISK_SEVERITY.read_only).toBeLessThan(TOOL_RISK_SEVERITY.low);
      expect(TOOL_RISK_SEVERITY.low).toBeLessThan(TOOL_RISK_SEVERITY.medium);
      expect(TOOL_RISK_SEVERITY.medium).toBeLessThan(TOOL_RISK_SEVERITY.high);
      expect(TOOL_RISK_SEVERITY.high).toBeLessThan(TOOL_RISK_SEVERITY.critical);
    });

    it("defines standard side-effect classes and permissions", () => {
      expect(TOOL_SIDE_EFFECT_CLASSES).toContain("none");
      expect(TOOL_SIDE_EFFECT_CLASSES).toContain("idempotent");
      expect(TOOL_SIDE_EFFECT_CLASSES).toContain("state_mutating");
      expect(TOOL_SIDE_EFFECT_CLASSES).toContain("consequential");

      expect(TOOL_PERMISSIONS).toContain("file:read");
      expect(TOOL_PERMISSIONS).toContain("file:write");
      expect(TOOL_PERMISSIONS).toContain("file:delete");
      expect(TOOL_PERMISSIONS).toContain("shell:execute");
      expect(TOOL_PERMISSIONS).toContain("git:push");
      expect(TOOL_PERMISSIONS).toContain("publish:external");
      expect(TOOL_PERMISSIONS).toContain("deploy:production");
      expect(TOOL_PERMISSIONS).toContain("message:send");
    });
  });

  describe("Schema Validation (Input & Output)", () => {
    const sampleSchema: ToolJsonSchema = {
      type: "object",
      description: "Sample tool schema",
      properties: {
        path: { type: "string", description: "Target file path" },
        encoding: { type: "string", default: "utf-8", enum: ["utf-8", "ascii", "binary"] },
        limit: { type: "number", default: 100 },
        verbose: { type: "boolean", default: false },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["path"],
      additionalProperties: false,
    };

    it("validates valid input and applies default values", () => {
      const res = validateToolInput("fs.read_file", sampleSchema, {
        path: "/var/log/test.log",
        tags: ["syslog", "auth"],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.path).toBe("/var/log/test.log");
        expect(res.data.encoding).toBe("utf-8"); // Default applied
        expect(res.data.limit).toBe(100); // Default applied
        expect(res.data.verbose).toBe(false); // Default applied
        expect(res.data.tags).toEqual(["syslog", "auth"]);
      }
    });

    it("fails validation when a required property is missing", () => {
      const res = validateToolInput("fs.read_file", sampleSchema, {
        encoding: "utf-8",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ToolValidationError);
        expect(res.error.direction).toBe("input");
        expect(res.error.toolId).toBe("fs.read_file");
        expect(res.error.issues.some((i) => i.path === "path")).toBe(true);
      }
    });

    it("fails validation when property type does not match schema", () => {
      const res = validateToolInput("fs.read_file", sampleSchema, {
        path: 12345, // Should be string
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => i.path === "path")).toBe(true);
      }
    });

    it("fails validation when enum constraint is violated", () => {
      const res = validateToolInput("fs.read_file", sampleSchema, {
        path: "test.txt",
        encoding: "invalid-encoding",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => i.path === "encoding")).toBe(true);
      }
    });

    it("rejects unauthorized additional properties when additionalProperties=false", () => {
      const res = validateToolInput("fs.read_file", sampleSchema, {
        path: "test.txt",
        maliciousParam: "DROP DATABASE",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => i.path === "maliciousParam")).toBe(true);
      }
    });

    it("validates output schema matching result", () => {
      const outSchema: ToolJsonSchema = {
        type: "object",
        properties: {
          bytesRead: { type: "number" },
          content: { type: "string" },
        },
        required: ["content"],
      };

      const validRes = validateToolOutput("fs.read_file", outSchema, {
        bytesRead: 42,
        content: "hello world",
      });
      expect(validRes.success).toBe(true);

      const invalidRes = validateToolOutput("fs.read_file", outSchema, {
        bytesRead: 42,
        // missing required content
      });
      expect(invalidRes.success).toBe(false);
    });
  });

  describe("ToolDefinition Validation", () => {
    it("accepts a compliant tool definition", () => {
      const validTool: ToolDefinition = {
        id: "fs.read_file",
        name: "Read File",
        description: "Reads file content from the filesystem",
        category: "filesystem",
        version: "1.0.0",
        riskLevel: "read_only",
        sideEffectClass: "idempotent",
        requiredPermissions: ["file:read"],
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
        defaultTimeoutMs: 5000,
        maxTimeoutMs: 30000,
        requiresApproval: false,
        isConsequential: false,
        execute: async () => ok({ content: "ok" }),
      };

      const res = validateToolDefinition(validTool);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe("fs.read_file");
        expect(res.data.riskLevel).toBe("read_only");
      }
    });

    it("rejects tool definition with invalid timeouts or missing execute", () => {
      const badTool = {
        id: "fs.bad_tool",
        name: "Bad Tool",
        description: "Bad",
        category: "test",
        version: "1.0.0",
        riskLevel: "invalid_risk",
        sideEffectClass: "none",
        requiredPermissions: [],
        inputSchema: { type: "object", properties: {} },
        defaultTimeoutMs: 50, // Below min 100
        maxTimeoutMs: 1000000, // Above max 600000
        // missing execute function
      };

      const res = validateToolDefinition(badTool);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Approval State Transitions & Lifecycle (Including Cancelled)", () => {
    it("allows transition from pending to approved, rejected, expired, or cancelled", () => {
      expect(isValidApprovalTransition("pending", "approved")).toBe(true);
      expect(isValidApprovalTransition("pending", "rejected")).toBe(true);
      expect(isValidApprovalTransition("pending", "expired")).toBe(true);
      expect(isValidApprovalTransition("pending", "cancelled")).toBe(true);
    });

    it("prevents transitions out of terminal states (approved, rejected, expired, cancelled)", () => {
      expect(isValidApprovalTransition("approved", "rejected")).toBe(false);
      expect(isValidApprovalTransition("rejected", "pending")).toBe(false);
      expect(isValidApprovalTransition("expired", "approved")).toBe(false);
      expect(isValidApprovalTransition("cancelled", "approved")).toBe(false);
      expect(isValidApprovalTransition("cancelled", "pending")).toBe(false);

      const res = assertApprovalTransition("cancelled", "approved");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.name).toBe("InvalidStateTransitionError");
      }
    });

    it("validates approval requests with consequential action types", () => {
      const now = new Date().toISOString();
      const approval: ApprovalRequest = {
        id: "appr-001",
        taskId: "task-001",
        actionType: "external_publish",
        description: "Publish package to npm registry",
        status: "pending",
        requestedByAgentId: "agent-dev-01",
        requestedAt: now,
        toolId: "external.publish",
        riskLevel: "critical",
        payloadHash: "sha256:abc123456",
        isExecuted: false,
        payload: { packageName: "@terrarium/core", version: "1.0.0" },
        createdAt: now,
        updatedAt: now,
      };

      const res = validateApprovalRequest(approval);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.actionType).toBe("external_publish");
        expect(res.data.payloadHash).toBe("sha256:abc123456");
      }
    });
  });

  describe("Strongly Typed Error Classes", () => {
    it("creates and serializes ToolNotFoundError", () => {
      const err = new ToolNotFoundError("fs.non_existent");
      expect(err.code).toBe("TOOL_NOT_FOUND");
      expect(err.name).toBe("ToolNotFoundError");
      expect(err.entityId).toBe("fs.non_existent");
      expect(err.toJSON().code).toBe("TOOL_NOT_FOUND");
    });

    it("creates and serializes ToolTimeoutError", () => {
      const err = new ToolTimeoutError("shell.run_command", 15000);
      expect(err.code).toBe("TOOL_TIMEOUT");
      expect(err.timeoutMs).toBe(15000);
      expect(err.toolId).toBe("shell.run_command");
    });

    it("creates and serializes ApprovalRequiredError", () => {
      const err = new ApprovalRequiredError("appr-123", "fs.delete_file", "file_delete");
      expect(err.code).toBe("APPROVAL_REQUIRED");
      expect(err.approvalId).toBe("appr-123");
      expect(err.toolId).toBe("fs.delete_file");
      expect(err.actionType).toBe("file_delete");
    });

    it("creates and serializes ApprovalRejectedError, ExpiredError, CancelledError", () => {
      const rejected = new ApprovalRejectedError("appr-123", "Too risky");
      expect(rejected.code).toBe("APPROVAL_REJECTED");
      expect(rejected.approvalId).toBe("appr-123");
      expect(rejected.reason).toBe("Too risky");

      const expired = new ApprovalExpiredError("appr-123");
      expect(expired.code).toBe("APPROVAL_EXPIRED");

      const cancelled = new ApprovalCancelledError("appr-123", "User aborted task");
      expect(cancelled.code).toBe("APPROVAL_CANCELLED");
      expect(cancelled.reason).toBe("User aborted task");
    });

    it("creates and serializes DuplicateExecutionError", () => {
      const err = new DuplicateExecutionError("appr-123:fs.delete_file");
      expect(err.code).toBe("DUPLICATE_EXECUTION");
      expect(err.actionKey).toBe("appr-123:fs.delete_file");
    });
  });
});
