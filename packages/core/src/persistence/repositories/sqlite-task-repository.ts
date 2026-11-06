/**
 * @terrarium/core - persistence/repositories/sqlite-task-repository.ts
 *
 * SQLite implementation of TaskRepository.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type DatabaseError,
  type DuplicateEntityError,
  NotFoundError,
  type Task,
  type TaskQueryOptions,
  type TaskRepository,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface TaskRow {
  id: string;
  title: string;
  description: string;
  parent_task_id: string | null;
  department: string;
  assigned_agent_id: string | null;
  status: string;
  priority: string;
  context_refs_json: string;
  expected_deliverables_json: string;
  delegation_depth: number;
  result_id: string | null;
  failure_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    parentTaskId: row.parent_task_id ?? undefined,
    department: row.department as any,
    assignedAgentId: row.assigned_agent_id ?? undefined,
    status: row.status as any,
    priority: row.priority as any,
    contextRefs: JSON.parse(row.context_refs_json || "[]"),
    expectedDeliverables: JSON.parse(row.expected_deliverables_json || "[]"),
    delegationDepth: row.delegation_depth,
    resultId: row.result_id ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Result<Task | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM tasks WHERE id = ?;").get(id) as TaskRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToTask(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Task", id));
    }
  }

  async list(options: TaskQueryOptions = {}): Promise<Result<readonly Task[], DatabaseError>> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (options.status) {
        conditions.push("status = ?");
        params.push(options.status);
      }
      if (options.department) {
        conditions.push("department = ?");
        params.push(options.department);
      }
      if (options.parentTaskId !== undefined) {
        if (options.parentTaskId === "") {
          conditions.push("parent_task_id IS NULL");
        } else {
          conditions.push("parent_task_id = ?");
          params.push(options.parentTaskId);
        }
      }
      if (options.priority) {
        conditions.push("priority = ?");
        params.push(options.priority);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const limitClause = options.limit ? `LIMIT ${options.limit}` : "LIMIT 100";
      const offsetClause = options.offset ? `OFFSET ${options.offset}` : "";

      const query = `SELECT * FROM tasks ${whereClause} ORDER BY created_at DESC ${limitClause} ${offsetClause};`;
      const rows = this.db.query(query).all(...params) as TaskRow[];
      return ok(rows.map(rowToTask));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Task", "query"));
    }
  }

  async create(task: Task): Promise<Result<Task, DuplicateEntityError | DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO tasks (
          id, title, description, parent_task_id, department, assigned_agent_id,
          status, priority, context_refs_json, expected_deliverables_json,
          delegation_depth, result_id, failure_reason, started_at, completed_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          task.id,
          task.title,
          task.description,
          task.parentTaskId ?? null,
          task.department,
          task.assignedAgentId ?? null,
          task.status,
          task.priority,
          JSON.stringify(task.contextRefs),
          JSON.stringify(task.expectedDeliverables),
          task.delegationDepth,
          task.resultId ?? null,
          task.failureReason ?? null,
          task.startedAt ?? null,
          task.completedAt ?? null,
          task.createdAt,
          task.updatedAt,
        ]
      );
      return ok(task);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Task", task.id, "parent_task_id"));
    }
  }

  async update(task: Task): Promise<Result<Task, NotFoundError | DatabaseError>> {
    try {
      const result = this.db.run(
        `UPDATE tasks SET
          title = ?,
          description = ?,
          parent_task_id = ?,
          department = ?,
          assigned_agent_id = ?,
          status = ?,
          priority = ?,
          context_refs_json = ?,
          expected_deliverables_json = ?,
          delegation_depth = ?,
          result_id = ?,
          failure_reason = ?,
          started_at = ?,
          completed_at = ?,
          updated_at = ?
        WHERE id = ?;`,
        [
          task.title,
          task.description,
          task.parentTaskId ?? null,
          task.department,
          task.assignedAgentId ?? null,
          task.status,
          task.priority,
          JSON.stringify(task.contextRefs),
          JSON.stringify(task.expectedDeliverables),
          task.delegationDepth,
          task.resultId ?? null,
          task.failureReason ?? null,
          task.startedAt ?? null,
          task.completedAt ?? null,
          task.updatedAt,
          task.id,
        ]
      );

      if (result.changes === 0) {
        return fail(new NotFoundError("Task", task.id));
      }

      return ok(task);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Task", task.id));
    }
  }

  async delete(id: string): Promise<Result<boolean, DatabaseError>> {
    try {
      const res = this.db.run("DELETE FROM tasks WHERE id = ?;", [id]);
      return ok(res.changes > 0);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Task", id));
    }
  }
}
