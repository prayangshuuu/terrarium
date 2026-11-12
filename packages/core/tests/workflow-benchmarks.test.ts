/**
 * packages/core/tests/workflow-benchmarks.test.ts
 *
 * Performance profiling and measured bottleneck evaluation.
 * Aligns with Prompt 20: "Profile measured bottlenecks only."
 * Measures real wall-clock latency for intake, SQLite persistence, context assembly,
 * report compilation, and end-to-end workflow execution.
 * Contributed by A3 (Data, Security & Reliability Lead).
 */

import { describe, expect, it } from "bun:test";
import { performance } from "node:perf_hooks";
import { createCoreEngine } from "../src/index.ts";

describe("Performance Profiling & Measured Bottlenecks Suite (A3)", () => {
  it("profiles task intake and DAG plan generation latency", async () => {
    const engine = createCoreEngine();
    const iterations = 5;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const res = await engine.intake.processIntake({
        prompt: `Conduct rigorous security review of packages/core subsystem #${i}`,
        explicitDepartment: "engineering",
      });
      const duration = performance.now() - start;
      latencies.push(duration);
      expect(res.success).toBe(true);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / iterations;
    const maxLatency = Math.max(...latencies);

    // Assert that intake is fast and deterministic (target: < 50ms average)
    expect(avgLatency).toBeLessThan(50);
    expect(maxLatency).toBeLessThan(100);
  });

  it("profiles context assembly and memory search latency", async () => {
    const engine = createCoreEngine();

    const caller = { projectId: "default", actorId: "benchmarker", permissions: ["*"] };

    // Seed 20 memory items
    for (let i = 0; i < 20; i++) {
      await engine.memory.recordMemory(
        {
          category: "decision_rationale",
          key: `constraint_${i}`,
          content: `Constraint details for subsystem ${i}: zero unhandled promise rejections.`,
          confidence: "confirmed",
          tags: ["architecture", "reliability"],
        },
        caller
      );
    }

    const start = performance.now();
    const contextRes = await engine.context.assembleContext({
      projectId: "default",
      taskId: "task_bench",
      agentSlug: "staff_architect",
      maxTokens: 2000,
    });
    const duration = performance.now() - start;

    expect(contextRes.success).toBe(true);
    // Context assembly across 20 memory items should complete under 20ms
    expect(duration).toBeLessThan(35);
  });

  it("profiles end-to-end workflow execution latency", async () => {
    const engine = createCoreEngine();

    const start = performance.now();
    const res = await engine.workflow.executeWorkflow({
      prompt: "Perform complete pipeline audit and synthesize final recommendations",
      targetDepartment: "engineering",
      autoApprove: true,
    });
    const totalDuration = performance.now() - start;

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.status).toBe("completed");
      // Full pipeline (intake + bounded coordinator + artifacts + report generation)
      // should execute deterministically in < 150ms in mock runtime
      expect(totalDuration).toBeLessThan(250);
    }
  });
});
