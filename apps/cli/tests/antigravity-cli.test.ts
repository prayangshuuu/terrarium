/**
 * apps/cli/tests/antigravity-cli.test.ts
 *
 * Test suite for Antigravity CLI argument parsing and execution dispatch.
 * Contributed by A4 (Senior CLI/TUI Designer) & A1 (Platform & Architecture).
 * Aligns strictly with PROMPT 25 Phase G & L.
 */

import { describe, expect, it } from "bun:test";
import { parseAntigravityArgs, handleAntigravityCommand } from "../src/commands/antigravity-cli.ts";
import { AntigravityRunner } from "@terrarium/core";

describe("Antigravity CLI Argument Parsing & Runner (PROMPT 25 Phase G)", () => {
  it("parses empty args as non-antigravity", () => {
    const res = parseAntigravityArgs([]);
    expect(res.isAntigravity).toBe(false);
  });

  it("parses 'agy' command with default parameters", () => {
    const res = parseAntigravityArgs(["agy"]);
    expect(res.isAntigravity).toBe(true);
    expect(res.dryRun).toBe(false);
    expect(res.showHelp).toBe(false);
    expect(res.passthroughArgs).toEqual([]);
  });

  it("parses 'antigravity' alias", () => {
    const res = parseAntigravityArgs(["antigravity", "--dry-run"]);
    expect(res.isAntigravity).toBe(true);
    expect(res.dryRun).toBe(true);
  });

  it("parses --help and --version", () => {
    const helpRes = parseAntigravityArgs(["agy", "--help"]);
    expect(helpRes.showHelp).toBe(true);

    const verRes = parseAntigravityArgs(["agy", "--version"]);
    expect(verRes.showVersion).toBe(true);
  });

  it("forwards passthrough flags correctly", () => {
    const res = parseAntigravityArgs([
      "agy",
      "--model",
      "claude-3-7-sonnet",
      "-p",
      "inspect architecture",
      "--workspace",
      "/tmp/workspace",
    ]);
    expect(res.isAntigravity).toBe(true);
    expect(res.workspaceRoot).toBe("/tmp/workspace");
    expect(res.passthroughArgs).toEqual(["--model", "claude-3-7-sonnet", "-p", "inspect architecture"]);
  });

  it("executes dry-run cleanly with mock or discovered binary", async () => {
    const mockRunner = new AntigravityRunner();
    mockRunner.discoverExecutable = async () => ({
      found: true,
      executablePath: "/usr/local/bin/agy",
      version: "1.5.7",
      searchLocations: ["/usr/local/bin/agy"],
    });

    const exitCode = await handleAntigravityCommand(["agy", "--dry-run", "-p", "test prompt"], mockRunner);
    expect(exitCode).toBe(0);
  });

  it("returns exit code 1 when binary is not found", async () => {
    const mockRunner = new AntigravityRunner();
    mockRunner.discoverExecutable = async () => ({
      found: false,
      error: "Not found",
      searchLocations: ["/dummy/agy"],
    });

    const exitCode = await handleAntigravityCommand(["agy", "--dry-run"], mockRunner);
    expect(exitCode).toBe(1);
  });
});
