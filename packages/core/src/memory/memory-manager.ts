/**
 * @terrarium/core - memory/memory-manager.ts
 *
 * Central coordinator for project memory and knowledge management.
 * Handles lifecycle, conflict detection, freshness evaluation, secret minimization,
 * permissions, and domain event dispatching.
 * Aligns with PLAN.md Section 14 and PLAN_CONTEXT.md Section 6 & 7.
 */

import {
  type Result,
  ok,
  fail,
  type MemoryCategory,
  type MemoryFilter,
  type MemoryItem,
  type MemoryCreateInput,
  type MemoryUpdateInput,
  type MemoryConflictResolution,
  type MemoryRepository,
  type DomainEvent,
  validateMemoryItem,
  MemoryNotFoundError,
  MemoryConflictError,
  TerrariumError,
  PermissionDeniedError,
  CrossProjectContextLeakError,
  DatabaseError,
} from "@terrarium/contracts";
import { evaluateMemoryFreshness } from "./freshness-evaluator.ts";
import { detectMemoryConflict } from "./conflict-detector.ts";
import { MemorySecurityEnforcer, type CallerContext } from "./security-enforcer.ts";

export type MemoryEventListener = (event: DomainEvent) => void | Promise<void>;

export interface MemoryManagerOptions {
  readonly repository?: MemoryRepository;
  readonly securityEnforcer?: MemorySecurityEnforcer;
  readonly onEvent?: MemoryEventListener;
}

export class MemoryManager {
  private readonly repository?: MemoryRepository;
  private readonly securityEnforcer: MemorySecurityEnforcer;
  private readonly onEvent?: MemoryEventListener;
  private readonly inMemoryStore: Map<string, MemoryItem> = new Map();

  constructor(options?: MemoryManagerOptions) {
    this.repository = options?.repository;
    this.securityEnforcer = options?.securityEnforcer ?? new MemorySecurityEnforcer();
    this.onEvent = options?.onEvent;
  }

  private dispatchEvent(
    eventType: DomainEvent["eventType"],
    entityId: string,
    payload?: Record<string, unknown>
  ): void {
    if (!this.onEvent) return;

    const event: DomainEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      eventType,
      source: "system",
      entityType: "MemoryItem",
      entityId,
      payload,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = this.onEvent(event);
      if (res instanceof Promise) {
        res.catch((err) => console.error("Memory event listener error:", err));
      }
    } catch (err) {
      console.error("Memory event dispatch failed:", err);
    }
  }

  /**
   * Records a new memory item or updates existing if identical, detecting conflicts and preventing silent clobbering.
   */
  async recordMemory(
    input: MemoryCreateInput,
    caller: CallerContext
  ): Promise<Result<MemoryItem, TerrariumError>> {
    // 1. Enforce permission
    const permRes = this.securityEnforcer.assertPermission(caller, "memory:write", "record memory");
    if (!permRes.success) return permRes;

    const targetProjectId = input.projectId ?? caller.projectId ?? "default";
    const isoNow = new Date().toISOString();

    // 2. Enforce project isolation
    const isoRes = this.securityEnforcer.assertProjectIsolation(caller.projectId, targetProjectId);
    if (!isoRes.success) return isoRes;

    // 3. Sanitize content and rationale from secrets
    const sanitizedContent = this.securityEnforcer.sanitizeContent(input.content);
    const sanitizedRationale = input.provenance?.rationale
      ? this.securityEnforcer.sanitizeContent(input.provenance.rationale)
      : undefined;

    // 4. Check for existing memory with matching (category, key)
    const existing = await this.findExistingItem(input.category, input.key, targetProjectId);

    if (existing) {
      const conflictCheck = detectMemoryConflict(existing, sanitizedContent, input.confidence);

      // 4a. If content is identical, perform non-conflicting touch/revalidation
      if (conflictCheck.isIdentical) {
        const touched: MemoryItem = {
          ...existing,
          lastValidatedAt: isoNow,
          freshnessStatus: "fresh",
          updatedAt: isoNow,
        };
        await this.persistUpdate(touched);
        this.dispatchEvent("memory:revalidated", touched.id, { key: touched.key });
        return ok(touched);
      }

      // 4b. If conflict detected, surface conflict on existing item rather than silently overwriting!
      if (conflictCheck.hasConflict) {
        const conflictedItem: MemoryItem = {
          ...existing,
          isConflicted: true,
          conflictWithId: caller.actorId,
          conflictReason: conflictCheck.reason,
          conflictResolution: "unresolved",
          updatedAt: isoNow,
        };

        const valRes = validateMemoryItem(conflictedItem);
        if (!valRes.success) return fail(valRes.error);

        await this.persistUpdate(valRes.data);
        this.dispatchEvent("memory:conflict_detected", valRes.data.id, {
          key: input.key,
          reason: conflictCheck.reason,
          proposedBy: caller.actorId,
        });

        return ok(valRes.data);
      }
    }

    // 5. Create new memory item
    const newItem: MemoryItem = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: input.category,
      key: input.key,
      content: sanitizedContent,
      confidence: input.confidence,
      projectId: targetProjectId,
      taskId: input.taskId,
      owner: input.owner ?? caller.actorId,
      provenance: input.provenance
        ? {
            ...input.provenance,
            rationale: sanitizedRationale,
          }
        : undefined,
      sourceReference: input.sourceReference ?? input.provenance?.sourceReference,
      tags: input.tags ?? [],
      isArchived: false,
      lastValidatedAt: isoNow,
      freshnessStatus: "fresh",
      isConflicted: false,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    const valRes = validateMemoryItem(newItem);
    if (!valRes.success) return fail(valRes.error);

    await this.persistCreate(valRes.data);
    this.dispatchEvent("memory:recorded", valRes.data.id, {
      category: valRes.data.category,
      key: valRes.data.key,
    });

    return ok(valRes.data);
  }

  /**
   * Retrieves a memory item by ID, enforcing permissions and updating freshness evaluation.
   */
  async getMemory(
    id: string,
    caller: CallerContext
  ): Promise<Result<MemoryItem, TerrariumError>> {
    const permRes = this.securityEnforcer.assertPermission(caller, "memory:read", "read memory");
    if (!permRes.success) return permRes;

    let item: MemoryItem | null = null;
    if (this.repository) {
      const repoRes = await this.repository.findById(id);
      if (!repoRes.success) return fail(repoRes.error);
      item = repoRes.data;
    } else {
      item = this.inMemoryStore.get(id) ?? null;
    }

    if (!item) {
      return fail(new MemoryNotFoundError(id, caller.projectId));
    }

    // Enforce project isolation
    const isoRes = this.securityEnforcer.assertProjectIsolation(caller.projectId, item.projectId);
    if (!isoRes.success) return isoRes;

    // Dynamically evaluate freshness
    const freshEval = evaluateMemoryFreshness(item);
    if (freshEval.status !== item.freshnessStatus) {
      item = {
        ...item,
        freshnessStatus: freshEval.status,
      };
    }

    return ok(item);
  }

  /**
   * Lists memory items matching a filter, enforcing project isolation and computing freshness.
   */
  async listMemories(
    filter: MemoryFilter,
    caller: CallerContext
  ): Promise<Result<readonly MemoryItem[], TerrariumError>> {
    const permRes = this.securityEnforcer.assertPermission(caller, "memory:read", "list memories");
    if (!permRes.success) return permRes;

    // Strict project isolation: force projectId to caller.projectId unless caller is system
    const targetProject = filter.projectId ?? caller.projectId;
    const isoRes = this.securityEnforcer.assertProjectIsolation(caller.projectId, targetProject);
    if (!isoRes.success) return isoRes;

    const scopedFilter: MemoryFilter = {
      ...filter,
      projectId: targetProject,
    };

    let items: readonly MemoryItem[] = [];
    if (this.repository) {
      const repoRes = await this.repository.listByFilter(scopedFilter);
      if (!repoRes.success) return fail(repoRes.error);
      items = repoRes.data;
    } else {
      let filtered = Array.from(this.inMemoryStore.values()).filter(
        (m) => m.projectId === targetProject
      );
      if (!scopedFilter.includeArchived) {
        filtered = filtered.filter((m) => !m.isArchived);
      }
      if (scopedFilter.category) {
        filtered = filtered.filter((m) => m.category === scopedFilter.category);
      }
      if (scopedFilter.confidence) {
        filtered = filtered.filter((m) => m.confidence === scopedFilter.confidence);
      }
      if (scopedFilter.taskId) {
        filtered = filtered.filter((m) => m.taskId === scopedFilter.taskId);
      }
      if (scopedFilter.isConflicted !== undefined) {
        filtered = filtered.filter((m) => Boolean(m.isConflicted) === scopedFilter.isConflicted);
      }
      if (scopedFilter.search) {
        const query = scopedFilter.search.toLowerCase();
        filtered = filtered.filter(
          (m) => m.key.toLowerCase().includes(query) || m.content.toLowerCase().includes(query)
        );
      }
      items = filtered;
    }

    // Refresh freshness for all items
    const evaluated = items.map((item) => {
      const freshEval = evaluateMemoryFreshness(item);
      if (freshEval.status !== item.freshnessStatus) {
        return { ...item, freshnessStatus: freshEval.status };
      }
      return item;
    });

    return ok(evaluated);
  }

  /**
   * Corrects an existing memory item (content, confidence, tags, revalidation).
   */
  async correctMemory(
    id: string,
    update: MemoryUpdateInput,
    caller: CallerContext
  ): Promise<Result<MemoryItem, TerrariumError>> {
    const permRes = this.securityEnforcer.assertPermission(caller, "memory:write", "correct memory");
    if (!permRes.success) return permRes;

    const getRes = await this.getMemory(id, caller);
    if (!getRes.success) return getRes;
    const existing = getRes.data;

    const isoNow = new Date().toISOString();
    const sanitizedContent = update.content
      ? this.securityEnforcer.sanitizeContent(update.content)
      : existing.content;

    const updated: MemoryItem = {
      ...existing,
      content: sanitizedContent,
      confidence: update.confidence ?? existing.confidence,
      tags: update.tags ?? existing.tags,
      isArchived: update.isArchived ?? existing.isArchived,
      lastValidatedAt: update.lastValidatedAt ?? isoNow,
      freshnessStatus: update.freshnessStatus ?? "fresh",
      conflictResolution: update.conflictResolution ?? existing.conflictResolution,
      updatedAt: isoNow,
    };

    const valRes = validateMemoryItem(updated);
    if (!valRes.success) return fail(valRes.error);

    await this.persistUpdate(valRes.data);
    this.dispatchEvent("memory:updated", valRes.data.id, { key: valRes.data.key });

    return ok(valRes.data);
  }

  /**
   * Reconciles or resolves a memory conflict explicitly.
   */
  async resolveConflict(
    id: string,
    resolution: MemoryConflictResolution,
    resolvedContent: string | undefined,
    caller: CallerContext
  ): Promise<Result<MemoryItem, TerrariumError>> {
    const permRes = this.securityEnforcer.assertPermission(caller, "memory:reconcile", "resolve memory conflict");
    if (!permRes.success) return permRes;

    const getRes = await this.getMemory(id, caller);
    if (!getRes.success) return getRes;
    const item = getRes.data;

    const isoNow = new Date().toISOString();

    if (resolution === "superseded" && item.conflictWithId) {
      // Archive or mark older item superseded
      const olderRes = await this.getMemory(item.conflictWithId, caller);
      if (olderRes.success) {
        const olderUpdated: MemoryItem = {
          ...olderRes.data,
          freshnessStatus: "superseded",
          isArchived: true,
          updatedAt: isoNow,
        };
        await this.persistUpdate(olderUpdated);
      }
    }

    const sanitizedContent = resolvedContent
      ? this.securityEnforcer.sanitizeContent(resolvedContent)
      : item.content;

    const resolved: MemoryItem = {
      ...item,
      content: sanitizedContent,
      isConflicted: resolution === "preserved_disagreement" ? false : false,
      conflictResolution: resolution,
      lastValidatedAt: isoNow,
      freshnessStatus: "fresh",
      updatedAt: isoNow,
    };

    const valRes = validateMemoryItem(resolved);
    if (!valRes.success) return fail(valRes.error);

    await this.persistUpdate(valRes.data);
    this.dispatchEvent("memory:conflict_resolved", resolved.id, {
      resolution,
      conflictWithId: item.conflictWithId,
    });

    return ok(valRes.data);
  }

  /**
   * Soft-deletes (archives) a memory item.
   */
  async archiveMemory(id: string, caller: CallerContext): Promise<Result<boolean, TerrariumError>> {
    const permRes = this.securityEnforcer.assertPermission(caller, "memory:write", "archive memory");
    if (!permRes.success) return permRes;

    const getRes = await this.getMemory(id, caller);
    if (!getRes.success) return getRes;

    if (this.repository) {
      const res = await this.repository.archive(id);
      if (!res.success) return fail(res.error);
    } else {
      const item = this.inMemoryStore.get(id);
      if (item) {
        this.inMemoryStore.set(id, { ...item, isArchived: true, updatedAt: new Date().toISOString() });
      }
    }

    this.dispatchEvent("memory:archived", id);
    return ok(true);
  }

  /**
   * Permanently deletes a memory item (requires memory:delete permission).
   */
  async deleteMemory(id: string, caller: CallerContext): Promise<Result<boolean, TerrariumError>> {
    const permRes = this.securityEnforcer.assertPermission(caller, "memory:delete", "delete memory");
    if (!permRes.success) return permRes;

    const getRes = await this.getMemory(id, caller);
    if (!getRes.success) return getRes;

    if (this.repository) {
      const res = await this.repository.delete(id);
      if (!res.success) return fail(res.error);
    } else {
      this.inMemoryStore.delete(id);
    }

    this.dispatchEvent("memory:deleted", id);
    return ok(true);
  }

  /**
   * Revalidates a memory item, refreshing its timestamp and freshness status.
   */
  async revalidateMemory(id: string, caller: CallerContext): Promise<Result<MemoryItem, TerrariumError>> {
    const permRes = this.securityEnforcer.assertPermission(caller, "memory:write", "revalidate memory");
    if (!permRes.success) return permRes;

    const getRes = await this.getMemory(id, caller);
    if (!getRes.success) return getRes;

    const isoNow = new Date().toISOString();
    const updated: MemoryItem = {
      ...getRes.data,
      lastValidatedAt: isoNow,
      freshnessStatus: "fresh",
      updatedAt: isoNow,
    };

    await this.persistUpdate(updated);
    this.dispatchEvent("memory:revalidated", id, { key: updated.key });

    return ok(updated);
  }

  private async findExistingItem(
    category: MemoryCategory,
    key: string,
    projectId: string
  ): Promise<MemoryItem | null> {
    if (this.repository) {
      const res = await this.repository.findByKey(category, key, projectId);
      return res.success ? res.data : null;
    }
    for (const item of this.inMemoryStore.values()) {
      if (item.category === category && item.key === key && item.projectId === projectId) {
        return item;
      }
    }
    return null;
  }

  private async persistCreate(item: MemoryItem): Promise<void> {
    if (this.repository) {
      const res = await this.repository.create(item);
      if (!res.success) throw res.error;
    } else {
      this.inMemoryStore.set(item.id, item);
    }
  }

  private async persistUpdate(item: MemoryItem): Promise<void> {
    if (this.repository) {
      const res = await this.repository.update(item);
      if (!res.success) throw res.error;
    } else {
      this.inMemoryStore.set(item.id, item);
    }
  }
}
