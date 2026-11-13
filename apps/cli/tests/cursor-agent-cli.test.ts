/**
 * apps/cli/tests/cursor-agent-cli.test.ts
 *
 * Test suite for Cursor Agent CLI argument parsing and execution dispatch.
 * Contributed by A4 (Senior CLI/TUI Designer) & A1 (Platform & Architecture).
 * Aligns strictly with PROMPT 25 Phase G & L.
 */

import { describe, expect, it } from "bun:test";
import { parseCursorAgentArgs, handleCursorAgentCommand } from "../src/commands/cursor-agent-cli.ts";
import { CursorAgentRunner } from "@terrarium/core";

describe("Cursor Agent CLI Argument Parsing & Runner (PROMPT 25 Phase G)", () => {
  it("parses empty args as non-cursor-agent", () => {
    const res = parseCursorAgentArgs([]);
    expect(res.isCursorAgent).toBe(false);
  });

  it("parses 'agent' command with default parameters", () => {
    const res = parseCursorAgentArgs(["agent"]);
    expect(res.isCursorAgent).toBe(true);
    expect(res.dryRun).toBe(false);
    expect(res.showHelp).toBe(false);
    expect(res.passthroughArgs).toEqual([]);
  });

  it("parses 'cursor' alias", () => {
    const res = parseCursorAgentArgs(["cursor", "--dry-run"]);
    expect(res.isCursorAgent).toBe(true);
    expect(res.dryRun).toBe(true);
  });

  it("parses --help and --version", () => {
    const helpRes = parseCursorAgentArgs(["agent", "--help"]);
    expect(helpRes.showHelp).toBe(true);

    const verRes = parseCursorAgentArgs(["agent", "--version"]);
    expect(verRes.showVersion).toBe(true);
  });

  it("forwards passthrough flags correctly", () => {
    const res = parseCursorAgentArgs([
      "agent",
      "--plan",
      "--model",
      "claude-opus-4-8",
      "-p",
      "audit code",
      "--workspace",
      "/tmp/workspace",
    ]);
    expect(res.isCursorAgent).toBe(true);
    expect(res.workspaceRoot).toBe("/tmp/workspace");
    expect(res.passthroughArgs).toEqual(["--plan", "--model", "claude-opus-4-8", "-p", "audit code"]);
  });

  it("executes dry-run cleanly with mock or discovered binary", async () => {
    const mockRunner = new CursorAgentRunner();
    mockRunner.discoverExecutable = async () => ({
      found: true,
      executablePath: "/usr/local/bin/agent",
      version: "2026.09.18",
      searchLocations: ["/usr/local/bin/agent"],
    });

    const exitCode = await handleCursorAgentCommand(["agent", "--dry-run", "--plan"], mockRunner);
    expect(exitCode).toBe(0);
  });

  it("returns exit code 1 when binary is not found", async () => {
    const mockRunner = new CursorAgentRunner();
    mockRunner.discoverExecutable = async () => ({
      found: false,
      error: "Not found",
      searchLocations: ["/dummy/agent"],
    });

    const exitCode = await handleCursorAgentCommand(["agent", "--dry-run"], mockRunner);
    expect(exitCode).toBe(1);
  });
});
