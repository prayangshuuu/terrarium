/**
 * packages/core/tests/claude-code-runner.test.ts
 *
 * Unit and Lifecycle Tests for ClaudeCodeRunner.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 *
 * Verifies:
 * - Executable discovery and version probing.
 * - Standard mode preserves normal permission behavior (no dangerous flags).
 * - Explicit opt-in requirement for dangerous mode.
 * - Confirmation requirement before dangerous launch.
 * - Isolation gate enforcement (fail closed on invalid root).
 * - Safe array argument construction without shell concatenation.
 * - Dry-run returns accurate command vector and session metadata.
 * - Cancellation handling.
 */

import { describe, expect, it } from "bun:test";
import { ClaudeCodeRunner } from "../src/coding-agents/claude-code-runner.ts";
import path from "node:path";

describe("ClaudeCodeRunner Lifecycle & Execution Policy Suite (A1 & A2)", () => {
  it("discovers installed Claude Code executable or reports missing with search locations", async () => {
    const runner = new ClaudeCodeRunner();
    const discovery = await runner.discoverExecutable();

    expect(discovery.searchLocations.length).toBeGreaterThan(0);
    // On this host, claude is installed at /Users/prayangshuuu/.local/bin/claude
    if (discovery.found) {
      expect(discovery.executablePath).toBeDefined();
      expect(discovery.version).toBeDefined();
      expect(discovery.version).toContain("Claude Code");
    } else {
      expect(discovery.error).toBeDefined();
    }
  });

  it("probes custom executable path override successfully", async () => {
    const runner = new ClaudeCodeRunner();
    // Using bun as a mock executable
    const bunPath = process.execPath;
    const discovery = await runner.discoverExecutable(bunPath);

    expect(discovery.found).toBe(true);
    expect(discovery.executablePath).toBe(bunPath);
  });

  it("constructs argument vector for standard mode without --dangerously-skip-permissions", async () => {
    const runner = new ClaudeCodeRunner();
    const result = await runner.launch({
      rawArgs: ["claude", "code", "--model", "claude-3-7-sonnet"],
      passthroughArgs: ["--model", "claude-3-7-sonnet"],
      executionPolicy: "standard",
      explicitOptIn: false,
      confirmed: false,
      workspaceRoot: process.cwd(),
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.session.executionPolicy).toBe("standard");
    expect(result.session.argv).toContain("--model");
    expect(result.session.argv).toContain("claude-3-7-sonnet");
    expect(result.session.argv).not.toContain("--dangerously-skip-permissions");
  });

  it("fails closed when dangerous-permissions mode lacks explicit opt-in", async () => {
    const runner = new ClaudeCodeRunner();
    const result = await runner.launch({
      rawArgs: ["claude", "code"],
      passthroughArgs: [],
      executionPolicy: "isolated_bypass",
      explicitOptIn: false, // NOT opted in explicitly
      confirmed: true,
      workspaceRoot: process.cwd(),
      dryRun: true,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain("Explicit opt-in required");
    expect(result.session.state).toBe("failed");
  });

  it("fails closed when dangerous-permissions mode lacks operator confirmation", async () => {
    const runner = new ClaudeCodeRunner();
    const result = await runner.launch({
      rawArgs: ["claude", "code", "--dangerously-skip-permissions"],
      passthroughArgs: [],
      executionPolicy: "isolated_bypass",
      explicitOptIn: true,
      confirmed: false, // NOT confirmed
      workspaceRoot: process.cwd(),
      dryRun: true,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain("Operator confirmation required");
    expect(result.session.state).toBe("cancelled");
  });

  it("fails closed and refuses launch when isolation gate fails (e.g. root /)", async () => {
    const runner = new ClaudeCodeRunner();
    const rootDir = path.parse(process.cwd()).root;

    const result = await runner.launch({
      rawArgs: ["claude", "code", "--dangerously-skip-permissions"],
      passthroughArgs: [],
      executionPolicy: "isolated_bypass",
      explicitOptIn: true,
      confirmed: true,
      workspaceRoot: rootDir, // Root directory is rejected!
      dryRun: true,
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain("Isolation gate rejected launch");
    expect(result.session.isolationStatus).toBe("failed");
    expect(result.session.state).toBe("failed");
  });

  it("applies --dangerously-skip-permissions only inside verified isolated workspace with confirmed opt-in", async () => {
    const runner = new ClaudeCodeRunner();
    const result = await runner.launch({
      rawArgs: ["claude", "code", "--dangerously-skip-permissions", "-p", "audit"],
      passthroughArgs: ["-p", "audit"],
      executionPolicy: "isolated_bypass",
      explicitOptIn: true,
      confirmed: true,
      workspaceRoot: process.cwd(),
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.session.executionPolicy).toBe("isolated_bypass");
    expect(result.session.isolationStatus).toBe("verified");
    expect(result.session.argv).toContain("--dangerously-skip-permissions");
    expect(result.session.argv).toContain("-p");
    expect(result.session.argv).toContain("audit");
  });

  it("returns null or current session metadata correctly via getCurrentSession()", () => {
    const runner = new ClaudeCodeRunner();
    expect(runner.getCurrentSession()).toBeNull();
  });
});
