/**
 * @terrarium/core - persistence/migrations/004_project_memory_and_context.ts
 *
 * Migration adding project isolation, provenance, freshness, conflict detection,
 * and scoped context packaging to memory_items.
 * Aligns with PLAN.md Section 14 & PLAN_CONTEXT.md Section 6.
 */

export const MIGRATION_004_VERSION = 4;
export const MIGRATION_004_NAME = "004_project_memory_and_context";

export const MIGRATION_004_UP = `
ALTER TABLE memory_items ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE memory_items ADD COLUMN task_id TEXT;
ALTER TABLE memory_items ADD COLUMN owner TEXT;
ALTER TABLE memory_items ADD COLUMN source_type TEXT;
ALTER TABLE memory_items ADD COLUMN rationale TEXT;
ALTER TABLE memory_items ADD COLUMN last_validated_at TEXT;
ALTER TABLE memory_items ADD COLUMN freshness_status TEXT NOT NULL DEFAULT 'fresh';
ALTER TABLE memory_items ADD COLUMN is_conflicted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE memory_items ADD COLUMN conflict_with_id TEXT;
ALTER TABLE memory_items ADD COLUMN conflict_reason TEXT;
ALTER TABLE memory_items ADD COLUMN conflict_resolution TEXT;

CREATE INDEX IF NOT EXISTS idx_memory_project ON memory_items(project_id);
CREATE INDEX IF NOT EXISTS idx_memory_task ON memory_items(task_id);
CREATE INDEX IF NOT EXISTS idx_memory_freshness ON memory_items(freshness_status);
CREATE INDEX IF NOT EXISTS idx_memory_conflicted ON memory_items(is_conflicted);

CREATE TABLE IF NOT EXISTS context_packages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  agent_slug TEXT NOT NULL,
  department TEXT NOT NULL,
  package_json TEXT NOT NULL,
  token_estimate INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_context_packages_task ON context_packages(task_id);
CREATE INDEX IF NOT EXISTS idx_context_packages_project ON context_packages(project_id);
`;
