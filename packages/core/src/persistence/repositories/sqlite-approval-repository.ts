/**
 * @terrarium/core - persistence/repositories/sqlite-approval-repository.ts
 *
 * SQLite implementation of ApprovalRepository.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type ApprovalRepository,
  type ApprovalRequest,
  type ApprovalQueryOptions,
  type DatabaseError,
  type DuplicateEntityError,
  NotFoundError,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface ApprovalRow {
  id: string;
  task_id: string;
  execution_id: string | null;
  action_type: string;
  description: string;
  status: string;
  requested_by_agent_id: string;
  reviewed_by_user_id: string | null;
  decision_reason: string | null;
  requested_at: string;
  decided_at: string | null;
  expires_at: string | null;
  payload_json: string | null;
  created_at: string;
  updated_at: string;
}

function rowToApproval(row: ApprovalRow): ApprovalRequest {
  let parsedPayload: Record<string, unknown> | undefined;
  if (row.payload_json) {
    try {
      parsedPayload = JSON.parse(row.payload_json);
    } catch {
      parsedPayload = undefined;
    }
  }

  const meta = (parsedPayload as any)?.__metadata ?? {};
  const actualPayload =
    parsedPayload && "__payload" in parsedPayload
      ? (parsedPayload.__payload as Record<string, unknown>)
      : parsedPayload;

  return {
    id: row.id,
    taskId: row.task_id,
    executionId: row.execution_id ?? undefined,
    actionType: row.action_type as any,
    description: row.description,
    status: row.status as any,
    requestedByAgentId: row.requested_by_agent_id,
    reviewedByUserId: row.reviewed_by_user_id ?? undefined,
    decisionReason: row.decision_reason ?? undefined,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    toolId: meta.toolId,
    riskLevel: meta.riskLevel,
    payloadHash: meta.payloadHash,
    isExecuted: meta.isExecuted,
    executedAt: meta.executedAt,
    payload: actualPayload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeApprovalPayload(approval: ApprovalRequest): string | null {
  const meta: Record<string, unknown> = {};
  if (approval.toolId) meta.toolId = approval.toolId;
  if (approval.riskLevel) meta.riskLevel = approval.riskLevel;
  if (approval.payloadHash) meta.payloadHash = approval.payloadHash;
  if (approval.isExecuted !== undefined) meta.isExecuted = approval.isExecuted;
  if (approval.executedAt) meta.executedAt = approval.executedAt;

  if (Object.keys(meta).length === 0 && !approval.payload) {
    return null;
  }

  if (Object.keys(meta).length === 0) {
    return JSON.stringify(approval.payload);
  }

  return JSON.stringify({
    __metadata: meta,
    __payload: approval.payload,
  });
}

export class SqliteApprovalRepository implements ApprovalRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Result<ApprovalRequest | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM approvals WHERE id = ?;").get(id) as ApprovalRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToApproval(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "ApprovalRequest", id));
    }
  }

  async listPending(): Promise<Result<readonly ApprovalRequest[], DatabaseError>> {
    try {
      const rows = this.db
        .query("SELECT * FROM approvals WHERE status = 'pending' ORDER BY requested_at ASC;")
        .all() as ApprovalRow[];
      return ok(rows.map(rowToApproval));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "ApprovalRequest", "pending"));
    }
  }

  async listByTaskId(taskId: string): Promise<Result<readonly ApprovalRequest[], DatabaseError>> {
    try {
      const rows = this.db
        .query("SELECT * FROM approvals WHERE task_id = ? ORDER BY requested_at ASC;")
        .all(taskId) as ApprovalRow[];
      return ok(rows.map(rowToApproval));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "ApprovalRequest", taskId));
    }
  }

  async list(options: ApprovalQueryOptions = {}): Promise<Result<readonly ApprovalRequest[], DatabaseError>> {
    try {
      const clauses: string[] = [];
      const params: unknown[] = [];

      if (options.status) {
        clauses.push("status = ?");
        params.push(options.status);
      }
      if (options.taskId) {
        clauses.push("task_id = ?");
        params.push(options.taskId);
      }
      if (options.requestedByAgentId) {
        clauses.push("requested_by_agent_id = ?");
        params.push(options.requestedByAgentId);
      }

      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const limitClause = options.limit ? `LIMIT ${options.limit}` : "";
      const offsetClause = options.offset ? `OFFSET ${options.offset}` : "";

      const sql = `SELECT * FROM approvals ${where} ORDER BY requested_at ASC ${limitClause} ${offsetClause};`;
      const rows = this.db.query(sql).all(...(params as any[])) as ApprovalRow[];
      return ok(rows.map(rowToApproval));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "ApprovalRequest", "list"));
    }
  }

  async create(approval: ApprovalRequest): Promise<Result<ApprovalRequest, DuplicateEntityError | DatabaseError>> {
    try {
      const payloadJson = serializeApprovalPayload(approval);
      this.db.run(
        `INSERT INTO approvals (
          id, task_id, execution_id, action_type, description, status,
          requested_by_agent_id, reviewed_by_user_id, decision_reason,
          requested_at, decided_at, expires_at, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          approval.id,
          approval.taskId,
          approval.executionId ?? null,
          approval.actionType,
          approval.description,
          approval.status,
          approval.requestedByAgentId,
          approval.reviewedByUserId ?? null,
          approval.decisionReason ?? null,
          approval.requestedAt,
          approval.decidedAt ?? null,
          approval.expiresAt ?? null,
          payloadJson,
          approval.createdAt,
          approval.updatedAt,
        ]
      );
      return ok(approval);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "ApprovalRequest", approval.id, "task_id"));
    }
  }

  async update(approval: ApprovalRequest): Promise<Result<ApprovalRequest, NotFoundError | DatabaseError>> {
    try {
      const payloadJson = serializeApprovalPayload(approval);
      const res = this.db.run(
        `UPDATE approvals SET
          status = ?,
          reviewed_by_user_id = ?,
          decision_reason = ?,
          decided_at = ?,
          payload_json = ?,
          updated_at = ?
        WHERE id = ?;`,
        [
          approval.status,
          approval.reviewedByUserId ?? null,
          approval.decisionReason ?? null,
          approval.decidedAt ?? null,
          payloadJson,
          approval.updatedAt,
          approval.id,
        ]
      );

      if (res.changes === 0) {
        return fail(new NotFoundError("ApprovalRequest", approval.id));
      }
      return ok(approval);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "ApprovalRequest", approval.id));
    }
  }
}
