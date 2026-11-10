/**
 * @terrarium/core - persistence/repositories/sqlite-log-repository.ts
 *
 * SQLite implementation of LogRepository for structured audit logs and telemetry data.
 * Safe under concurrency and supports automated retention cleanup.
 * Aligns with PLAN.md Section 18 (Observability & Auditability).
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type DatabaseError,
  type StructuredLogRecord,
  type LogLevel,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.js";

export interface LogQueryOptions {
  readonly level?: LogLevel;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly taskId?: string;
  readonly isDiagnostic?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

interface LogRow {
  id: string;
  level: string;
  message: string;
  correlation_id: string;
  trace_id: string;
  span_id: string | null;
  parent_span_id: string | null;
  task_id: string | null;
  step_id: string | null;
  agent_slug: string | null;
  metadata_json: string | null;
  is_diagnostic: number;
  is_redacted: number;
  timestamp: string;
}

function rowToLog(row: LogRow): StructuredLogRecord {
  return {
    id: row.id,
    level: row.level as LogLevel,
    message: row.message,
    correlation: {
      correlationId: row.correlation_id,
      traceId: row.trace_id,
      spanId: row.span_id ?? undefined,
      parentSpanId: row.parent_span_id ?? undefined,
      taskId: row.task_id ?? undefined,
      stepId: row.step_id ?? undefined,
      agentSlug: row.agent_slug ?? undefined,
    },
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    isDiagnostic: Boolean(row.is_diagnostic),
    isRedacted: Boolean(row.is_redacted),
    timestamp: row.timestamp,
  };
}

export class SqliteLogRepository {
  constructor(private readonly db: Database) {}

  async record(log: StructuredLogRecord): Promise<Result<StructuredLogRecord, DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO structured_logs (
          id, level, message, correlation_id, trace_id, span_id, parent_span_id,
          task_id, step_id, agent_slug, metadata_json, is_diagnostic, is_redacted, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          log.id,
          log.level,
          log.message,
          log.correlation.correlationId,
          log.correlation.traceId,
          log.correlation.spanId ?? null,
          log.correlation.parentSpanId ?? null,
          log.correlation.taskId ?? null,
          log.correlation.stepId ?? null,
          log.correlation.agentSlug ?? null,
          log.metadata ? JSON.stringify(log.metadata) : null,
          log.isDiagnostic ? 1 : 0,
          log.isRedacted ? 1 : 0,
          log.timestamp,
        ]
      );
      return ok(log);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "StructuredLogRecord", log.id));
    }
  }

  async query(options: LogQueryOptions = {}): Promise<Result<readonly StructuredLogRecord[], DatabaseError>> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (options.level) {
        conditions.push("level = ?");
        params.push(options.level);
      }
      if (options.correlationId) {
        conditions.push("correlation_id = ?");
        params.push(options.correlationId);
      }
      if (options.traceId) {
        conditions.push("trace_id = ?");
        params.push(options.traceId);
      }
      if (options.taskId) {
        conditions.push("task_id = ?");
        params.push(options.taskId);
      }
      if (options.isDiagnostic !== undefined) {
        conditions.push("is_diagnostic = ?");
        params.push(options.isDiagnostic ? 1 : 0);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const limit = options.limit ?? 100;
      const offset = options.offset ?? 0;

      const query = `SELECT * FROM structured_logs ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?;`;
      const rows = this.db.query(query).all(...params, limit, offset) as LogRow[];
      return ok(rows.map(rowToLog));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "StructuredLogRecord", "query"));
    }
  }

  /**
   * Cleans up logs older than a given ISO timestamp or prunes excess records.
   */
  async cleanLogs(olderThanIso: string, maxRecords = 50_000): Promise<Result<number, DatabaseError>> {
    try {
      let deleted = 0;

      // 1. Delete logs older than timestamp
      const ageRes = this.db.run(
        "DELETE FROM structured_logs WHERE timestamp < ?;",
        [olderThanIso]
      );
      deleted += ageRes.changes;

      // 2. Enforce max records ceiling
      const countRow = this.db
        .query("SELECT COUNT(*) AS total FROM structured_logs;")
        .get() as { total: number } | null;
      const total = countRow?.total ?? 0;

      if (total > maxRecords) {
        const excess = total - maxRecords;
        const pruneRes = this.db.run(
          `DELETE FROM structured_logs WHERE id IN (
            SELECT id FROM structured_logs ORDER BY timestamp ASC LIMIT ?
          );`,
          [excess]
        );
        deleted += pruneRes.changes;
      }

      return ok(deleted);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "StructuredLogRecord", "cleanLogs"));
    }
  }

  /**
   * Cleans up domain events older than a given ISO timestamp or prunes excess records.
   */
  async cleanEvents(olderThanIso: string, maxRecords = 100_000): Promise<Result<number, DatabaseError>> {
    try {
      let deleted = 0;

      // 1. Delete events older than timestamp
      const ageRes = this.db.run(
        "DELETE FROM domain_events WHERE timestamp < ?;",
        [olderThanIso]
      );
      deleted += ageRes.changes;

      // 2. Enforce max records ceiling
      const countRow = this.db
        .query("SELECT COUNT(*) AS total FROM domain_events;")
        .get() as { total: number } | null;
      const total = countRow?.total ?? 0;

      if (total > maxRecords) {
        const excess = total - maxRecords;
        const pruneRes = this.db.run(
          `DELETE FROM domain_events WHERE id IN (
            SELECT id FROM domain_events ORDER BY timestamp ASC LIMIT ?
          );`,
          [excess]
        );
        deleted += pruneRes.changes;
      }

      return ok(deleted);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "DomainEvent", "cleanEvents"));
    }
  }
}
