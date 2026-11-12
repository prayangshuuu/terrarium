/**
 * packages/core/tests/coding-agent-adapters.test.ts
 *
 * Unit and integration tests for Universal Coding Agent Adapters.
 * Tests adapter registration, capability metadata, detection, subprocess execution,
 * argument array safety (no shell interpolation), cancellation, timeouts, and secret scrubbing.
 * Contributed by A2 (Orchestration & AI Runtime) & A3 (Security, Data & Reliability).
 */

import { describe, expect, it } from "bun:test";
import {
  createCodingAgentRegistry,
  ClaudeCodeAdapter,
  CodexCliAdapter,
  OpenCodeAdapter,
  GeminiCliAdapter,
  CursorAdapter,
  AiderAdapter,
  GenericSubprocessAdapter,
} from "../src/index.ts";

describe("Universal Coding Agent Adapters Suite (A2 & A3)", () => {
  it("registers canonical adapters in CodingAgentRegistry", () => {
    const registry = createCodingAgentRegistry();
    const adapters = registry.listAdapters();
    expect(adapters.length).toBeGreaterThanOrEqual(6);

    expect(registry.getAdapter("claude_code")).toBeDefined();
    expect(registry.getAdapter("codex_cli")).toBeDefined();
    expect(registry.getAdapter("opencode")).toBeDefined();
    expect(registry.getAdapter("gemini_cli")).toBeDefined();
    expect(registry.getAdapter("cursor")).toBeDefined();
    expect(registry.getAdapter("aider")).toBeDefined();
  });

  it("produces an honest compatibility matrix with exact capabilities and limitations", () => {
    const registry = createCodingAgentRegistry();
    const matrix = registry.getCompatibilityMatrix();

    // Verify Claude Code
    const claudeEntry = matrix.find((m) => m.id === "claude_code");
    expect(claudeEntry).toBeDefined();
    expect(claudeEntry?.executableName).toBe("claude");
    expect(claudeEntry?.compatibility).toBe("supported");
    expect(claudeEntry?.supportedModes).toContain("headless_batch");

    // Verify Codex CLI
    const codexEntry = matrix.find((m) => m.id === "codex_cli");
    expect(codexEntry).toBeDefined();
    expect(codexEntry?.executableName).toBe("codex");
    expect(codexEntry?.compatibility).toBe("supported");

    // Verify OpenCode
    const openCodeEntry = matrix.find((m) => m.id === "opencode");
    expect(openCodeEntry).toBeDefined();
    expect(openCodeEntry?.supportedModes).toContain("acp_protocol");

    // Verify Cursor honest limitation
    const cursorEntry = matrix.find((m) => m.id === "cursor");
    expect(cursorEntry).toBeDefined();
    expect(cursorEntry?.compatibility).toBe("partially_supported");
    expect(cursorEntry?.limitations.some((l) => l.includes("IDE"))).toBe(true);

    // Verify Aider unavailable
    const aiderEntry = matrix.find((m) => m.id === "aider");
    expect(aiderEntry).toBeDefined();
    expect(aiderEntry?.compatibility).toBe("unavailable");
  });

  it("detects host installed executables dynamically", async () => {
    const registry = createCodingAgentRegistry();
    const discovered = await registry.discoverHostTools();
    expect(discovered.length).toBeGreaterThanOrEqual(6);

    const claudeMeta = discovered.find((m) => m.id === "claude_code");
    // Since /Users/prayangshuuu/.local/bin/claude is on host PATH
    expect(claudeMeta?.isInstalled).toBe(true);

    const aiderMeta = discovered.find((m) => m.id === "aider");
    // aider was not found on host
    expect(aiderMeta?.isInstalled).toBe(false);
  });

  it("executes custom subprocess adapter safely with argument arrays and secret scrubbing", async () => {
    // Test with standard echo command as custom subprocess
    const adapter = new GenericSubprocessAdapter({
      executableName: "echo",
      argumentTemplate: ["Execution complete for: {prompt}"],
    });

    const chunks: string[] = [];
    const res = await adapter.execute(
      {
        taskId: "task-subproc-1",
        prompt: "Refactor database with key sk-ant-api03-abcdef12345678901234567890",
        workingDirectory: process.cwd(),
      },
      (chunk) => chunks.push(chunk)
    );

    expect(res.success).toBe(true);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain("Execution complete");
    // Secret must be scrubbed automatically
    expect(res.stdout).not.toContain("sk-ant-api03-abcdef12345678901234567890");
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("enforces timeout watchdog and terminates hanging subprocesses", async () => {
    // Run sleep command with a 50ms timeout
    const adapter = new GenericSubprocessAdapter({
      executableName: "sleep",
      argumentTemplate: ["2"],
      defaultTimeoutMs: 50,
    });

    const res = await adapter.execute({
      taskId: "task-hang-1",
      prompt: "hang",
      workingDirectory: process.cwd(),
      timeoutMs: 50,
    });

    expect(res.success).toBe(false);
    expect(res.timedOut).toBe(true);
    expect(res.error).toContain("timeout");
  });

  it("supports process cancellation cleanly via cancel(taskId)", async () => {
    const adapter = new GenericSubprocessAdapter({
      executableName: "sleep",
      argumentTemplate: ["5"],
    });

    const executionPromise = adapter.execute({
      taskId: "task-cancel-1",
      prompt: "long_task",
      workingDirectory: process.cwd(),
      timeoutMs: 10000,
    });

    // Cancel after 50ms
    setTimeout(async () => {
      const cancelled = await adapter.cancel("task-cancel-1");
      expect(cancelled).toBe(true);
    }, 50);

    const res = await executionPromise;
    expect(res.exitCode).not.toBe(0);
  });

  it("honestly explains Cursor limitation when invoked without active IDE", async () => {
    const cursor = new CursorAdapter();
    const res = await cursor.execute({
      taskId: "task-cursor-1",
      prompt: "Fix bug",
      workingDirectory: process.cwd(),
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Cursor requires active IDE installation");
  });

  it("honestly explains Aider unavailable status when binary is missing", async () => {
    const aider = new AiderAdapter();
    const res = await aider.execute({
      taskId: "task-aider-1",
      prompt: "Add tests",
      workingDirectory: process.cwd(),
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("unavailable");
  });
});
