/**
 * @terrarium/core - persistence/migrations/006_telemetry_and_logs.ts
 *
 * Migration adding structured_logs table, telemetry_metrics table, and correlation indexes.
 * Aligns with PLAN.md Section 18 (Observability & Auditability).
 */

export const MIGRATION_006_VERSION = 6;
export const MIGRATION_006_NAME = "006_telemetry_and_logs";

export const MIGRATION_006_UP = `
CREATE TABLE IF NOT EXISTS structured_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  span_id TEXT,
  parent_span_id TEXT,
  task_id TEXT,
  step_id TEXT,
  agent_slug TEXT,
  metadata_json TEXT,
  is_diagnostic INTEGER NOT NULL DEFAULT 0,
  is_redacted INTEGER NOT NULL DEFAULT 1,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_correlation ON structured_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_logs_trace ON structured_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_logs_task ON structured_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_logs_level ON structured_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_time ON structured_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_diagnostic ON structured_logs(is_diagnostic);

CREATE TABLE IF NOT EXISTS telemetry_metrics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  tags_json TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON telemetry_metrics(name, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_time ON telemetry_metrics(timestamp);
`;
