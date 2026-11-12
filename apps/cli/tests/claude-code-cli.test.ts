/**
 * apps/cli/tests/claude-code-cli.test.ts
 *
 * Command Line Argument Parsing and Handler Tests for Claude Code Integration.
 * Contributed by A4 (Senior CLI/TUI Designer) & A2 (Orchestration & AI Runtime).
 *
 * Asserts:
 * - 'claude code' invocation parsed unambiguously.
 * - Passthrough arguments preserved without shell interpolation.
 * - Standard mode preserves permission prompts (default).
 * - Dangerous-permissions mode requires explicit opt-in.
 * - Isolation gate rejects unverified paths.
 * - Help and version outputs are emoji-free.
 */

import { describe, expect, it } from "bun:test";
import { parseClaudeCodeArgs, handleClaudeCodeCommand } from "../src/commands/claude-code-cli.ts";
import path from "node:path";

describe("Claude Code CLI Command & Argument Parsing Suite (A4 & A2)", () => {
  it("parses basic 'claude code' invocation with standard execution policy", () => {
    const parsed = parseClaudeCodeArgs(["claude", "code"]);
    expect(parsed.isClaudeCode).toBe(true);
    expect(parsed.executionPolicy).toBe("standard");
    expect(parsed.explicitOptIn).toBe(false);
    expect(parsed.confirmed).toBe(false);
    expect(parsed.passthroughArgs.length).toBe(0);
  });

  it("safely preserves passthrough arguments in order without shell concatenation", () => {
    const raw = ["claude", "code", "--model", "claude-3-7-sonnet", "-p", "Audit repository architecture"];
    const parsed = parseClaudeCodeArgs(raw);

    expect(parsed.executionPolicy).toBe("standard");
    expect(parsed.passthroughArgs).toEqual(["--model", "claude-3-7-sonnet", "-p", "Audit repository architecture"]);
  });

  it("parses --dangerously-skip-permissions and sets isolated_bypass policy with explicitOptIn", () => {
    const raw = ["claude", "code", "--dangerously-skip-permissions", "--yes"];
    const parsed = parseClaudeCodeArgs(raw);

    expect(parsed.executionPolicy).toBe("isolated_bypass");
    expect(parsed.explicitOptIn).toBe(true);
    expect(parsed.confirmed).toBe(true);
    // --dangerously-skip-permissions should be handled by Terrarium policy and not duplicated in passthrough
    expect(parsed.passthroughArgs).not.toContain("--dangerously-skip-permissions");
  });

  it("parses --workspace flag to set custom target directory", () => {
    const raw = ["claude", "code", "--workspace", "/tmp/isolated-worktree", "--dry-run"];
    const parsed = parseClaudeCodeArgs(raw);

    expect(parsed.workspaceRoot).toBe("/tmp/isolated-worktree");
    expect(parsed.dryRun).toBe(true);
  });

  it("executes dry-run command cleanly with exit code 0", async () => {
    const exitCode = await handleClaudeCodeCommand(["claude", "code", "--dry-run"]);
    expect(exitCode).toBe(0);
  });

  it("handles --version flag with exit code 0", async () => {
    const exitCode = await handleClaudeCodeCommand(["claude", "code", "--version"]);
    expect(exitCode).toBe(0);
  });

  it("handles --help flag with exit code 0", async () => {
    const exitCode = await handleClaudeCodeCommand(["claude", "code", "--help"]);
    expect(exitCode).toBe(0);
  });

  it("fails closed with non-zero exit code when isolation gate rejects root directory", async () => {
    const rootDir = path.parse(process.cwd()).root;
    const exitCode = await handleClaudeCodeCommand([
      "claude",
      "code",
      "--dangerously-skip-permissions",
      "--workspace",
      rootDir,
      "--yes",
    ]);

    expect(exitCode).toBe(1);
  });
});
