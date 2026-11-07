/**
 * @terrarium/core - tests/context-assembler.test.ts
 *
 * Tests for ContextAssembler and HistorySummarizer:
 * - Scoped per-agent context package assembly vs broadcasting
 * - Department category affinity filtering
 * - History summarization with preserved artifact/decision references
 * - Context token budgeting and graceful trimming
 * - Stale memory and conflict warnings
 * - Strict project isolation
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  type AgentProfile,
  type Task,
  type HistoryTurn,
  ContextBudgetExceededError,
} from "@terrarium/contracts";
import { createSqliteDatabase, SqliteDatabase } from "../src/persistence/index.ts";
import { MemoryManager } from "../src/memory/index.ts";
import {
  ContextAssembler,
  summarizeHistory,
  estimateTokens,
} from "../src/context/index.ts";

describe("Context Assembler & History Summarizer Suite (A2 & A3)", () => {
  let db: SqliteDatabase;
  let memoryManager: MemoryManager;
  let contextAssembler: ContextAssembler;

  const defaultCaller = {
    projectId: "proj-terrarium",
    actorId: "lead-coordinator",
    permissions: ["*"],
  };

  const sampleSecurityAgent: AgentProfile = {
    id: "prof-sec-01",
    slug: "security-auditor",
    name: "Security Compliance Auditor",
    department: "security",
    role: "specialist",
    description: "Evaluates cryptographic security, tool permissions, and secrets",
    systemPrompt: "You are a security auditor.",
    capabilities: ["security_audit", "vulnerability_scanning"],
    disallowedTools: [],
    limits: { maxTokensPerTask: 10000, maxExecutionTimeSeconds: 60, maxDelegationDepth: 1 },
    status: "active",
    version: "1.0.0",
    tags: ["security"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleDesignAgent: AgentProfile = {
    id: "prof-dsgn-01",
    slug: "ui-designer",
    name: "Design Specialist",
    department: "design",
    role: "specialist",
    description: "Designs terminal and web interfaces",
    systemPrompt: "You are a UI designer.",
    capabilities: ["design_system", "interaction_design"],
    disallowedTools: [],
    limits: { maxTokensPerTask: 10000, maxExecutionTimeSeconds: 60, maxDelegationDepth: 1 },
    status: "active",
    version: "1.0.0",
    tags: ["design"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleTask: Task = {
    id: "task-auth-audit",
    title: "Audit Authentication and Key Management",
    description: "Verify that credentials cannot leak into logs and tool permissions are enforced.",
    department: "security",
    status: "running",
    priority: "high",
    delegationDepth: 0,
    contextReferences: { scope: "packages/core/src/security" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    db = createSqliteDatabase(":memory:");
    memoryManager = new MemoryManager({ repository: db.memory });
    contextAssembler = new ContextAssembler(memoryManager);

    // Seed diverse project memories across multiple categories
    await memoryManager.recordMemory(
      {
        category: "architecture_knowledge",
        key: "credential_storage",
        content: "Zero unencrypted credential persistence in repo; use system keychain or env vars.",
        confidence: "confirmed",
      },
      defaultCaller
    );

    await memoryManager.recordMemory(
      {
        category: "known_risk",
        key: "token_exfiltration",
        content: "Tools executing shell commands could read process environment without redaction.",
        confidence: "confirmed",
      },
      defaultCaller
    );

    await memoryManager.recordMemory(
      {
        category: "decision_rationale",
        key: "sqlite_persistence",
        content: "DEC-001: Selected SQLite WAL mode for local zero-dependency durable storage.",
        confidence: "confirmed",
      },
      defaultCaller
    );

    await memoryManager.recordMemory(
      {
        category: "user_preference",
        key: "dark_terminal_theme",
        content: "Operator prefers 16-color ANSI with dark background and compact tables.",
        confidence: "confirmed",
      },
      defaultCaller
    );

    await memoryManager.recordMemory(
      {
        category: "confirmed_requirement",
        key: "no_data_leak",
        content: "Requirement: No API keys or authorization tokens may appear in log outputs or reports.",
        confidence: "confirmed",
      },
      defaultCaller
    );
  });

  describe("History Summarization with Preserved References", () => {
    it("preserves small conversation turn count verbatim without summarization", () => {
      const turns: HistoryTurn[] = [
        { role: "user", content: "Please inspect docs/PLAN.md and run tests." },
        { role: "agent", content: "Inspected docs/PLAN.md; 281 tests passing." },
      ];
      const res = summarizeHistory(turns, { preserveRecentTurns: 3 });

      expect(res.originalTurnsCount).toBe(2);
      expect(res.summarizedTurnsCount).toBe(0);
      expect(res.summary).toContain("Please inspect docs/PLAN.md");
      expect(res.summary).toContain("281 tests passing");
      expect(res.retainedArtifacts).toContain("docs/PLAN.md");
    });

    it("summarizes long turn history while explicitly retaining decision, artifact, task, and commit citations", () => {
      const turns: HistoryTurn[] = [
        { role: "user", content: "Initial kickoff: review DEC-001 on database selection." },
        { role: "agent", content: "Under DEC-001 we chose SQLite. See docs/guides/persistence.md." },
        { role: "user", content: "Commit 09635e5 added provider adapter streaming." },
        { role: "agent", content: "Verified in task-deploy-01 with commit 8d779b1." },
        { role: "user", content: "Now check artifact docs/reports/SECURITY_AUDIT.md." },
        { role: "agent", content: "Security audit is complete and clean." },
        { role: "user", content: "Current focus: prompt 11 memory." },
      ];

      const res = summarizeHistory(turns, { preserveRecentTurns: 2 });

      expect(res.originalTurnsCount).toBe(7);
      expect(res.summarizedTurnsCount).toBe(5);
      expect(res.summary).toContain("Historical Summary (5 turns condensed)");
      expect(res.summary).toContain("Preserved References:");
      expect(res.summary).toContain("Recent Turns (2 preserved in full)");

      // Verify preserved citations
      expect(res.retainedDecisions).toContain("DEC-001");
      expect(res.retainedArtifacts).toContain("docs/guides/persistence.md");
      expect(res.retainedArtifacts).toContain("docs/reports/SECURITY_AUDIT.md");
      expect(res.retainedTasks).toContain("task-deploy-01");
      expect(res.retainedCommits).toContain("09635e5");
      expect(res.retainedCommits).toContain("8d779b1");
    });
  });

  describe("Per-Agent Tailored Context Packages", () => {
    it("assembles context tailored to security auditor: emphasizes risks and security architecture", async () => {
      const res = await contextAssembler.assembleContext(
        {
          projectId: "proj-terrarium",
          taskId: sampleTask.id,
          agentSlug: sampleSecurityAgent.slug,
        },
        {
          profile: sampleSecurityAgent,
          task: sampleTask,
        }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.agentSlug).toBe("security-auditor");
        expect(res.data.department).toBe("security");
        expect(res.data.taskContext.title).toBe(sampleTask.title);

        // Security agent receives security risks, architecture knowledge, and active constraints
        const keys = res.data.relevantMemories.map((m) => m.key);
        expect(keys).toContain("token_exfiltration");
        expect(keys).toContain("credential_storage");

        // Durable decisions and active constraints are always present
        expect(res.data.durableDecisions.length).toBeGreaterThanOrEqual(1);
        expect(res.data.activeConstraints).toContain(
          "Requirement: No API keys or authorization tokens may appear in log outputs or reports."
        );
      }
    });

    it("assembles context tailored to UI designer: emphasizes user preferences and UI requirements", async () => {
      const res = await contextAssembler.assembleContext(
        {
          projectId: "proj-terrarium",
          taskId: "task-ui-review",
          agentSlug: sampleDesignAgent.slug,
        },
        {
          profile: sampleDesignAgent,
          task: {
            ...sampleTask,
            id: "task-ui-review",
            title: "Design Terminal Navigation Layout",
            department: "design",
          },
        }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.department).toBe("design");
        const userPrefKeys = res.data.userPreferences.map((u) => u.key);
        expect(userPrefKeys).toContain("dark_terminal_theme");
      }
    });

    it("surfaces stale memory and conflict warnings in the context package", async () => {
      // Add a stale memory item
      const staleRes = await memoryManager.recordMemory(
        {
          category: "research_finding",
          key: "old_benchmark",
          content: "Historical benchmark measured 50 ops/sec.",
          confidence: "confirmed",
        },
        defaultCaller
      );
      if (!staleRes.success) throw staleRes.error;

      // Age the memory item 40 days
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      db.connection.getRawDb().run(
        "UPDATE memory_items SET created_at = ?, updated_at = ?, last_validated_at = ? WHERE id = ?;",
        [oldDate, oldDate, oldDate, staleRes.data.id]
      );

      // Add a conflicted memory item
      await memoryManager.recordMemory(
        {
          category: "known_risk",
          key: "concurrency_hazard",
          content: "Database concurrency is completely safe without locks.",
          confidence: "confirmed",
        },
        defaultCaller
      );
      await memoryManager.recordMemory(
        {
          category: "known_risk",
          key: "concurrency_hazard",
          content: "Concurrent SQLite writers require busy_timeout and WAL mode.",
          confidence: "confirmed",
        },
        defaultCaller
      );

      const pkgRes = await contextAssembler.assembleContext(
        {
          projectId: "proj-terrarium",
          taskId: sampleTask.id,
          agentSlug: sampleSecurityAgent.slug,
        },
        {
          profile: sampleSecurityAgent,
          task: sampleTask,
        }
      );

      expect(pkgRes.success).toBe(true);
      if (pkgRes.success) {
        const warnings = pkgRes.data.warnings.join("\n");
        expect(warnings).toContain("[STALE MEMORY]");
        expect(warnings).toContain("[CONFLICT WARNING]");
      }
    });

    it("enforces context token budget and trims non-critical content when over limit", async () => {
      // Assemble with a very small token limit (e.g. 50 tokens)
      const res = await contextAssembler.assembleContext(
        {
          projectId: "proj-terrarium",
          taskId: sampleTask.id,
          agentSlug: sampleSecurityAgent.slug,
          maxTokens: 100,
        },
        {
          profile: sampleSecurityAgent,
          task: sampleTask,
          historyTurns: [
            { role: "user", content: "Long preliminary discussion turn one with many verbose sentences." },
            { role: "agent", content: "Long response turn two with detailed explanations of architecture." },
            { role: "user", content: "Third turn asking about implementation specifics." },
            { role: "agent", content: "Fourth turn answering with full configuration samples." },
          ],
        }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.tokenLimit).toBe(100);
        // Warning should be recorded indicating trimming occurred
        const hasBudgetWarning = res.data.warnings.some((w) => w.includes("[CONTEXT BUDGET]"));
        expect(hasBudgetWarning).toBe(true);
      }
    });

    it("fails with ContextBudgetExceededError when strictBudget is enabled and limit exceeded", async () => {
      const res = await contextAssembler.assembleContext(
        {
          projectId: "proj-terrarium",
          taskId: sampleTask.id,
          agentSlug: sampleSecurityAgent.slug,
          maxTokens: 20, // Unrealistically tiny limit
        },
        {
          profile: sampleSecurityAgent,
          task: sampleTask,
          strictBudget: true,
        }
      );

      expect(res.success).toBe(false);
      expect(res.error).toBeInstanceOf(ContextBudgetExceededError);
    });

    it("strictly isolates project context: cannot assemble memories from another project", async () => {
      // Put a sensitive secret in another project
      await memoryManager.recordMemory(
        {
          category: "project_overview",
          key: "classified_feature",
          content: "Confidential Project B project overview.",
          confidence: "confirmed",
          projectId: "project-foreign",
        },
        { projectId: "project-foreign", actorId: "foreign-admin", permissions: ["*"] }
      );

      // Assemble context for project-terrarium
      const res = await contextAssembler.assembleContext(
        {
          projectId: "proj-terrarium",
          taskId: sampleTask.id,
          agentSlug: sampleSecurityAgent.slug,
        },
        {
          profile: sampleSecurityAgent,
          task: sampleTask,
        }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        const memoryKeys = res.data.relevantMemories.map((m) => m.key);
        expect(memoryKeys).not.toContain("classified_feature");
      }
    });
  });
});
