/**
 * apps/cli/tests/ollama-cli.test.ts
 *
 * Test suite for Ollama model CLI argument parsing and execution dispatch.
 * Contributed by A4 (Senior CLI/TUI Designer) & A1 (Platform & Architecture).
 * Aligns strictly with PROMPT 25 Phase G & L.
 */

import { describe, expect, it } from "bun:test";
import { parseOllamaArgs, handleOllamaCommand } from "../src/commands/ollama-cli.ts";
import { OllamaRunner } from "@terrarium/core";

describe("Ollama CLI Argument Parsing & Runner (PROMPT 25 Phase G)", () => {
  it("parses empty args as non-ollama", () => {
    const res = parseOllamaArgs([]);
    expect(res.isOllama).toBe(false);
  });

  it("parses '--ollama <model>' correctly", () => {
    const res = parseOllamaArgs(["--ollama", "llama3.2"]);
    expect(res.isOllama).toBe(true);
    expect(res.model).toBe("llama3.2");
    expect(res.dryRun).toBe(false);
  });

  it("parses 'ollama <model>' correctly", () => {
    const res = parseOllamaArgs(["ollama", "qwen2.5-coder"]);
    expect(res.isOllama).toBe(true);
    expect(res.model).toBe("qwen2.5-coder");
  });

  it("parses 'ollama run <model>' correctly", () => {
    const res = parseOllamaArgs(["ollama", "run", "deepseek-r1"]);
    expect(res.isOllama).toBe(true);
    expect(res.model).toBe("deepseek-r1");
  });

  it("forwards extra arguments as prompt or flags", () => {
    const res = parseOllamaArgs(["--ollama", "llama3.2", "Explain", "invariants", "--dry-run"]);
    expect(res.isOllama).toBe(true);
    expect(res.model).toBe("llama3.2");
    expect(res.dryRun).toBe(true);
    expect(res.passthroughArgs).toEqual(["Explain", "invariants"]);
  });

  it("fails if model is missing", async () => {
    const mockRunner = new OllamaRunner();
    mockRunner.discoverExecutable = async () => ({
      found: true,
      executablePath: "/usr/local/bin/ollama",
      version: "0.32.0",
      searchLocations: ["/usr/local/bin/ollama"],
    });

    const exitCode = await handleOllamaCommand(["--ollama"], mockRunner);
    expect(exitCode).toBe(1);
  });

  it("executes dry-run cleanly", async () => {
    const mockRunner = new OllamaRunner();
    mockRunner.discoverExecutable = async () => ({
      found: true,
      executablePath: "/opt/homebrew/bin/ollama",
      version: "0.32.0",
      searchLocations: ["/opt/homebrew/bin/ollama"],
    });

    const exitCode = await handleOllamaCommand(["--ollama", "llama3.2", "--dry-run"], mockRunner);
    expect(exitCode).toBe(0);
  });
});
