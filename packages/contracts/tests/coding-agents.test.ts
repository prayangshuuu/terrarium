/**
 * packages/contracts/tests/coding-agents.test.ts
 *
 * Unit tests for Universal Coding Agent domain contracts, validation, and categories.
 * Contributed by A1 (Platform & Architecture).
 */

import { describe, expect, it } from "bun:test";
import {
  CODING_AGENT_TYPES,
  CODING_AGENT_CATEGORIES,
  CODING_AGENT_COMPATIBILITY_TIERS,
  CODING_AGENT_INVOCATION_MODES,
  validateCodingAgentExecutionRequest,
  type CodingAgentMetadata,
  type CodingAgentExecutionRequest,
} from "../src/index.ts";

describe("Universal Coding Agent Domain Contracts (A1)", () => {
  it("defines standard coding agent tool types", () => {
    expect(CODING_AGENT_TYPES).toContain("claude_code");
    expect(CODING_AGENT_TYPES).toContain("codex_cli");
    expect(CODING_AGENT_TYPES).toContain("opencode");
    expect(CODING_AGENT_TYPES).toContain("gemini_cli");
    expect(CODING_AGENT_TYPES).toContain("cursor");
    expect(CODING_AGENT_TYPES).toContain("aider");
    expect(CODING_AGENT_TYPES).toContain("custom_subprocess");
  });

  it("defines integration categories and compatibility tiers", () => {
    expect(CODING_AGENT_CATEGORIES).toContain("cli_process");
    expect(CODING_AGENT_CATEGORIES).toContain("ide_agent");
    expect(CODING_AGENT_CATEGORIES).toContain("protocol_runtime");
    expect(CODING_AGENT_CATEGORIES).toContain("local_daemon");

    expect(CODING_AGENT_COMPATIBILITY_TIERS).toContain("supported");
    expect(CODING_AGENT_COMPATIBILITY_TIERS).toContain("partially_supported");
    expect(CODING_AGENT_COMPATIBILITY_TIERS).toContain("experimental");
    expect(CODING_AGENT_COMPATIBILITY_TIERS).toContain("unavailable");
    expect(CODING_AGENT_COMPATIBILITY_TIERS).toContain("not_tested");
  });

  it("defines execution invocation modes", () => {
    expect(CODING_AGENT_INVOCATION_MODES).toContain("headless_batch");
    expect(CODING_AGENT_INVOCATION_MODES).toContain("interactive_session");
    expect(CODING_AGENT_INVOCATION_MODES).toContain("acp_protocol");
    expect(CODING_AGENT_INVOCATION_MODES).toContain("mcp_protocol");
    expect(CODING_AGENT_INVOCATION_MODES).toContain("daemon_rpc");
  });

  it("validates a compliant CodingAgentExecutionRequest", () => {
    const valid: CodingAgentExecutionRequest = {
      taskId: "task-code-123",
      prompt: "Refactor database migrations to support UUID keys",
      workingDirectory: "/workspace/terrarium",
      contextFiles: ["packages/core/src/db.ts", "packages/core/src/migrations.ts"],
      readOnly: true,
      timeoutMs: 30000,
    };

    const res = validateCodingAgentExecutionRequest(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.taskId).toBe("task-code-123");
      expect(res.data.readOnly).toBe(true);
      expect(res.data.contextFiles?.length).toBe(2);
    }
  });

  it("rejects invalid CodingAgentExecutionRequest with missing required fields", () => {
    const invalid = {
      taskId: "",
      prompt: "Refactor code",
      // workingDirectory is missing
    };

    const res = validateCodingAgentExecutionRequest(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.length).toBeGreaterThan(0);
    }
  });
});
