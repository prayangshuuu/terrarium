/**
 * @terrarium/cli - tests/memory-cli.test.ts
 *
 * Tests for Memory CLI Commands (A4 & A5):
 * - Memory listing in terminal table format
 * - JSON output support
 * - Inspectable memory card formatting
 * - Creating, correcting, archiving, and deleting memories
 * - Active conflicts viewer
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { MemoryManager } from "@terrarium/core";
import {
  handleMemoryList,
  handleMemoryShow,
  handleMemorySet,
  handleMemoryCorrect,
  handleMemoryDelete,
  handleMemoryConflicts,
  formatMemoryCard,
} from "../src/commands/memory-commands.ts";

describe("CLI Memory Commands Suite (A4 & A5)", () => {
  let memoryManager: MemoryManager;
  let sampleMemoryId: string;

  beforeEach(async () => {
    memoryManager = new MemoryManager();
    const createRes = await memoryManager.recordMemory(
      {
        category: "architecture_knowledge",
        key: "zero_runtime_deps",
        content: "Packages under contracts must have 0 external runtime dependencies.",
        confidence: "confirmed",
        tags: ["architecture", "contracts"],
        provenance: {
          sourceType: "file",
          sourceReference: "packages/contracts/package.json",
          author: "lead-architect",
          rationale: "Ensures boundary purity and fast evaluation.",
        },
      },
      { projectId: "default", actorId: "operator", permissions: ["*"] }
    );
    if (!createRes.success) throw createRes.error;
    sampleMemoryId = createRes.data.id;
  });

  it("lists memories in formatted terminal table with status glyphs and categories", async () => {
    const res = await handleMemoryList(memoryManager);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.output).toContain("Project Memory Items");
      expect(res.data.output).toContain(sampleMemoryId);
      expect(res.data.output).toContain("zero_runtime_deps");
      expect(res.data.output).toContain("architecture_knowledge");
      expect(res.data.items.length).toBe(1);
    }
  });

  it("outputs structured JSON when --json is provided for list", async () => {
    const res = await handleMemoryList(memoryManager, {}, { json: true });
    expect(res.success).toBe(true);
    if (res.success) {
      const parsed = JSON.parse(res.data.output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe(sampleMemoryId);
      expect(parsed[0].key).toBe("zero_runtime_deps");
    }
  });

  it("displays full inspectable memory card with provenance and freshness", async () => {
    const res = await handleMemoryShow(sampleMemoryId, memoryManager);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("PROJECT MEMORY: zero_runtime_deps");
      expect(res.data).toContain("PROVENANCE");
      expect(res.data).toContain("packages/contracts/package.json");
      expect(res.data).toContain("0 external runtime dependencies");
    }
  });

  it("sets a new memory item through CLI handler", async () => {
    const res = await handleMemorySet(
      {
        category: "decision_rationale",
        key: "sqlite_wal",
        content: "WAL mode enables concurrent readers while single writer commits.",
        confidence: "confirmed",
      },
      memoryManager
    );

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("Recorded memory item 'sqlite_wal'");
    }
  });

  it("corrects an existing memory item", async () => {
    const res = await handleMemoryCorrect(
      sampleMemoryId,
      {
        content: "Updated: Packages under contracts strictly maintain zero runtime dependencies.",
        confidence: "confirmed",
      },
      memoryManager
    );

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("Successfully corrected memory item 'zero_runtime_deps'");
    }
  });

  it("archives and deletes a memory item", async () => {
    // Archive
    const archiveRes = await handleMemoryDelete(sampleMemoryId, memoryManager, { archiveOnly: true });
    expect(archiveRes.success).toBe(true);
    if (archiveRes.success) {
      expect(archiveRes.data).toContain("Archived memory item");
    }

    // Delete
    const deleteRes = await handleMemoryDelete(sampleMemoryId, memoryManager);
    expect(deleteRes.success).toBe(true);
    if (deleteRes.success) {
      expect(deleteRes.data).toContain("Permanently deleted memory item");
    }
  });

  it("surfaces active conflicts when contradictory memories exist", async () => {
    // Introduce conflict on the key
    await memoryManager.recordMemory(
      {
        category: "architecture_knowledge",
        key: "zero_runtime_deps",
        content: "Allow external lodash dependency in contracts package.",
        confidence: "confirmed",
      },
      { projectId: "default", actorId: "operator", permissions: ["*"] }
    );

    const conflictsRes = await handleMemoryConflicts(memoryManager);
    expect(conflictsRes.success).toBe(true);
    if (conflictsRes.success) {
      expect(conflictsRes.data).toContain("ACTIVE MEMORY CONFLICTS");
      expect(conflictsRes.data).toContain("zero_runtime_deps");
      expect(conflictsRes.data).toContain("Divergence:");
    }
  });
});
