/**
 * @terrarium/core - persistence/repositories/sqlite-execution-repository.ts
 *
 * SQLite implementation of ExecutionRepository.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type DatabaseError,
  type DuplicateEntityError,
  type Execution,
  type ExecutionRepository,
  NotFoundError,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface ExecutionRow {
  id: string;
  task_id: string;
  step_id: string | null;
  agent_profile_id: string;
  status: string;
  provider: string;
  model: string;
  tokens_prompt: number;
  tokens_completion: number;
  tokens_total: number;
  estimated_cost_usd: number;
  duration_ms: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToExecution(row: ExecutionRow): Execution {
  return {
    id: row.id,
    taskId: row.task_id,
    stepId: row.step_id ?? undefined,
    agentProfileId: row.agent_profile_id,
    status: row.status as any,
    provider: row.provider,
    model: row.model,
    metrics: {
      tokensPrompt: row.tokens_prompt,
      tokensCompletion: row.tokens_completion,
      tokensTotal: row.tokens_total,
      estimatedCostUsd: row.estimated_cost_usd,
      durationMs: row.duration_ms,
    },
    error: row.error ?? undefined,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteExecutionRepository implements ExecutionRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Result<Execution | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM executions WHERE id = ?;").get(id) as ExecutionRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToExecution(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Execution", id));
    }
  }

  async list(limit = 100, offset = 0): Promise<Result<readonly Execution[], DatabaseError>> {
    try {
      const rows = this.db
        .query("SELECT * FROM executions ORDER BY created_at DESC LIMIT ? OFFSET ?;")
        .all(limit, offset) as ExecutionRow[];
      return ok(rows.map(rowToExecution));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Execution", "list"));
    }
  }

  async listByTaskId(taskId: string): Promise<Result<readonly Execution[], DatabaseError>> {
    try {
      const rows = this.db
        .query("SELECT * FROM executions WHERE task_id = ? ORDER BY created_at ASC;")
        .all(taskId) as ExecutionRow[];
      return ok(rows.map(rowToExecution));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Execution", taskId));
    }
  }

  async create(execution: Execution): Promise<Result<Execution, DuplicateEntityError | DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO executions (
          id, task_id, step_id, agent_profile_id, status, provider, model,
          tokens_prompt, tokens_completion, tokens_total, estimated_cost_usd, duration_ms,
          error, started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          execution.id,
          execution.taskId,
          execution.stepId ?? null,
          execution.agentProfileId,
          execution.status,
          execution.provider,
          execution.model,
          execution.metrics.tokensPrompt,
          execution.metrics.tokensCompletion,
          execution.metrics.tokensTotal,
          execution.metrics.estimatedCostUsd,
          execution.metrics.durationMs,
          execution.error ?? null,
          execution.startedAt ?? null,
          execution.finishedAt ?? null,
          execution.createdAt,
          execution.updatedAt,
        ]
      );
      return ok(execution);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Execution", execution.id, "task_id"));
    }
  }

  async update(execution: Execution): Promise<Result<Execution, NotFoundError | DatabaseError>> {
    try {
      const res = this.db.run(
        `UPDATE executions SET
          step_id = ?,
          status = ?,
          tokens_prompt = ?,
          tokens_completion = ?,
          tokens_total = ?,
          estimated_cost_usd = ?,
          duration_ms = ?,
          error = ?,
          started_at = ?,
          finished_at = ?,
          updated_at = ?
        WHERE id = ?;`,
        [
          execution.stepId ?? null,
          execution.status,
          execution.metrics.tokensPrompt,
          execution.metrics.tokensCompletion,
          execution.metrics.tokensTotal,
          execution.metrics.estimatedCostUsd,
          execution.metrics.durationMs,
          execution.error ?? null,
          execution.startedAt ?? null,
          execution.finishedAt ?? null,
          execution.updatedAt,
          execution.id,
        ]
      );

      if (res.changes === 0) {
        return fail(new NotFoundError("Execution", execution.id));
      }
      return ok(execution);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Execution", execution.id));
    }
  }
}
