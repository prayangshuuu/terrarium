/**
 * @terrarium/core - persistence/repositories/sqlite-report-repository.ts
 *
 * SQLite implementation of ReportRepository supporting full Prompt 18 report schema,
 * epistemic classification, provenance, disagreements, recommendations, and simulated research queries.
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
  type ReportQueryOptions,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface ReportRow {
  id: string;
  task_id: string;
  title: string;
  report_type: string;
  summary: string;
  objective?: string | null;
  method?: string | null;
  evidence_json?: string | null;
  sources_json?: string | null;
  assumptions_json?: string | null;
  confidence?: string | null;
  confidence_rationale?: string | null;
  limitations_json?: string | null;
  disagreements_json?: string | null;
  recommendations_json?: string | null;
  has_simulated_data?: number | null;
  simulation_metadata_json?: string | null;
  findings_json: string;
  markdown_content: string;
  agents_involved_json: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToReport(row: ReportRow): Report {
  const findings = safeParseJson(row.findings_json, []);
  const evidence = safeParseJson(row.evidence_json, []);
  const hasSimulated = Boolean(
    row.has_simulated_data === 1 ||
    row.report_type === "customer_simulation" ||
    (Array.isArray(evidence) && evidence.some((e: any) => e.claimType === "simulated_feedback")) ||
    (Array.isArray(findings) && findings.some((f: any) => f.isSimulated))
  );

  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    reportType: row.report_type as any,
    summary: row.summary,
    objective: row.objective || row.summary,
    method: row.method || "Multi-agent synthesis and artifact analysis",
    evidence,
    sources: safeParseJson(row.sources_json, []),
    assumptions: safeParseJson(row.assumptions_json, []),
    confidence: (row.confidence as any) || "high",
    confidenceRationale: row.confidence_rationale ?? undefined,
    limitations: safeParseJson(row.limitations_json, []),
    disagreements: safeParseJson(row.disagreements_json, []),
    recommendations: safeParseJson(row.recommendations_json, []),
    hasSimulatedData: hasSimulated,
    simulationMetadata: safeParseJson(row.simulation_metadata_json, undefined),
    findings,
    markdownContent: row.markdown_content,
    agentsInvolved: safeParseJson(row.agents_involved_json, []),
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

  async list(options: ReportQueryOptions = {}): Promise<Result<readonly Report[], DatabaseError>> {
    try {
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (options.taskId) {
        conditions.push("task_id = ?");
        params.push(options.taskId);
      }

      if (options.reportType) {
        conditions.push("report_type = ?");
        params.push(options.reportType);
      }

      if (options.status) {
        conditions.push("status = ?");
        params.push(options.status);
      }

      if (options.hasSimulatedData !== undefined) {
        conditions.push("has_simulated_data = ?");
        params.push(options.hasSimulatedData ? 1 : 0);
      }

      let sql = "SELECT * FROM reports";
      if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
      }
      sql += " ORDER BY created_at DESC";

      if (options.limit !== undefined) {
        sql += " LIMIT ?";
        params.push(options.limit);
      }

      if (options.offset !== undefined) {
        sql += " OFFSET ?";
        params.push(options.offset);
      }

      const rows = this.db.query(sql).all(...params) as ReportRow[];
      return ok(rows.map(rowToReport));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Report", "query"));
    }
  }

  async create(report: Report): Promise<Result<Report, DuplicateEntityError | DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO reports (
          id, task_id, title, report_type, summary,
          objective, method, evidence_json, sources_json, assumptions_json,
          confidence, confidence_rationale, limitations_json, disagreements_json, recommendations_json,
          has_simulated_data, simulation_metadata_json,
          findings_json, markdown_content, agents_involved_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          report.id,
          report.taskId,
          report.title,
          report.reportType,
          report.summary,
          report.objective ?? report.summary,
          report.method ?? "Multi-agent synthesis and artifact analysis",
          JSON.stringify(report.evidence ?? []),
          JSON.stringify(report.sources ?? []),
          JSON.stringify(report.assumptions ?? []),
          report.confidence ?? "high",
          report.confidenceRationale ?? null,
          JSON.stringify(report.limitations ?? []),
          JSON.stringify(report.disagreements ?? []),
          JSON.stringify(report.recommendations ?? []),
          report.hasSimulatedData ? 1 : 0,
          report.simulationMetadata ? JSON.stringify(report.simulationMetadata) : null,
          JSON.stringify(report.findings ?? []),
          report.markdownContent,
          JSON.stringify(report.agentsInvolved ?? []),
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
          objective = ?,
          method = ?,
          evidence_json = ?,
          sources_json = ?,
          assumptions_json = ?,
          confidence = ?,
          confidence_rationale = ?,
          limitations_json = ?,
          disagreements_json = ?,
          recommendations_json = ?,
          has_simulated_data = ?,
          simulation_metadata_json = ?,
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
          report.objective ?? report.summary,
          report.method ?? "Multi-agent synthesis and artifact analysis",
          JSON.stringify(report.evidence ?? []),
          JSON.stringify(report.sources ?? []),
          JSON.stringify(report.assumptions ?? []),
          report.confidence ?? "high",
          report.confidenceRationale ?? null,
          JSON.stringify(report.limitations ?? []),
          JSON.stringify(report.disagreements ?? []),
          JSON.stringify(report.recommendations ?? []),
          report.hasSimulatedData ? 1 : 0,
          report.simulationMetadata ? JSON.stringify(report.simulationMetadata) : null,
          JSON.stringify(report.findings ?? []),
          report.markdownContent,
          JSON.stringify(report.agentsInvolved ?? []),
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
