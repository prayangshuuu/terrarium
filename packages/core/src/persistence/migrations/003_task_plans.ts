/**
 * @terrarium/core - persistence/migrations/003_task_plans.ts
 *
 * Migration adding the task_plans table for persisting inspectable task plans.
 * Aligns with PLAN.md Section 5.1 & 5.4.
 */

export const MIGRATION_003_VERSION = 3;
export const MIGRATION_003_NAME = "003_task_plans";

export const MIGRATION_003_UP = `
CREATE TABLE IF NOT EXISTS task_plans (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  task_type TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  uncertainty_level TEXT NOT NULL,
  raw_input TEXT NOT NULL,
  normalized_input TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_plans_task_id ON task_plans(task_id);
CREATE INDEX IF NOT EXISTS idx_task_plans_status ON task_plans(status);
CREATE INDEX IF NOT EXISTS idx_task_plans_task_type ON task_plans(task_type);
`;
