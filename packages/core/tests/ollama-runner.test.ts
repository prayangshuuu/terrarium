/**
 * packages/core/tests/ollama-runner.test.ts
 *
 * Test suite for OllamaRunner lifecycle, discovery, and argument vector construction.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 * Aligns with PROMPT 25 Phase H & L.
 */

import { describe, expect, it } from "bun:test";
import { OllamaRunner } from "../src/coding-agents/ollama-runner.ts";

describe("OllamaRunner Lifecycle & Execution (PROMPT 25 Phase H)", () => {
  const runner = new OllamaRunner();

  it("builds safe argument vector for 'ollama run <model>' without shell concatenation", () => {
    const cmd = runner.buildLaunchVector("/usr/local/bin/ollama", "llama3.2", [
      "Explain invariants",
    ]);
    expect(cmd).toEqual([
      "/usr/local/bin/ollama",
      "run",
      "llama3.2",
      "Explain invariants",
    ]);
  });

  it("probes executable discovery on host", async () => {
    const discovery = await runner.discoverExecutable();
    expect(discovery.searchLocations.length).toBeGreaterThan(0);
    if (discovery.found) {
      expect(discovery.executablePath).toBeDefined();
    }
  });

  it("fails if model is empty", async () => {
    const res = await runner.launch({
      model: "",
    });
    expect(res.success).toBe(false);
    expect(res.exitCode).toBe(1);
    expect(res.error).toContain("No Ollama model name provided");
  });

  it("handles dry-run execution without spawning child process", async () => {
    const res = await runner.launch({
      model: "llama3.2",
      passthroughArgs: ["--verbose"],
      dryRun: true,
      customExecutablePath: "/bin/sh",
    });
    expect(res.success).toBe(true);
    expect(res.exitCode).toBe(0);
    expect(res.command).toEqual(["/bin/sh", "run", "llama3.2", "--verbose"]);
  });
});
