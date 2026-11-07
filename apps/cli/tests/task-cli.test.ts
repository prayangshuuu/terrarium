/**
 * @terrarium/cli - tests/task-cli.test.ts
 *
 * Integration test suite for CLI task intake and planning command handlers.
 */

import { describe, expect, it } from "bun:test";
import { createCoreEngine } from "@terrarium/core";
import { handleTaskPlan, handleTaskIntake } from "../src/commands/task-commands.ts";

describe("CLI Task Planning Commands", () => {
  it("generates and formats a task plan for terminal display", async () => {
    const engine = createCoreEngine();
    const res = await handleTaskPlan(
      engine,
      "Conduct an architecture review of packages/core and verify domain contracts",
      { useColor: false }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("TERRARIUM TASK PLAN");
      expect(res.data).toContain("[PLAN READY]");
      expect(res.data).toContain("architecture_review");
      expect(res.data).toContain("engineering");
      expect(res.data).toContain("PROPOSED EXECUTION STEPS (DAG)");
      expect(res.data).toContain("RESOURCE & BUDGET ESTIMATE");
      expect(res.data).toContain("SELECTION RATIONALE");
    }
  });

  it("outputs a valid JSON representation of the plan when requested", async () => {
    const engine = createCoreEngine();
    const res = await handleTaskPlan(
      engine,
      "Write unit tests for packages/contracts/src/planning.ts",
      { json: true }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const parsed = JSON.parse(res.data);
      expect(parsed.id).toBeDefined();
      expect(parsed.classification.taskType).toBe("test_generation");
      expect(parsed.steps.length).toBe(3);
      expect(parsed.budgetEstimate.totalEstimatedTokens).toBeGreaterThan(0);
    }
  });

  it("outputs a GitHub Flavored Markdown document with Mermaid diagrams when requested", async () => {
    const engine = createCoreEngine();
    const res = await handleTaskPlan(
      engine,
      "Conduct an architecture review of packages/core",
      { markdown: true }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("# Terrarium Task Plan: architecture_review");
      expect(res.data).toContain("```mermaid");
      expect(res.data).toContain("flowchart TD");
      expect(res.data).toContain("## Execution Steps");
      expect(res.data).toContain("## Budget Estimate");
    }
  });

  it("renders clarification questions when request is ambiguous", async () => {
    const engine = createCoreEngine();
    const res = await handleTaskPlan(engine, "Fix the bug", { useColor: false });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("[NEEDS CLARIFICATION]");
      expect(res.data).toContain("MISSING FACTS & CLARIFICATION REQUIRED");
      expect(res.data).toContain("clarify_bug_details");
    }
  });

  it("renders high-risk warning and approval gates", async () => {
    const engine = createCoreEngine();
    const res = await handleTaskPlan(
      engine,
      "Drop all database tables and wipe schemas",
      { useColor: false }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("[RISK: CRITICAL]");
      expect(res.data).toContain("Destructive database operation");
    }
  });

  it("persists draft task when saveDraft is enabled with a database engine", async () => {
    const engine = createCoreEngine({ enableDatabase: true });
    const res = await handleTaskPlan(
      engine,
      "Conduct an architecture review of packages/contracts",
      { saveDraft: true, useColor: false }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("Draft Task persisted to database with ID: task_");
      expect(res.data).toContain("Status: draft");
    }

    await engine.shutdown();
  });
});
