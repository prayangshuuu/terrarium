/**
 * apps/cli - tests/orchestrator-cli.test.ts
 *
 * Tests CLI command handlers for bounded orchestration, demand-based selection,
 * live execution events, and selection explainability auditing.
 * Aligns with PLAN.md Section 5.2, 5.3 & 14 and Prompt 8 A4 (CLI/TUI UX).
 */

import { describe, expect, it } from "bun:test";
import { createCoreEngine } from "@terrarium/core";
import { handleTaskExecute } from "../src/commands/orchestrator-commands.ts";
import type { OrchestrationEvent } from "@terrarium/contracts";

describe("CLI Bounded Orchestration & Execution Commands", () => {
  it("executes task through CLI handler, captures live events, and renders summary", async () => {
    const engine = createCoreEngine();
    const capturedEvents: OrchestrationEvent[] = [];

    const res = await handleTaskExecute(
      engine,
      "Conduct an architecture review of packages/core and packages/contracts",
      {
        useColor: false,
        onEvent: (e) => capturedEvents.push(e),
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const { output, result } = res.data;

      // Check result contents
      expect(result.status).toBe("completed");
      expect(result.stepResults.length).toBeGreaterThan(0);
      expect(result.activeProfiles.length).toBeGreaterThanOrEqual(1);
      expect(result.dormantProfiles.length).toBeGreaterThan(10);

      // Check rendered terminal summary
      expect(output).toContain("TERRARIUM EXECUTION RESULT");
      expect(output).toContain("[STATUS: COMPLETED]");
      expect(output).toContain("TERRARIUM DEMAND-BASED SELECTION AUDIT");
      expect(output).toContain("Dormant Profiles:");

      // Check live event emission
      const eventTypes = capturedEvents.map((e) => e.type);
      expect(eventTypes).toContain("task_started");
      expect(eventTypes).toContain("profile_selected");
      expect(eventTypes).toContain("step_started");
      expect(eventTypes).toContain("step_completed");
      expect(eventTypes).toContain("task_completed");
    }
  });

  it("outputs structured JSON when --json flag is provided", async () => {
    const engine = createCoreEngine();

    const res = await handleTaskExecute(
      engine,
      "Write comprehensive unit tests for packages/contracts",
      { json: true }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const parsed = JSON.parse(res.data.output);
      expect(parsed.task).toBeDefined();
      expect(parsed.plan).toBeDefined();
      expect(parsed.stepResults).toBeInstanceOf(Array);
      expect(parsed.activeProfiles).toBeInstanceOf(Array);
      expect(parsed.dormantProfiles).toBeInstanceOf(Array);
      expect(parsed.metrics.tokensTotal).toBeGreaterThan(0);
    }
  });

  it("renders explainability audit when explainOnly flag is passed", async () => {
    const engine = createCoreEngine();

    const res = await handleTaskExecute(
      engine,
      "Simulate customer persona reactions to a $49/mo pricing tier",
      { explainOnly: true }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const { output } = res.data;
      expect(output).toContain("TERRARIUM DEMAND-BASED SELECTION AUDIT");
      expect(output).toContain("STEP-BY-STEP SELECTION RATIONALE");
      expect(output).toContain("DORMANT PROFILES AUDIT");
      // Does not contain full execution result header
      expect(output).not.toContain("TERRARIUM EXECUTION RESULT");
    }
  });

  it("respects CLI idempotency key across repeated runs", async () => {
    const engine = createCoreEngine();
    const idemKey = "cli_idem_key_42";

    const run1 = await handleTaskExecute(
      engine,
      "Conduct an architecture review of packages/core",
      { idempotencyKey: idemKey }
    );
    expect(run1.success).toBe(true);

    const run2 = await handleTaskExecute(
      engine,
      "Conduct an architecture review of packages/core",
      { idempotencyKey: idemKey }
    );
    expect(run2.success).toBe(true);

    if (run1.success && run2.success) {
      expect(run2.data.result.task.id).toBe(run1.data.result.task.id);
      expect(run2.data.result.metrics.tokensTotal).toBe(run1.data.result.metrics.tokensTotal);
    }
  });
});
