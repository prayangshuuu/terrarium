/**
 * @terrarium/core - persistence/repositories/sqlite-memory-repository.ts
 *
 * SQLite implementation of MemoryRepository.
 * Supports project isolation, provenance, freshness filtering, and conflict management.
 * Aligns with PLAN.md Section 14 (Memory & Knowledge Management) and PLAN_CONTEXT.md Section 6.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type DatabaseError,
  type DuplicateEntityError,
  type MemoryCategory,
  type MemoryFilter,
  type MemoryItem,
  type MemoryRepository,
  NotFoundError,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface MemoryRow {
  id: string;
  category: string;
  key: string;
  content: string;
  confidence: string;
  project_id?: string;
  task_id?: string | null;
  owner?: string | null;
  source_type?: string | null;
  rationale?: string | null;
  source_reference: string | null;
  tags_json: string;
  is_archived: number;
  last_validated_at?: string | null;
  freshness_status?: string | null;
  is_conflicted?: number | null;
  conflict_with_id?: string | null;
  conflict_reason?: string | null;
  conflict_resolution?: string | null;
  created_at: string;
  updated_at: string;
}

function rowToMemory(row: MemoryRow): MemoryItem {
  return {
    id: row.id,
    category: row.category as any,
    key: row.key,
    content: row.content,
    confidence: row.confidence as any,
    projectId: row.project_id ?? "default",
    taskId: row.task_id ?? undefined,
    owner: row.owner ?? undefined,
    provenance: row.source_type
      ? {
          sourceType: row.source_type as any,
          sourceReference: row.source_reference ?? undefined,
          author: row.owner ?? undefined,
          rationale: row.rationale ?? undefined,
        }
      : undefined,
    sourceReference: row.source_reference ?? undefined,
    tags: JSON.parse(row.tags_json || "[]"),
    isArchived: Boolean(row.is_archived),
    lastValidatedAt: row.last_validated_at ?? undefined,
    freshnessStatus: (row.freshness_status as any) ?? "fresh",
    isConflicted: Boolean(row.is_conflicted),
    conflictWithId: row.conflict_with_id ?? undefined,
    conflictReason: row.conflict_reason ?? undefined,
    conflictResolution: (row.conflict_resolution as any) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteMemoryRepository implements MemoryRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Result<MemoryItem | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM memory_items WHERE id = ?;").get(id) as MemoryRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToMemory(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "MemoryItem", id));
    }
  }

  async findByKey(
    category: MemoryCategory,
    key: string,
    projectId = "default"
  ): Promise<Result<MemoryItem | null, DatabaseError>> {
    try {
      const row = this.db
        .query("SELECT * FROM memory_items WHERE category = ? AND key = ? AND (project_id = ? OR project_id IS NULL);")
        .get(category, key, projectId) as MemoryRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToMemory(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "MemoryItem", `${category}:${key}`));
    }
  }

  async list(
    category?: MemoryCategory,
    includeArchived = false,
    projectId?: string
  ): Promise<Result<readonly MemoryItem[], DatabaseError>> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (!includeArchived) {
        conditions.push("is_archived = 0");
      }
      if (category) {
        conditions.push("category = ?");
        params.push(category);
      }
      if (projectId) {
        conditions.push("(project_id = ? OR project_id IS NULL)");
        params.push(projectId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const rows = this.db
        .query(`SELECT * FROM memory_items ${whereClause} ORDER BY updated_at DESC;`)
        .all(...params) as MemoryRow[];
      return ok(rows.map(rowToMemory));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "MemoryItem", "list"));
    }
  }

  async listByFilter(filter: MemoryFilter): Promise<Result<readonly MemoryItem[], DatabaseError>> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (!filter.includeArchived) {
        conditions.push("is_archived = 0");
      }
      if (filter.projectId) {
        conditions.push("(project_id = ? OR project_id IS NULL)");
        params.push(filter.projectId);
      }
      if (filter.taskId) {
        conditions.push("task_id = ?");
        params.push(filter.taskId);
      }
      if (filter.category) {
        conditions.push("category = ?");
        params.push(filter.category);
      }
      if (filter.confidence) {
        conditions.push("confidence = ?");
        params.push(filter.confidence);
      }
      if (filter.freshnessStatus) {
        conditions.push("freshness_status = ?");
        params.push(filter.freshnessStatus);
      }
      if (filter.isConflicted !== undefined) {
        conditions.push("is_conflicted = ?");
        params.push(filter.isConflicted ? 1 : 0);
      }
      if (filter.search) {
        conditions.push("(key LIKE ? OR content LIKE ?)");
        params.push(`%${filter.search}%`, `%${filter.search}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      let sql = `SELECT * FROM memory_items ${whereClause} ORDER BY updated_at DESC`;

      if (filter.limit !== undefined && filter.limit > 0) {
        sql += ` LIMIT ${Math.floor(filter.limit)}`;
        if (filter.offset !== undefined && filter.offset > 0) {
          sql += ` OFFSET ${Math.floor(filter.offset)}`;
        }
      }
      sql += ";";

      const rows = this.db.query(sql).all(...params) as MemoryRow[];
      let items = rows.map(rowToMemory);

      if (filter.tags && filter.tags.length > 0) {
        items = items.filter((item) =>
          filter.tags!.every((t) => item.tags.includes(t))
        );
      }

      return ok(items);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "MemoryItem", "listByFilter"));
    }
  }

  async create(item: MemoryItem): Promise<Result<MemoryItem, DuplicateEntityError | DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO memory_items (
          id, category, key, content, confidence, project_id, task_id, owner,
          source_type, rationale, source_reference, tags_json, is_archived,
          last_validated_at, freshness_status, is_conflicted, conflict_with_id,
          conflict_reason, conflict_resolution, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          item.id,
          item.category,
          item.key,
          item.content,
          item.confidence,
          item.projectId ?? "default",
          item.taskId ?? null,
          item.owner ?? item.provenance?.author ?? null,
          item.provenance?.sourceType ?? null,
          item.provenance?.rationale ?? null,
          item.sourceReference ?? item.provenance?.sourceReference ?? null,
          JSON.stringify(item.tags),
          item.isArchived ? 1 : 0,
          item.lastValidatedAt ?? null,
          item.freshnessStatus ?? "fresh",
          item.isConflicted ? 1 : 0,
          item.conflictWithId ?? null,
          item.conflictReason ?? null,
          item.conflictResolution ?? null,
          item.createdAt,
          item.updatedAt,
        ]
      );
      return ok(item);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "MemoryItem", item.id));
    }
  }

  async update(item: MemoryItem): Promise<Result<MemoryItem, NotFoundError | DatabaseError>> {
    try {
      const res = this.db.run(
        `UPDATE memory_items SET
          content = ?,
          confidence = ?,
          task_id = ?,
          owner = ?,
          source_type = ?,
          rationale = ?,
          source_reference = ?,
          tags_json = ?,
          is_archived = ?,
          last_validated_at = ?,
          freshness_status = ?,
          is_conflicted = ?,
          conflict_with_id = ?,
          conflict_reason = ?,
          conflict_resolution = ?,
          updated_at = ?
        WHERE id = ?;`,
        [
          item.content,
          item.confidence,
          item.taskId ?? null,
          item.owner ?? item.provenance?.author ?? null,
          item.provenance?.sourceType ?? null,
          item.provenance?.rationale ?? null,
          item.sourceReference ?? item.provenance?.sourceReference ?? null,
          JSON.stringify(item.tags),
          item.isArchived ? 1 : 0,
          item.lastValidatedAt ?? null,
          item.freshnessStatus ?? "fresh",
          item.isConflicted ? 1 : 0,
          item.conflictWithId ?? null,
          item.conflictReason ?? null,
          item.conflictResolution ?? null,
          item.updatedAt,
          item.id,
        ]
      );

      if (res.changes === 0) {
        return fail(new NotFoundError("MemoryItem", item.id));
      }
      return ok(item);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "MemoryItem", item.id));
    }
  }

  async delete(id: string): Promise<Result<boolean, DatabaseError>> {
    try {
      const res = this.db.run("DELETE FROM memory_items WHERE id = ?;", [id]);
      return ok(res.changes > 0);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "MemoryItem", id));
    }
  }

  async archive(id: string): Promise<Result<boolean, DatabaseError>> {
    try {
      const now = new Date().toISOString();
      const res = this.db.run(
        "UPDATE memory_items SET is_archived = 1, updated_at = ? WHERE id = ?;",
        [now, id]
      );
      return ok(res.changes > 0);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "MemoryItem", id));
    }
  }

  async revalidate(
    id: string,
    validatedAt = new Date().toISOString()
  ): Promise<Result<MemoryItem, NotFoundError | DatabaseError>> {
    try {
      const existingRes = await this.findById(id);
      if (!existingRes.success) return existingRes;
      if (!existingRes.data) return fail(new NotFoundError("MemoryItem", id));

      const updated: MemoryItem = {
        ...existingRes.data,
        lastValidatedAt: validatedAt,
        freshnessStatus: "fresh",
        updatedAt: validatedAt,
      };

      return this.update(updated);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "MemoryItem", id));
    }
  }
}
