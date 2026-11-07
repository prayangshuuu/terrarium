/**
 * @terrarium/cli - commands/memory-commands.ts
 *
 * Terminal commands for project memory and context management.
 * Provides inspect/correct/delete, conflict visualization, and freshness indicators.
 * Contributed by A4 (CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns with PLAN.md Section 14 & 16.
 */

import {
  type Result,
  ok,
  fail,
  type MemoryFilter,
  type MemoryItem,
  type MemoryCreateInput,
  type MemoryUpdateInput,
  type MemoryConflictResolution,
  MEMORY_FRESHNESS_UI,
  MEMORY_CONFIDENCE_UI,
  MEMORY_CATEGORY_UI,
  TerrariumError,
} from "@terrarium/contracts";
import { MemoryManager } from "@terrarium/core";

export interface MemoryCommandOptions {
  readonly json?: boolean;
  readonly projectId?: string;
  readonly actorId?: string;
  readonly permissions?: readonly string[];
}

export interface MemoryListResult {
  readonly items: readonly MemoryItem[];
  readonly output: string;
}

/**
 * Formats a single memory item as a rich terminal inspection card.
 */
export function formatMemoryCard(item: MemoryItem): string {
  const lines: string[] = [];
  const freshness = MEMORY_FRESHNESS_UI[item.freshnessStatus ?? "fresh"];
  const confidence = MEMORY_CONFIDENCE_UI[item.confidence];
  const categoryMeta = MEMORY_CATEGORY_UI[item.category];

  lines.push(`┌─────────────────────────────────────────────────────────────────────────────┐`);
  lines.push(`│ 📋 PROJECT MEMORY: ${item.key.padEnd(55)} │`);
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ ID:          ${item.id.padEnd(61)} │`);
  lines.push(`│ Category:    ${(categoryMeta.icon + " " + categoryMeta.label).padEnd(61)} │`);
  lines.push(`│ Confidence:  ${(confidence.badge + " " + confidence.label).padEnd(61)} │`);
  lines.push(`│ Freshness:   ${(freshness.glyph + " " + freshness.label + " - " + freshness.description).slice(0, 61).padEnd(61)} │`);
  lines.push(`│ Project:     ${(item.projectId ?? "default").padEnd(61)} │`);

  if (item.taskId) {
    lines.push(`│ Task Scope:  ${item.taskId.padEnd(61)} │`);
  }
  if (item.owner) {
    lines.push(`│ Author:      ${item.owner.padEnd(61)} │`);
  }
  if (item.lastValidatedAt) {
    lines.push(`│ Validated:   ${item.lastValidatedAt.padEnd(61)} │`);
  }

  // Provenance details
  if (item.provenance) {
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ 🔍 PROVENANCE                                                               │`);
    lines.push(`│ Source:      ${item.provenance.sourceType.padEnd(61)} │`);
    if (item.provenance.sourceReference) {
      lines.push(`│ Reference:   ${item.provenance.sourceReference.padEnd(61)} │`);
    }
    if (item.provenance.rationale) {
      lines.push(`│ Rationale:   ${item.provenance.rationale.slice(0, 61).padEnd(61)} │`);
    }
  }

  // Conflict warning banner
  if (item.isConflicted) {
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ ⚠️  CONFLICT DETECTED — UNRESOLVED DIVERGENCE                                │`);
    if (item.conflictWithId) {
      lines.push(`│ Proposed By: ${item.conflictWithId.padEnd(61)} │`);
    }
    if (item.conflictReason) {
      const reasonSnippet = item.conflictReason.slice(0, 59);
      lines.push(`│ Reason:      ${reasonSnippet.padEnd(61)} │`);
    }
    lines.push(`│ Resolution:  ${(item.conflictResolution ?? "unresolved").padEnd(61)} │`);
  }

  // Content
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`│ 📝 CONTENT:                                                                 │`);
  const contentLines = item.content.split("\n");
  for (const cLine of contentLines) {
    const wrapped = cLine.length > 73 ? `${cLine.slice(0, 70)}...` : cLine;
    lines.push(`│   ${wrapped.padEnd(74)}│`);
  }

  if (item.tags.length > 0) {
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ Tags:        ${item.tags.join(", ").padEnd(61)} │`);
  }

  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);
  return lines.join("\n");
}

/**
 * Handles `terrarium memory list` command.
 */
export async function handleMemoryList(
  memoryManager: MemoryManager,
  filter: MemoryFilter = {},
  options?: MemoryCommandOptions
): Promise<Result<MemoryListResult, TerrariumError>> {
  const caller = {
    projectId: options?.projectId ?? filter.projectId ?? "default",
    actorId: options?.actorId ?? "operator",
    permissions: options?.permissions ?? ["*"],
  };

  const listRes = await memoryManager.listMemories(filter, caller);
  if (!listRes.success) return fail(listRes.error);
  const items = listRes.data;

  if (options?.json) {
    return ok({
      items,
      output: JSON.stringify(items, null, 2),
    });
  }

  const lines: string[] = [];
  lines.push(`\nProject Memory Items (${items.length} records in project '${caller.projectId}'):\n`);

  if (items.length === 0) {
    lines.push("  No memory items found matching criteria.");
    return ok({ items, output: lines.join("\n") });
  }

  const header = `  ${"ID".padEnd(24)} ${"STATUS".padEnd(10)} ${"CATEGORY".padEnd(24)} ${"KEY".padEnd(28)} ${"CONFIDENCE".padEnd(14)}`;
  lines.push(header);
  lines.push(`  ${"─".repeat(106)}`);

  for (const item of items) {
    const freshness = MEMORY_FRESHNESS_UI[item.freshnessStatus ?? "fresh"];
    const categoryMeta = MEMORY_CATEGORY_UI[item.category];
    const statusGlyph = item.isConflicted ? "⚠️  CONFLICT" : `${freshness.glyph} ${freshness.shortLabel}`;
    const categoryLabel = `${categoryMeta.icon} ${item.category}`;

    const row = `  ${item.id.padEnd(24)} ${statusGlyph.padEnd(10)} ${categoryLabel.padEnd(24)} ${item.key.padEnd(28)} ${item.confidence.padEnd(14)}`;
    lines.push(row);
  }

  return ok({ items, output: lines.join("\n") });
}

/**
 * Handles `terrarium memory show <id>` command.
 */
export async function handleMemoryShow(
  id: string,
  memoryManager: MemoryManager,
  options?: MemoryCommandOptions
): Promise<Result<string, TerrariumError>> {
  const caller = {
    projectId: options?.projectId ?? "default",
    actorId: options?.actorId ?? "operator",
    permissions: options?.permissions ?? ["*"],
  };

  const getRes = await memoryManager.getMemory(id, caller);
  if (!getRes.success) return fail(getRes.error);

  if (options?.json) {
    return ok(JSON.stringify(getRes.data, null, 2));
  }

  return ok(formatMemoryCard(getRes.data));
}

/**
 * Handles `terrarium memory set` command.
 */
export async function handleMemorySet(
  input: MemoryCreateInput,
  memoryManager: MemoryManager,
  options?: MemoryCommandOptions
): Promise<Result<string, TerrariumError>> {
  const caller = {
    projectId: options?.projectId ?? input.projectId ?? "default",
    actorId: options?.actorId ?? "operator",
    permissions: options?.permissions ?? ["*"],
  };

  const res = await memoryManager.recordMemory(input, caller);
  if (!res.success) return fail(res.error);

  if (options?.json) {
    return ok(JSON.stringify(res.data, null, 2));
  }

  if (res.data.isConflicted) {
    return ok(
      `⚠️  Recorded with CONFLICT: Memory '${res.data.key}' conflicts with existing assertion. Run 'terrarium memory show ${res.data.id}' to inspect.`
    );
  }

  return ok(`✓ Recorded memory item '${res.data.key}' (ID: ${res.data.id}, category: ${res.data.category}).`);
}

/**
 * Handles `terrarium memory correct <id>` command.
 */
export async function handleMemoryCorrect(
  id: string,
  update: MemoryUpdateInput,
  memoryManager: MemoryManager,
  options?: MemoryCommandOptions
): Promise<Result<string, TerrariumError>> {
  const caller = {
    projectId: options?.projectId ?? "default",
    actorId: options?.actorId ?? "operator",
    permissions: options?.permissions ?? ["*"],
  };

  const res = await memoryManager.correctMemory(id, update, caller);
  if (!res.success) return fail(res.error);

  if (options?.json) {
    return ok(JSON.stringify(res.data, null, 2));
  }

  return ok(`✓ Successfully corrected memory item '${res.data.key}' (ID: ${res.data.id}).`);
}

/**
 * Handles `terrarium memory delete <id>` command.
 */
export async function handleMemoryDelete(
  id: string,
  memoryManager: MemoryManager,
  options?: MemoryCommandOptions & { readonly archiveOnly?: boolean }
): Promise<Result<string, TerrariumError>> {
  const caller = {
    projectId: options?.projectId ?? "default",
    actorId: options?.actorId ?? "operator",
    permissions: options?.permissions ?? ["*"],
  };

  if (options?.archiveOnly) {
    const res = await memoryManager.archiveMemory(id, caller);
    if (!res.success) return fail(res.error);
    return ok(`✓ Archived memory item '${id}'.`);
  }

  const res = await memoryManager.deleteMemory(id, caller);
  if (!res.success) return fail(res.error);
  return ok(`✓ Permanently deleted memory item '${id}'.`);
}

/**
 * Handles `terrarium memory conflicts` command.
 */
export async function handleMemoryConflicts(
  memoryManager: MemoryManager,
  options?: MemoryCommandOptions
): Promise<Result<string, TerrariumError>> {
  const caller = {
    projectId: options?.projectId ?? "default",
    actorId: options?.actorId ?? "operator",
    permissions: options?.permissions ?? ["*"],
  };

  const listRes = await memoryManager.listMemories({ isConflicted: true }, caller);
  if (!listRes.success) return fail(listRes.error);
  const conflicts = listRes.data;

  if (options?.json) {
    return ok(JSON.stringify(conflicts, null, 2));
  }

  if (conflicts.length === 0) {
    return ok("✓ No active memory conflicts detected in project.");
  }

  const lines: string[] = [];
  lines.push(`\n⚠️  ACTIVE MEMORY CONFLICTS (${conflicts.length} unresolved):`);
  lines.push("─".repeat(80));

  for (const c of conflicts) {
    lines.push(`Key:         ${c.key} (${c.category})`);
    lines.push(`Item ID:     ${c.id}`);
    lines.push(`Divergence:  ${c.conflictReason ?? "Opposing assertion recorded"}`);
    lines.push(`Action:      Use 'terrarium memory reconcile ${c.id}' to resolve or preserve disagreement.\n`);
  }

  return ok(lines.join("\n"));
}
