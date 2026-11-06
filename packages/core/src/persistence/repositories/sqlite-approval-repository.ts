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
    payload: row.payload_json ? JSON.parse(row.payload_json) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

  async create(approval: ApprovalRequest): Promise<Result<ApprovalRequest, DuplicateEntityError | DatabaseError>> {
    try {
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
          approval.payload ? JSON.stringify(approval.payload) : null,
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
      const res = this.db.run(
        `UPDATE approvals SET
          status = ?,
          reviewed_by_user_id = ?,
          decision_reason = ?,
          decided_at = ?,
          updated_at = ?
        WHERE id = ?;`,
        [
          approval.status,
          approval.reviewedByUserId ?? null,
          approval.decisionReason ?? null,
          approval.decidedAt ?? null,
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
