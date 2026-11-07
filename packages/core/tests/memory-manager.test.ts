/**
 * @terrarium/core - tests/memory-manager.test.ts
 *
 * Comprehensive tests for MemoryManager:
 * - Lifecycle (record, get, list, correct, revalidate, archive, delete)
 * - Conflict detection and resolution (preventing silent overwrite, preserved disagreements)
 * - Freshness and staleness evaluation
 * - Least-privilege permissions and access control
 * - Sensitive data / secret redaction
 * - Strict project isolation
 * - SQLite repository integration
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  type MemoryItem,
  type DomainEvent,
  CrossProjectContextLeakError,
  PermissionDeniedError,
  MemoryNotFoundError,
} from "@terrarium/contracts";
import { createSqliteDatabase, SqliteDatabase } from "../src/persistence/index.ts";
import {
  MemoryManager,
  evaluateMemoryFreshness,
  detectMemoryConflict,
  MemorySecurityEnforcer,
} from "../src/memory/index.ts";

describe("Project Memory Manager Suite (A1 & A3)", () => {
  let db: SqliteDatabase;
  let memoryManager: MemoryManager;
  const recordedEvents: DomainEvent[] = [];

  const defaultCaller = {
    projectId: "proj-terrarium",
    actorId: "lead-architect-01",
    permissions: ["*"],
  };

  beforeEach(() => {
    db = createSqliteDatabase(":memory:");
    recordedEvents.length = 0;
    memoryManager = new MemoryManager({
      repository: db.memory,
      onEvent: (event) => {
        recordedEvents.push(event);
      },
    });
  });

  describe("Lifecycle & Basic CRUD", () => {
    it("records a new memory item and dispatches memory:recorded event", async () => {
      const res = await memoryManager.recordMemory(
        {
          category: "decision_rationale",
          key: "database_choice",
          content: "Use SQLite with WAL mode for zero external dependency persistence.",
          confidence: "confirmed",
          tags: ["architecture", "database"],
          provenance: {
            sourceType: "debate",
            author: "lead-architect-01",
            rationale: "Evaluated Postgres vs SQLite; chose SQLite per PLAN.md Section 10.1",
          },
        },
        defaultCaller
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.key).toBe("database_choice");
        expect(res.data.category).toBe("decision_rationale");
        expect(res.data.confidence).toBe("confirmed");
        expect(res.data.projectId).toBe("proj-terrarium");
        expect(res.data.freshnessStatus).toBe("fresh");
        expect(res.data.isConflicted).toBe(false);
      }

      expect(recordedEvents.length).toBe(1);
      expect(recordedEvents[0]?.eventType).toBe("memory:recorded");
    });

    it("retrieves a memory item by ID and enforces project isolation", async () => {
      const recordRes = await memoryManager.recordMemory(
        {
          category: "confirmed_requirement",
          key: "contracts_leaf",
          content: "@terrarium/contracts must remain leaf level with zero dependencies.",
          confidence: "confirmed",
        },
        defaultCaller
      );
      if (!recordRes.success) throw recordRes.error;

      // Normal read within project
      const getRes = await memoryManager.getMemory(recordRes.data.id, defaultCaller);
      expect(getRes.success).toBe(true);
      if (getRes.success) {
        expect(getRes.data.id).toBe(recordRes.data.id);
        expect(getRes.data.key).toBe("contracts_leaf");
      }

      // Foreign project attempt -> CrossProjectContextLeakError
      const foreignCaller = {
        projectId: "proj-other",
        actorId: "rogue-agent",
        permissions: ["*"],
      };
      const leakRes = await memoryManager.getMemory(recordRes.data.id, foreignCaller);
      expect(leakRes.success).toBe(false);
      expect(leakRes.error).toBeInstanceOf(CrossProjectContextLeakError);
    });

    it("corrects an existing memory item with audit tracking", async () => {
      const recordRes = await memoryManager.recordMemory(
        {
          category: "known_risk",
          key: "token_burn",
          content: "Recursive subagents may burn tokens if unbounded.",
          confidence: "confirmed",
        },
        defaultCaller
      );
      if (!recordRes.success) throw recordRes.error;

      const correctRes = await memoryManager.correctMemory(
        recordRes.data.id,
        {
          content: "Recursive subagents bounded by maxDelegationDepth (default: 3) and budget checks.",
          confidence: "confirmed",
          tags: ["security", "bounds"],
        },
        defaultCaller
      );

      expect(correctRes.success).toBe(true);
      if (correctRes.success) {
        expect(correctRes.data.content).toContain("maxDelegationDepth");
        expect(correctRes.data.tags).toContain("bounds");
      }

      const updateEvents = recordedEvents.filter((e) => e.eventType === "memory:updated");
      expect(updateEvents.length).toBe(1);
    });

    it("archives and deletes memory items", async () => {
      const recordRes = await memoryManager.recordMemory(
        {
          category: "open_question",
          key: "web_studio_framework",
          content: "Will Web Studio use Svelte or React?",
          confidence: "hypothesis",
        },
        defaultCaller
      );
      if (!recordRes.success) throw recordRes.error;

      // Archive
      const archiveRes = await memoryManager.archiveMemory(recordRes.data.id, defaultCaller);
      expect(archiveRes.success).toBe(true);

      // Verify archived item is excluded by default list
      const listRes = await memoryManager.listMemories({}, defaultCaller);
      expect(listRes.success).toBe(true);
      if (listRes.success) {
        const found = listRes.data.find((m) => m.id === recordRes.data.id);
        expect(found).toBeUndefined();
      }

      // Delete permanently
      const deleteRes = await memoryManager.deleteMemory(recordRes.data.id, defaultCaller);
      expect(deleteRes.success).toBe(true);

      const getDeleted = await memoryManager.getMemory(recordRes.data.id, defaultCaller);
      expect(getDeleted.success).toBe(false);
      expect(getDeleted.error).toBeInstanceOf(MemoryNotFoundError);
    });
  });

  describe("Conflict Detection & Resolution (No Silent Clobbering)", () => {
    it("treats identical re-recording as an idempotent touch without conflict", async () => {
      const original = await memoryManager.recordMemory(
        {
          category: "architecture_knowledge",
          key: "ipc_model",
          content: "CLI and core communicate in-process with asynchronous Promise results.",
          confidence: "confirmed",
        },
        defaultCaller
      );
      if (!original.success) throw original.error;

      // Re-record exact same content
      const touchRes = await memoryManager.recordMemory(
        {
          category: "architecture_knowledge",
          key: "ipc_model",
          content: "CLI and core communicate in-process with asynchronous Promise results.",
          confidence: "confirmed",
        },
        defaultCaller
      );

      expect(touchRes.success).toBe(true);
      if (touchRes.success) {
        expect(touchRes.data.id).toBe(original.data.id);
        expect(touchRes.data.isConflicted).toBe(false);
      }
    });

    it("surfaces conflict when new assertion contradicts existing memory rather than overwriting", async () => {
      const original = await memoryManager.recordMemory(
        {
          category: "decision_rationale",
          key: "auth_approach",
          content: "Store secrets in user system keychain or environment variables only.",
          confidence: "confirmed",
        },
        defaultCaller
      );
      if (!original.success) throw original.error;

      // Conflicting incoming memory on same category & key
      const conflictingRes = await memoryManager.recordMemory(
        {
          category: "decision_rationale",
          key: "auth_approach",
          content: "Store unencrypted API keys in project repository config file.",
          confidence: "confirmed",
        },
        defaultCaller
      );

      expect(conflictingRes.success).toBe(true);
      if (conflictingRes.success) {
        expect(conflictingRes.data.isConflicted).toBe(true);
        expect(conflictingRes.data.conflictResolution).toBe("unresolved");
      }

      // Verify original memory is flagged as conflicted with reason
      const checkOriginal = await memoryManager.getMemory(original.data.id, defaultCaller);
      expect(checkOriginal.success).toBe(true);
      if (checkOriginal.data) {
        expect(checkOriginal.data.isConflicted).toBe(true);
        expect(checkOriginal.data.conflictReason).toContain("Divergent content for key 'auth_approach'");
      }

      const conflictEvents = recordedEvents.filter((e) => e.eventType === "memory:conflict_detected");
      expect(conflictEvents.length).toBe(1);
    });

    it("resolves conflict via 'superseded' by updating content and marking resolved", async () => {
      const older = await memoryManager.recordMemory(
        {
          category: "confirmed_requirement",
          key: "runtime_node_version",
          content: "Require Node.js 18 LTS runtime.",
          confidence: "confirmed",
        },
        defaultCaller
      );
      if (!older.success) throw older.error;

      const newer = await memoryManager.recordMemory(
        {
          category: "confirmed_requirement",
          key: "runtime_node_version",
          content: "Migrated to Bun 1.2+ runtime exclusively.",
          confidence: "confirmed",
        },
        defaultCaller
      );
      if (!newer.success) throw newer.error;
      expect(newer.data.isConflicted).toBe(true);

      // Reconcile as superseded
      const resolvedRes = await memoryManager.resolveConflict(
        older.data.id,
        "superseded",
        "Migrated to Bun 1.2+ runtime exclusively.",
        defaultCaller
      );
      expect(resolvedRes.success).toBe(true);
      if (resolvedRes.success) {
        expect(resolvedRes.data.isConflicted).toBe(false);
        expect(resolvedRes.data.conflictResolution).toBe("superseded");
        expect(resolvedRes.data.content).toContain("Bun 1.2+ runtime exclusively");
      }
    });

    it("supports 'preserved_disagreement' resolution per core product principles", async () => {
      const specialistA = await memoryManager.recordMemory(
        {
          category: "decision_rationale",
          key: "api_style",
          content: "RESTful HTTP endpoints preferred for developer simplicity.",
          confidence: "confirmed",
        },
        defaultCaller
      );
      if (!specialistA.success) throw specialistA.error;

      const specialistB = await memoryManager.recordMemory(
        {
          category: "decision_rationale",
          key: "api_style",
          content: "gRPC protocol buffers preferred for internal high-throughput streams.",
          confidence: "confirmed",
        },
        defaultCaller
      );
      if (!specialistB.success) throw specialistB.error;
      expect(specialistB.data.isConflicted).toBe(true);

      // Preserve disagreement
      const preserveRes = await memoryManager.resolveConflict(
        specialistA.data.id,
        "preserved_disagreement",
        "Preserved Specialist Disagreement: Architecture prefers RESTful HTTP endpoints for ease of onboarding; Performance Engineering recommends gRPC for internal microservice RPCs.",
        defaultCaller
      );
      expect(preserveRes.success).toBe(true);
      if (preserveRes.success) {
        expect(preserveRes.data.isConflicted).toBe(false);
        expect(preserveRes.data.conflictResolution).toBe("preserved_disagreement");
        expect(preserveRes.data.content).toContain("Preserved Specialist Disagreement");
      }
    });
  });

  describe("Freshness & Staleness Evaluation", () => {
    it("marks recent memories as fresh and older memories as stale or expired", () => {
      const now = Date.now();
      const freshItem: MemoryItem = {
        id: "mem-fresh-01",
        category: "research_finding",
        key: "latency_profile",
        content: "API p99 latency 120ms",
        confidence: "confirmed",
        projectId: "proj-terrarium",
        tags: [],
        isArchived: false,
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days old
        updatedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const freshEval = evaluateMemoryFreshness(freshItem, now);
      expect(freshEval.status).toBe("fresh");
      expect(freshEval.isStale).toBe(false);
      expect(freshEval.freshnessScore).toBeGreaterThan(0.5);

      // Stale research finding (18 days old, TTL is 14 days)
      const staleItem: MemoryItem = {
        ...freshItem,
        id: "mem-stale-01",
        createdAt: new Date(now - 18 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 18 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const staleEval = evaluateMemoryFreshness(staleItem, now);
      expect(staleEval.status).toBe("stale");
      expect(staleEval.isStale).toBe(true);
      expect(staleEval.requiresRevalidation).toBe(true);

      // Expired research finding (35 days old, expiry is 28 days)
      const expiredItem: MemoryItem = {
        ...freshItem,
        id: "mem-exp-01",
        createdAt: new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const expEval = evaluateMemoryFreshness(expiredItem, now);
      expect(expEval.status).toBe("expired");
      expect(expEval.isStale).toBe(true);
      expect(expEval.freshnessScore).toBe(0.0);
    });

    it("revalidates a stale memory item to restore fresh status", async () => {
      const now = Date.now();
      const oldDate = new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString();
      const recordRes = await memoryManager.recordMemory(
        {
          category: "open_question",
          key: "target_market",
          content: "Focusing on enterprise self-hosted teams first.",
          confidence: "inferred",
        },
        defaultCaller
      );
      if (!recordRes.success) throw recordRes.error;

      // Manually simulate age in DB
      db.connection.getRawDb().run(
        "UPDATE memory_items SET created_at = ?, updated_at = ?, last_validated_at = ? WHERE id = ?;",
        [oldDate, oldDate, oldDate, recordRes.data.id]
      );

      const inspectBefore = await memoryManager.getMemory(recordRes.data.id, defaultCaller);
      expect(inspectBefore.success).toBe(true);
      if (inspectBefore.success) {
        expect(inspectBefore.data.freshnessStatus).toBe("expired");
      }

      // Revalidate
      const revalRes = await memoryManager.revalidateMemory(recordRes.data.id, defaultCaller);
      expect(revalRes.success).toBe(true);
      if (revalRes.success) {
        expect(revalRes.data.freshnessStatus).toBe("fresh");
        expect(revalRes.data.lastValidatedAt).toBeDefined();
      }
    });
  });

  describe("Security, Privacy, and Least Privilege", () => {
    it("automatically scrubs credentials, API keys, and Bearer tokens before persistence", async () => {
      const rawLeakyContent =
        "Connect to OpenAI with key sk-proj-abcdef1234567890abcdef1234567890 and Bearer doNotLeakThisSignature";

      const res = await memoryManager.recordMemory(
        {
          category: "architecture_knowledge",
          key: "provider_sample",
          content: rawLeakyContent,
          confidence: "confirmed",
          provenance: {
            sourceType: "task",
            rationale: "Used Authorization: Bearer secretTokenHere to test health",
          },
        },
        defaultCaller
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.content).not.toContain("sk-proj-abcdef1234567890abcdef1234567890");
        expect(res.data.content).not.toContain("doNotLeakThisSignature");
        expect(res.data.content).toContain("Bearer [REDACTED]");
        expect(res.data.provenance?.rationale).not.toContain("secretTokenHere");
      }
    });

    it("enforces caller permissions and rejects unauthorized actions", async () => {
      const readOnlyCaller = {
        projectId: "proj-terrarium",
        actorId: "intern-viewer",
        permissions: ["memory:read"],
      };

      // Attempt to write with read-only permissions
      const writeRes = await memoryManager.recordMemory(
        {
          category: "user_preference",
          key: "theme",
          content: "dark",
          confidence: "confirmed",
        },
        readOnlyCaller
      );
      expect(writeRes.success).toBe(false);
      expect(writeRes.error).toBeInstanceOf(PermissionDeniedError);
    });

    it("strictly isolates project memories and prevents cross-project leakage", async () => {
      // Create memory in Project A
      const projARes = await memoryManager.recordMemory(
        {
          category: "project_overview",
          key: "secret_plan",
          content: "Project A confidential roadmap.",
          confidence: "confirmed",
        },
        { projectId: "project-alpha", actorId: "alice", permissions: ["*"] }
      );
      if (!projARes.success) throw projARes.error;

      // Project B attempts to list memories
      const projBList = await memoryManager.listMemories(
        { projectId: "project-alpha" },
        { projectId: "project-beta", actorId: "bob", permissions: ["*"] }
      );
      expect(projBList.success).toBe(false);
      expect(projBList.error).toBeInstanceOf(CrossProjectContextLeakError);
    });
  });
});
