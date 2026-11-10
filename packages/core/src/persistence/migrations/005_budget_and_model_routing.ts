/**
 * @terrarium/core - persistence/migrations/005_budget_and_model_routing.ts
 *
 * Migration adding budget_configs, budget_reservations, and budget_ledger tables
 * for concurrency-safe token/spend reservations and accounting.
 * Aligns with PLAN.md Section 13 & PLAN_CONTEXT.md Section 8.
 */

export const MIGRATION_005_VERSION = 5;
export const MIGRATION_005_NAME = "005_budget_and_model_routing";

export const MIGRATION_005_UP = `
CREATE TABLE IF NOT EXISTS budget_configs (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  target_id TEXT,
  max_tokens INTEGER,
  max_spend_usd REAL,
  max_duration_ms INTEGER,
  max_concurrency INTEGER,
  max_delegation_depth INTEGER,
  max_retries INTEGER,
  max_debate_rounds INTEGER,
  warning_threshold_percent REAL NOT NULL DEFAULT 80,
  is_hard_limit INTEGER NOT NULL DEFAULT 1,
  on_limit_exceeded TEXT NOT NULL DEFAULT 'stop',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(scope, target_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_configs_scope ON budget_configs(scope, target_id);

CREATE TABLE IF NOT EXISTS budget_reservations (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reserved_tokens INTEGER NOT NULL,
  reserved_spend_usd REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  settled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_budget_reservations_status ON budget_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_budget_reservations_target ON budget_reservations(scope, target_id);

CREATE TABLE IF NOT EXISTS budget_ledger (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  target_id TEXT NOT NULL,
  tokens INTEGER NOT NULL,
  spend_usd REAL NOT NULL,
  is_estimate INTEGER NOT NULL DEFAULT 1,
  model_id TEXT,
  provider_id TEXT,
  task_step_id TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_budget_ledger_target ON budget_ledger(scope, target_id);
CREATE INDEX IF NOT EXISTS idx_budget_ledger_timestamp ON budget_ledger(timestamp);
`;
