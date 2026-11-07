/**
 * @terrarium/core - persistence/repositories/sqlite-plan-repository.ts
 *
 * SQLite implementation of PlanRepository.
 * Persists inspectable task plans with full JSON schema serialization and query indexing.
 */

import { Database } from "bun:sqlite";
import {
  type DatabaseError,
  type DuplicateEntityError,
  type NotFoundError,
  type PlanQueryOptions,
  type PlanRepository,
  type Result,
  type TaskPlan,
  ok,
  fail,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface TaskPlanRow {
  id: string;
  task_id: string | null;
  status: string;
  task_type: string;
  risk_level: string;
  uncertainty_level: string;
  raw_input: string;
  normalized_input: string;
  plan_json: string;
  created_at: string;
  updated_at: string;
}

function rowToTaskPlan(row: TaskPlanRow): TaskPlan {
  const parsed = JSON.parse(row.plan_json);
  return {
    id: row.id,
    taskId: row.task_id ?? undefined,
    rawInput: row.raw_input,
    normalizedInput: row.normalized_input,
    classification: parsed.classification,
    steps: parsed.steps ?? [],
    budgetEstimate: parsed.budgetEstimate,
    selectionRationale: parsed.selectionRationale,
    clarificationQuestions: parsed.clarificationQuestions ?? [],
    completionCriteria: parsed.completionCriteria ?? [],
    status: row.status as any,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqlitePlanRepository implements PlanRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Result<TaskPlan | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM task_plans WHERE id = ?;").get(id) as TaskPlanRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToTaskPlan(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "TaskPlan", id));
    }
  }

  async findByTaskId(taskId: string): Promise<Result<TaskPlan | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM task_plans WHERE task_id = ?;").get(taskId) as TaskPlanRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToTaskPlan(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "TaskPlan", `task:${taskId}`));
    }
  }

  async list(options: PlanQueryOptions = {}): Promise<Result<readonly TaskPlan[], DatabaseError>> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (options.status) {
        conditions.push("status = ?");
        params.push(options.status);
      }
      if (options.taskId) {
        conditions.push("task_id = ?");
        params.push(options.taskId);
      }
      if (options.taskType) {
        conditions.push("task_type = ?");
        params.push(options.taskType);
      }
      if (options.riskLevel) {
        conditions.push("risk_level = ?");
        params.push(options.riskLevel);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const limitClause = options.limit ? `LIMIT ${options.limit}` : "LIMIT 100";
      const offsetClause = options.offset ? `OFFSET ${options.offset}` : "";

      const query = `SELECT * FROM task_plans ${whereClause} ORDER BY created_at DESC ${limitClause} ${offsetClause};`;
      const rows = this.db.query(query).all(...params) as TaskPlanRow[];
      return ok(rows.map(rowToTaskPlan));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "TaskPlan", "list"));
    }
  }

  async create(plan: TaskPlan): Promise<Result<TaskPlan, DuplicateEntityError | DatabaseError>> {
    try {
      const planPayload = {
        classification: plan.classification,
        steps: plan.steps,
        budgetEstimate: plan.budgetEstimate,
        selectionRationale: plan.selectionRationale,
        clarificationQuestions: plan.clarificationQuestions,
        completionCriteria: plan.completionCriteria,
      };

      this.db.run(
        `INSERT INTO task_plans (
          id, task_id, status, task_type, risk_level, uncertainty_level,
          raw_input, normalized_input, plan_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          plan.id,
          plan.taskId ?? null,
          plan.status,
          plan.classification.taskType,
          plan.classification.risk.level,
          plan.classification.uncertainty.level,
          plan.rawInput,
          plan.normalizedInput,
          JSON.stringify(planPayload),
          plan.createdAt,
          plan.updatedAt,
        ]
      );

      return ok(plan);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "TaskPlan", plan.id));
    }
  }

  async update(plan: TaskPlan): Promise<Result<TaskPlan, NotFoundError | DatabaseError>> {
    try {
      const planPayload = {
        classification: plan.classification,
        steps: plan.steps,
        budgetEstimate: plan.budgetEstimate,
        selectionRationale: plan.selectionRationale,
        clarificationQuestions: plan.clarificationQuestions,
        completionCriteria: plan.completionCriteria,
      };

      const result = this.db.run(
        `UPDATE task_plans SET
          task_id = ?,
          status = ?,
          task_type = ?,
          risk_level = ?,
          uncertainty_level = ?,
          raw_input = ?,
          normalized_input = ?,
          plan_json = ?,
          updated_at = ?
        WHERE id = ?;`,
        [
          plan.taskId ?? null,
          plan.status,
          plan.classification.taskType,
          plan.classification.risk.level,
          plan.classification.uncertainty.level,
          plan.rawInput,
          plan.normalizedInput,
          JSON.stringify(planPayload),
          plan.updatedAt,
          plan.id,
        ]
      );

      if (result.changes === 0) {
        return fail(handleSqliteError(new Error("Entity not found"), "TaskPlan", plan.id));
      }

      return ok(plan);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "TaskPlan", plan.id));
    }
  }

  async delete(id: string): Promise<Result<boolean, DatabaseError>> {
    try {
      const result = this.db.run("DELETE FROM task_plans WHERE id = ?;", [id]);
      return ok(result.changes > 0);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "TaskPlan", id));
    }
  }
}
