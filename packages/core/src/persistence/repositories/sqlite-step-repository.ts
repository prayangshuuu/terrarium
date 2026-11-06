/**
 * @terrarium/core - persistence/repositories/sqlite-step-repository.ts
 *
 * SQLite implementation of StepRepository.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type DatabaseError,
  type DuplicateEntityError,
  NotFoundError,
  type StepRepository,
  type TaskStep,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface StepRow {
  id: string;
  task_id: string;
  step_index: number;
  title: string;
  description: string;
  assigned_agent_id: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  tool_calls_json: string;
  created_at: string;
  updated_at: string;
}

function rowToStep(row: StepRow): TaskStep {
  return {
    id: row.id,
    taskId: row.task_id,
    stepIndex: row.step_index,
    title: row.title,
    description: row.description,
    assignedAgentId: row.assigned_agent_id ?? undefined,
    status: row.status as any,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    error: row.error ?? undefined,
    toolCalls: JSON.parse(row.tool_calls_json || "[]"),
  };
}

export class SqliteStepRepository implements StepRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Result<TaskStep | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM task_steps WHERE id = ?;").get(id) as StepRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToStep(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "TaskStep", id));
    }
  }

  async listByTaskId(taskId: string): Promise<Result<readonly TaskStep[], DatabaseError>> {
    try {
      const rows = this.db
        .query("SELECT * FROM task_steps WHERE task_id = ? ORDER BY step_index ASC;")
        .all(taskId) as StepRow[];
      return ok(rows.map(rowToStep));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "TaskStep", taskId));
    }
  }

  async create(step: TaskStep): Promise<Result<TaskStep, DuplicateEntityError | DatabaseError>> {
    try {
      const now = new Date().toISOString();
      this.db.run(
        `INSERT INTO task_steps (
          id, task_id, step_index, title, description, assigned_agent_id,
          status, started_at, completed_at, error, tool_calls_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          step.id,
          step.taskId,
          step.stepIndex,
          step.title,
          step.description,
          step.assignedAgentId ?? null,
          step.status,
          step.startedAt ?? null,
          step.completedAt ?? null,
          step.error ?? null,
          JSON.stringify(step.toolCalls ?? []),
          now,
          now,
        ]
      );
      return ok(step);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "TaskStep", step.id, "task_id"));
    }
  }

  async update(step: TaskStep): Promise<Result<TaskStep, NotFoundError | DatabaseError>> {
    try {
      const now = new Date().toISOString();
      const res = this.db.run(
        `UPDATE task_steps SET
          step_index = ?,
          title = ?,
          description = ?,
          assigned_agent_id = ?,
          status = ?,
          started_at = ?,
          completed_at = ?,
          error = ?,
          tool_calls_json = ?,
          updated_at = ?
        WHERE id = ?;`,
        [
          step.stepIndex,
          step.title,
          step.description,
          step.assignedAgentId ?? null,
          step.status,
          step.startedAt ?? null,
          step.completedAt ?? null,
          step.error ?? null,
          JSON.stringify(step.toolCalls ?? []),
          now,
          step.id,
        ]
      );

      if (res.changes === 0) {
        return fail(new NotFoundError("TaskStep", step.id));
      }
      return ok(step);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "TaskStep", step.id));
    }
  }

  async delete(id: string): Promise<Result<boolean, DatabaseError>> {
    try {
      const res = this.db.run("DELETE FROM task_steps WHERE id = ?;", [id]);
      return ok(res.changes > 0);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "TaskStep", id));
    }
  }
}
