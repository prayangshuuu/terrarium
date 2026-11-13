/**
 * packages/core/tests/antigravity-runner.test.ts
 *
 * Test suite for AntigravityRunner lifecycle, discovery, and argument vector construction.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 * Aligns with PROMPT 25 Phase H & L.
 */

import { describe, expect, it } from "bun:test";
import { AntigravityRunner } from "../src/coding-agents/antigravity-runner.ts";

describe("AntigravityRunner Lifecycle & Execution (PROMPT 25 Phase H)", () => {
  const runner = new AntigravityRunner();

  it("builds safe argument vector without shell concatenation", () => {
    const cmd = runner.buildLaunchVector("/usr/local/bin/agy", [
      "-p",
      "Analyze system boundaries",
      "--mode",
      "auto",
    ]);
    expect(cmd).toEqual([
      "/usr/local/bin/agy",
      "-p",
      "Analyze system boundaries",
      "--mode",
      "auto",
    ]);
  });

  it("probes executable discovery on host", async () => {
    const discovery = await runner.discoverExecutable();
    expect(discovery.searchLocations.length).toBeGreaterThan(0);
    if (discovery.found) {
      expect(discovery.executablePath).toBeDefined();
      expect(discovery.version).toBeDefined();
    }
  });

  it("handles custom executable path override", async () => {
    const discovery = await runner.discoverExecutable("/nonexistent/bin/agy");
    expect(discovery.found).toBe(false);
    expect(discovery.searchLocations).toContain("/nonexistent/bin/agy");
  });

  it("handles dry-run execution without spawning child process", async () => {
    const res = await runner.launch({
      passthroughArgs: ["--mode", "plan"],
      dryRun: true,
      customExecutablePath: "/bin/sh", // guaranteed executable on unix
    });
    expect(res.success).toBe(true);
    expect(res.exitCode).toBe(0);
    expect(res.command).toEqual(["/bin/sh", "--mode", "plan"]);
  });
});
