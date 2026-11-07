/**
 * @terrarium/core - persistence/migrations/002_agent_profiles.ts
 *
 * Migration adding the agent_profiles table for durable profile registration.
 * Aligns with PLAN.md Section 4 (Organization and Agent Model).
 */

export const MIGRATION_002_VERSION = 2;
export const MIGRATION_002_NAME = "002_agent_profiles";

export const MIGRATION_002_UP = `
CREATE TABLE IF NOT EXISTS agent_profiles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt_template TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  supported_tasks_json TEXT NOT NULL DEFAULT '[]',
  constraints_json TEXT NOT NULL DEFAULT '{}',
  limits_json TEXT NOT NULL DEFAULT '{}',
  model_preference_json TEXT NOT NULL DEFAULT '{}',
  permissions_json TEXT NOT NULL DEFAULT '[]',
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'available',
  tags_json TEXT NOT NULL DEFAULT '[]',
  persona_attributes_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_slug ON agent_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_dept ON agent_profiles(department);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_status ON agent_profiles(status);
`;
