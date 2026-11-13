/**
 * packages/core/tests/cursor-agent-runner.test.ts
 *
 * Test suite for CursorAgentRunner lifecycle, discovery, and argument vector construction.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 * Aligns with PROMPT 25 Phase H & L.
 */

import { describe, expect, it } from "bun:test";
import { CursorAgentRunner } from "../src/coding-agents/cursor-agent-runner.ts";

describe("CursorAgentRunner Lifecycle & Execution (PROMPT 25 Phase H)", () => {
  const runner = new CursorAgentRunner();

  it("builds safe argument vector without shell concatenation", () => {
    const cmd = runner.buildLaunchVector("/usr/local/bin/agent", [
      "-p",
      "Audit database integrity",
      "--plan",
    ]);
    expect(cmd).toEqual([
      "/usr/local/bin/agent",
      "-p",
      "Audit database integrity",
      "--plan",
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
    const discovery = await runner.discoverExecutable("/nonexistent/bin/agent");
    expect(discovery.found).toBe(false);
    expect(discovery.searchLocations).toContain("/nonexistent/bin/agent");
  });

  it("handles dry-run execution without spawning child process", async () => {
    const res = await runner.launch({
      passthroughArgs: ["--plan"],
      dryRun: true,
      customExecutablePath: "/bin/sh",
    });
    expect(res.success).toBe(true);
    expect(res.exitCode).toBe(0);
    expect(res.command).toEqual(["/bin/sh", "--plan"]);
  });
});
