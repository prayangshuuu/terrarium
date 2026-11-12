/**
 * packages/core/tests/workflow-failures.test.ts
 *
 * Resilience and fault-tolerance test suite for end-to-end workflows.
 * Covers: cancellation, timeout, provider outage, rate limits, malformed output,
 * budget exhaustion, permission denial, and partial completion.
 * Contributed by A2 (Orchestration & AI Runtime) & A3 (Security & Reliability).
 */

import { describe, expect, it } from "bun:test";
import { createCoreEngine, WorkflowFailureInjector } from "../src/index.ts";

describe("Workflow Fault Tolerance & Failure Modes Suite (A2 & A3)", () => {
  it("handles mid-execution cancellation cleanly via AbortSignal", async () => {
    const engine = createCoreEngine();
    const controller = new AbortController();

    // Trigger abort right away
    controller.abort();

    const res = await engine.workflow.executeWorkflow(
      {
        prompt: "Run full security audit across all workspace files",
        autoApprove: true,
      },
      {
        signal: controller.signal,
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.status).toBe("cancelled");
      expect(record.stage).toBe("cancelled");
      expect(record.error?.code).toBe("CANCELLED");
      expect(record.error?.failureMode).toBe("cancellation");
    }
  });

  it("handles execution timeout cleanly when deadline is exceeded", async () => {
    const engine = createCoreEngine();
    const failureInjector = new WorkflowFailureInjector({
      failAtStage: "execution",
      failureMode: "timeout",
      errorMessage: "Task exceeded per-step timeout boundary (3000ms)",
    });

    const res = await engine.workflow.executeWorkflow(
      {
        prompt: "Execute long-running synthetic customer debate",
        autoApprove: true,
        timeoutMs: 3000,
      },
      {
        failureInjector,
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.status).toBe("failed");
      expect(record.stage).toBe("failed");
      expect(record.error?.code).toBe("TIMEOUT");
      expect(record.error?.failureMode).toBe("timeout");
      expect(record.error?.message).toContain("timeout boundary");
    }
  });

  it("handles upstream provider outage (503 Service Unavailable) without crashing", async () => {
    const engine = createCoreEngine();
    const failureInjector = new WorkflowFailureInjector({
      failAtStage: "execution",
      failureMode: "provider_outage",
      providerStatusCode: 503,
      errorMessage: "Anthropic Messages endpoint unavailable: HTTP 503 Service Unavailable",
    });

    const res = await engine.workflow.executeWorkflow(
      {
        prompt: "Synthesize competitive market research",
        autoApprove: true,
      },
      {
        failureInjector,
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.status).toBe("failed");
      expect(record.error?.code).toBe("PROVIDER_SERVER_ERROR");
      expect(record.error?.failureMode).toBe("provider_outage");
      expect(record.error?.message).toContain("HTTP 503");
    }
  });

  it("handles upstream rate limit errors (429 Too Many Requests) safely", async () => {
    const engine = createCoreEngine();
    const failureInjector = new WorkflowFailureInjector({
      failAtStage: "execution",
      failureMode: "rate_limit",
      providerStatusCode: 429,
      errorMessage: "OpenAI rate limit exceeded (tokens per minute); retry after 60s",
    });

    const res = await engine.workflow.executeWorkflow(
      {
        prompt: "Analyze large dataset across token limit",
        autoApprove: true,
      },
      {
        failureInjector,
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.status).toBe("failed");
      expect(record.error?.code).toBe("PROVIDER_RATE_LIMIT_ERROR");
      expect(record.error?.failureMode).toBe("rate_limit");
      expect(record.error?.message).toContain("rate limit exceeded");
    }
  });

  it("handles malformed JSON output from model provider with schema error", async () => {
    const engine = createCoreEngine();
    const failureInjector = new WorkflowFailureInjector({
      failAtStage: "execution",
      failureMode: "malformed_output",
      errorMessage: "Unexpected token < in JSON at position 0: received raw HTML error page",
    });

    const res = await engine.workflow.executeWorkflow(
      {
        prompt: "Generate structured task schema",
        autoApprove: true,
      },
      {
        failureInjector,
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.status).toBe("failed");
      expect(record.error?.code).toBe("VALIDATION_ERROR");
      expect(record.error?.failureMode).toBe("malformed_output");
      expect(record.error?.message).toContain("raw HTML error page");
    }
  });

  it("halts execution when token spend exceeds configured budget limit", async () => {
    const engine = createCoreEngine();
    const failureInjector = new WorkflowFailureInjector({
      failAtStage: "execution",
      failureMode: "budget_exhaustion",
      errorMessage: "Budget allocation of $0.05 USD exhausted; hard limit reached",
    });

    const res = await engine.workflow.executeWorkflow(
      {
        prompt: "Execute massive token search across large codebase",
        autoApprove: true,
        budgetLimitUsd: 0.05,
      },
      {
        failureInjector,
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.status).toBe("failed");
      expect(record.error?.code).toBe("BUDGET_EXCEEDED");
      expect(record.error?.failureMode).toBe("budget_exhaustion");
      expect(record.error?.message).toContain("hard limit reached");
    }
  });

  it("halts execution when permission is denied at approval gate", async () => {
    const engine = createCoreEngine();
    const failureInjector = new WorkflowFailureInjector({
      failAtStage: "approval",
      failureMode: "permission_denial",
      errorMessage: "Security policy prohibits production database alterations without VP sign-off",
    });

    const res = await engine.workflow.executeWorkflow(
      {
        prompt: "Alter production database schema",
        autoApprove: false,
      },
      {
        failureInjector,
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.status).toBe("failed");
      expect(record.stage).toBe("failed");
      expect(record.error?.stage).toBe("approval");
      expect(record.error?.code).toBe("APPROVAL_REJECTED");
      expect(record.error?.failureMode).toBe("permission_denial");
      expect(record.error?.message).toContain("Security policy prohibits");
    }
  });

  it("preserves partial completion and intermediate artifacts when step 2 fails", async () => {
    const engine = createCoreEngine();
    const failureInjector = new WorkflowFailureInjector({
      failAtStage: "execution",
      failureMode: "partial_completion",
      partialCompletionSteps: 1,
      errorMessage: "Step 2 failed; intermediate artifacts preserved",
    });

    const res = await engine.workflow.executeWorkflow(
      {
        prompt: "Multi-step code refactoring with test generation",
        autoApprove: true,
      },
      {
        failureInjector,
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.status).toBe("failed");
      expect(record.error?.failureMode).toBe("partial_completion");
      expect(record.artifacts.length).toBe(1);
      expect(record.artifacts[0]?.title).toBe("Partial Analysis Deliverable");
      expect(record.metrics.stepsCompleted).toBe(1);
    }
  });
});
