/**
 * @terrarium/core - persistence/repositories/sqlite-report-repository.ts
 *
 * SQLite implementation of ReportRepository.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type DatabaseError,
  type DuplicateEntityError,
  NotFoundError,
  type Report,
  type ReportRepository,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface ReportRow {
  id: string;
  task_id: string;
  title: string;
  report_type: string;
  summary: string;
  findings_json: string;
  markdown_content: string;
  agents_involved_json: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    reportType: row.report_type as any,
    summary: row.summary,
    findings: JSON.parse(row.findings_json || "[]"),
    markdownContent: row.markdown_content,
    agentsInvolved: JSON.parse(row.agents_involved_json || "[]"),
    status: row.status as any,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteReportRepository implements ReportRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Result<Report | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM reports WHERE id = ?;").get(id) as ReportRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToReport(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Report", id));
    }
  }

  async listByTaskId(taskId: string): Promise<Result<readonly Report[], DatabaseError>> {
    try {
      const rows = this.db
        .query("SELECT * FROM reports WHERE task_id = ? ORDER BY created_at ASC;")
        .all(taskId) as ReportRow[];
      return ok(rows.map(rowToReport));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Report", taskId));
    }
  }

  async create(report: Report): Promise<Result<Report, DuplicateEntityError | DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO reports (
          id, task_id, title, report_type, summary, findings_json,
          markdown_content, agents_involved_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          report.id,
          report.taskId,
          report.title,
          report.reportType,
          report.summary,
          JSON.stringify(report.findings),
          report.markdownContent,
          JSON.stringify(report.agentsInvolved),
          report.status,
          report.createdAt,
          report.updatedAt,
        ]
      );
      return ok(report);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Report", report.id, "task_id"));
    }
  }

  async update(report: Report): Promise<Result<Report, NotFoundError | DatabaseError>> {
    try {
      const res = this.db.run(
        `UPDATE reports SET
          title = ?,
          report_type = ?,
          summary = ?,
          findings_json = ?,
          markdown_content = ?,
          agents_involved_json = ?,
          status = ?,
          updated_at = ?
        WHERE id = ?;`,
        [
          report.title,
          report.reportType,
          report.summary,
          JSON.stringify(report.findings),
          report.markdownContent,
          JSON.stringify(report.agentsInvolved),
          report.status,
          report.updatedAt,
          report.id,
        ]
      );

      if (res.changes === 0) {
        return fail(new NotFoundError("Report", report.id));
      }
      return ok(report);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Report", report.id));
    }
  }

  async delete(id: string): Promise<Result<boolean, DatabaseError>> {
    try {
      const res = this.db.run("DELETE FROM reports WHERE id = ?;", [id]);
      return ok(res.changes > 0);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Report", id));
    }
  }
}
