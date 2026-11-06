/**
 * @terrarium/core - persistence/repositories/sqlite-memory-repository.ts
 *
 * SQLite implementation of MemoryRepository.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type DatabaseError,
  type DuplicateEntityError,
  type MemoryCategory,
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
  source_reference: string | null;
  tags_json: string;
  is_archived: number;
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
    sourceReference: row.source_reference ?? undefined,
    tags: JSON.parse(row.tags_json || "[]"),
    isArchived: Boolean(row.is_archived),
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

  async findByKey(category: MemoryCategory, key: string): Promise<Result<MemoryItem | null, DatabaseError>> {
    try {
      const row = this.db
        .query("SELECT * FROM memory_items WHERE category = ? AND key = ?;")
        .get(category, key) as MemoryRow | null;
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
    includeArchived = false
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

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const rows = this.db
        .query(`SELECT * FROM memory_items ${whereClause} ORDER BY updated_at DESC;`)
        .all(...params) as MemoryRow[];
      return ok(rows.map(rowToMemory));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "MemoryItem", "list"));
    }
  }

  async create(item: MemoryItem): Promise<Result<MemoryItem, DuplicateEntityError | DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO memory_items (
          id, category, key, content, confidence, source_reference,
          tags_json, is_archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          item.id,
          item.category,
          item.key,
          item.content,
          item.confidence,
          item.sourceReference ?? null,
          JSON.stringify(item.tags),
          item.isArchived ? 1 : 0,
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
          source_reference = ?,
          tags_json = ?,
          is_archived = ?,
          updated_at = ?
        WHERE id = ?;`,
        [
          item.content,
          item.confidence,
          item.sourceReference ?? null,
          JSON.stringify(item.tags),
          item.isArchived ? 1 : 0,
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
}
