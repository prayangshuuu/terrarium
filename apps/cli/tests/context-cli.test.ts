/**
 * @terrarium/cli - tests/context-cli.test.ts
 *
 * Tests for Context Assembly CLI Commands (A4 & A5):
 * - Context package assembly and visual inspection card
 * - Token budget gauge and breakdown
 * - Structured JSON output support
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { MemoryManager, ContextAssembler } from "@terrarium/core";
import {
  type AgentProfile,
  type Task,
} from "@terrarium/contracts";
import {
  handleContextAssemble,
  formatContextPackageCard,
} from "../src/commands/context-commands.ts";

describe("CLI Context Assembly Commands Suite (A4 & A5)", () => {
  let memoryManager: MemoryManager;
  let contextAssembler: ContextAssembler;

  const sampleAgent: AgentProfile = {
    id: "prof-01",
    slug: "engineering-lead",
    name: "Engineering Lead",
    displayName: "Engineering Lead",
    department: "engineering",
    role: "lead",
    description: "Leads technical design",
    systemPromptTemplate: "You are the lead engineer.",
    capabilities: [
      {
        id: "cap-code-analysis",
        name: "Code Analysis",
        description: "Analyzes source code",
        department: "engineering",
        requiredPermissions: [],
        isConsequential: false,
      },
    ],
    supportedTasks: ["code_review"],
    constraints: {
      maxTokensPerTurn: 10000,
      maxDelegationDepth: 2,
      maxChildrenTasks: 5,
      timeoutMs: 30000,
    },
    limits: { maxTokensPerTurn: 10000, maxDelegationDepth: 2, maxChildrenTasks: 5 },
    modelPreference: { tier: "standard" },
    permissions: ["read:code"],
    status: "available",
    version: "1.0.0",
    tags: ["lead"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleTask: Task = {
    id: "task-01",
    title: "Review Persistence Architecture",
    description: "Review SQLite persistence layer and WAL mode.",
    department: "engineering",
    status: "running",
    priority: "high",
    delegationDepth: 0,
    contextRefs: [],
    expectedDeliverables: ["architecture_review"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    memoryManager = new MemoryManager();
    contextAssembler = new ContextAssembler(memoryManager);

    await memoryManager.recordMemory(
      {
        category: "decision_rationale",
        key: "db_choice",
        content: "DEC-001: Selected SQLite with WAL mode.",
        confidence: "confirmed",
      },
      { projectId: "default", actorId: "operator", permissions: ["*"] }
    );
  });

  it("assembles context package and renders formatted terminal card with budget gauge", async () => {
    const res = await handleContextAssemble(
      {
        projectId: "default",
        taskId: sampleTask.id,
        agentSlug: sampleAgent.slug,
      },
      contextAssembler,
      {
        profile: sampleAgent,
        task: sampleTask,
        artifacts: [
          {
            id: "art-01",
            title: "Architecture Guide",
            pathOrUri: "docs/guides/architecture.md",
            artifactType: "markdown",
            summary: "Details hexagonal package boundaries",
          },
        ],
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.output).toContain("AGENT CONTEXT PACKAGE");
      expect(res.data.output).toContain("engineering-lead");
      expect(res.data.output).toContain("ENGINEERING");
      expect(res.data.output).toContain("TOKEN BUDGET:");
      expect(res.data.output).toContain("DURABLE DECISIONS RETAINED");
      expect(res.data.pkg.relevantMemories.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("outputs structured JSON when --json flag is provided", async () => {
    const res = await handleContextAssemble(
      {
        projectId: "default",
        taskId: sampleTask.id,
        agentSlug: sampleAgent.slug,
      },
      contextAssembler,
      {
        profile: sampleAgent,
        task: sampleTask,
        json: true,
      }
    );

    expect(res.success).toBe(true);
    if (res.success) {
      const parsed = JSON.parse(res.data.output);
      expect(parsed.agentSlug).toBe("engineering-lead");
      expect(parsed.department).toBe("engineering");
      expect(parsed.tokenEstimate).toBeDefined();
    }
  });
});
