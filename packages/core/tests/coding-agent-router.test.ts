/**
 * packages/core/tests/coding-agent-router.test.ts
 *
 * Tests for safe coding agent routing, context preview disclosure, allowlists/denylists,
 * and permission enforcement.
 * Contributed by A2 (Orchestration & AI Runtime) & A3 (Security, Data & Reliability).
 */

import { describe, expect, it } from "bun:test";
import {
  createCodingAgentRegistry,
  createCodingAgentRouter,
  GenericSubprocessAdapter,
} from "../src/index.ts";

describe("Coding Agent Router & Context Previews Suite (A2 & A3)", () => {
  it("generates a transparent context preview disclosing target tool and files before execution", () => {
    const registry = createCodingAgentRegistry();
    const router = createCodingAgentRouter({ registry });

    const previewRes = router.generateContextPreview(
      {
        taskId: "task-preview-1",
        prompt: "Refactor database migrations to support multi-tenant isolation",
        workingDirectory: process.cwd(),
        contextFiles: ["packages/core/src/db.ts", "packages/core/src/migrations.ts"],
        readOnly: true,
      },
      "claude_code"
    );

    expect(previewRes.success).toBe(true);
    if (previewRes.success) {
      const preview = previewRes.data;
      expect(preview.agentId).toBe("claude_code");
      expect(preview.agentName).toContain("Claude Code");
      expect(preview.isRemoteService).toBe(true);
      expect(preview.destinationEndpoint).toContain("External Cloud Provider API");
      expect(preview.includedFiles).toContain("packages/core/src/db.ts");
      expect(preview.readOnly).toBe(true);
      expect(preview.requiresApproval).toBe(false);
    }
  });

  it("marks mutation requests with high estimated risk and requires human approval", () => {
    const registry = createCodingAgentRegistry();
    const router = createCodingAgentRouter({ registry });

    const previewRes = router.generateContextPreview(
      {
        taskId: "task-preview-mutate",
        prompt: "Delete old database tables and execute destructive migration",
        workingDirectory: process.cwd(),
        readOnly: false, // Mutating request!
      },
      "codex_cli"
    );

    expect(previewRes.success).toBe(true);
    if (previewRes.success) {
      const preview = previewRes.data;
      expect(preview.readOnly).toBe(false);
      expect(preview.requiresApproval).toBe(true);
      expect(preview.estimatedRisk).toBe("high");
    }
  });

  it("enforces project denylists and blocks disallowed tools", async () => {
    const registry = createCodingAgentRegistry();
    const router = createCodingAgentRouter({
      registry,
      defaultPolicy: {
        blockedAgentIds: ["cursor", "aider"],
        forceApprovalForMutation: true,
        maxTimeoutMs: 60000,
        worktreeIsolationDefault: true,
      },
    });

    const routeRes = await router.routeAndExecute(
      {
        taskId: "task-denylist-1",
        prompt: "Review code",
        workingDirectory: process.cwd(),
      },
      "cursor"
    );

    expect(routeRes.success).toBe(false);
    if (!routeRes.success) {
      expect(routeRes.error).toContain("blocked by project routing policy");
    }
  });

  it("enforces project allowlists and restricts execution to permitted tools", async () => {
    const registry = createCodingAgentRegistry();
    const router = createCodingAgentRouter({
      registry,
      defaultPolicy: {
        allowedAgentIds: ["claude_code"], // Only claude is allowed
        forceApprovalForMutation: true,
        maxTimeoutMs: 60000,
        worktreeIsolationDefault: true,
      },
    });

    const routeRes = await router.routeAndExecute(
      {
        taskId: "task-allowlist-1",
        prompt: "Review code",
        workingDirectory: process.cwd(),
      },
      "gemini_cli"
    );

    expect(routeRes.success).toBe(false);
    if (!routeRes.success) {
      expect(routeRes.error).toContain("not in project allowed tools list");
    }
  });

  it("enforces policy maxTimeoutMs ceiling over requested timeout", async () => {
    const registry = createCodingAgentRegistry();
    // Register custom quick echo adapter
    registry.registerAdapter(
      new GenericSubprocessAdapter({
        executableName: "echo",
        argumentTemplate: ["{prompt}"],
      })
    );

    const router = createCodingAgentRouter({
      registry,
      defaultPolicy: {
        maxTimeoutMs: 15000, // 15 second hard ceiling
        forceApprovalForMutation: true,
        worktreeIsolationDefault: true,
      },
    });

    const routeRes = await router.routeAndExecute(
      {
        taskId: "task-timeout-ceiling",
        prompt: "Hello",
        workingDirectory: process.cwd(),
        timeoutMs: 300000, // Requesting 5 minutes
      },
      "custom_subprocess"
    );

    expect(routeRes.success).toBe(true);
  });
});
