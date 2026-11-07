/**
 * @terrarium/core - persistence/repositories/sqlite-agent-profile-repository.ts
 *
 * SQLite implementation of AgentProfileRepository.
 * Manages durable agent profiles as data entities separate from active execution instances.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type DatabaseError,
  type DuplicateEntityError,
  NotFoundError,
  type AgentDepartment,
  type AgentProfile,
  type AgentProfileQueryOptions,
  type AgentProfileRepository,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface AgentProfileRow {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  department: string;
  role: string;
  description: string;
  system_prompt_template: string;
  capabilities_json: string;
  supported_tasks_json: string;
  constraints_json: string;
  limits_json: string;
  model_preference_json: string;
  permissions_json: string;
  version: string;
  status: string;
  tags_json: string;
  persona_attributes_json: string | null;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

function rowToProfile(row: AgentProfileRow): AgentProfile {
  const constraints = JSON.parse(row.constraints_json || "{}");
  const limits = JSON.parse(row.limits_json || "{}");

  const normalizedConstraints = {
    maxTokensPerTurn: constraints.maxTokensPerTurn ?? limits.maxTokensPerTurn ?? 4096,
    maxDelegationDepth: constraints.maxDelegationDepth ?? limits.maxDelegationDepth ?? 2,
    maxChildrenTasks: constraints.maxChildrenTasks ?? limits.maxChildrenTasks ?? 5,
    timeoutMs: constraints.timeoutMs,
    disallowedTools: constraints.disallowedTools,
    requiresApprovalForConsequential: constraints.requiresApprovalForConsequential,
  };

  const normalizedLimits = {
    maxTokensPerTurn: normalizedConstraints.maxTokensPerTurn,
    maxDelegationDepth: normalizedConstraints.maxDelegationDepth,
    maxChildrenTasks: normalizedConstraints.maxChildrenTasks,
  };

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    displayName: row.display_name,
    department: row.department as AgentDepartment,
    role: row.role,
    description: row.description,
    systemPromptTemplate: row.system_prompt_template,
    capabilities: JSON.parse(row.capabilities_json || "[]"),
    supportedTasks: JSON.parse(row.supported_tasks_json || "[]"),
    constraints: normalizedConstraints,
    limits: normalizedLimits,
    modelPreference: JSON.parse(row.model_preference_json || '{"tier":"standard"}'),
    permissions: JSON.parse(row.permissions_json || "[]"),
    version: row.version || "1.0.0",
    status: row.status as AgentProfile["status"],
    tags: JSON.parse(row.tags_json || "[]"),
    personaAttributes: row.persona_attributes_json ? JSON.parse(row.persona_attributes_json) : undefined,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteAgentProfileRepository implements AgentProfileRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Result<AgentProfile | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM agent_profiles WHERE id = ?;").get(id) as AgentProfileRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToProfile(row));
    } catch (err) {
      return fail(handleSqliteError(err, "AgentProfile", id));
    }
  }

  async findBySlug(slug: string): Promise<Result<AgentProfile | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM agent_profiles WHERE slug = ?;").get(slug) as AgentProfileRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToProfile(row));
    } catch (err) {
      return fail(handleSqliteError(err, "AgentProfile", slug));
    }
  }

  async list(options: AgentProfileQueryOptions = {}): Promise<Result<readonly AgentProfile[], DatabaseError>> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (options.department) {
        conditions.push("department = ?");
        params.push(options.department);
      }

      if (options.status) {
        conditions.push("status = ?");
        params.push(options.status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const limitClause = options.limit !== undefined ? `LIMIT ${options.limit}` : "";
      const offsetClause = options.offset !== undefined ? `OFFSET ${options.offset}` : "";

      const sql = `SELECT * FROM agent_profiles ${whereClause} ORDER BY department ASC, name ASC ${limitClause} ${offsetClause};`;
      const rows = this.db.query(sql).all(...params) as AgentProfileRow[];

      let profiles = rows.map(rowToProfile);
      if (options.tag) {
        profiles = profiles.filter((p) => p.tags.includes(options.tag!));
      }

      return ok(profiles);
    } catch (err) {
      return fail(handleSqliteError(err, "AgentProfile", "list"));
    }
  }

  async search(
    query: string,
    department?: AgentDepartment,
    limit = 50
  ): Promise<Result<readonly AgentProfile[], DatabaseError>> {
    try {
      const searchPattern = `%${query.toLowerCase().trim()}%`;
      const conditions: string[] = [
        "(LOWER(name) LIKE ? OR LOWER(slug) LIKE ? OR LOWER(role) LIKE ? OR LOWER(description) LIKE ? OR LOWER(capabilities_json) LIKE ? OR LOWER(supported_tasks_json) LIKE ? OR LOWER(tags_json) LIKE ?)",
      ];
      const params: any[] = [
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
      ];

      if (department) {
        conditions.push("department = ?");
        params.push(department);
      }

      const sql = `SELECT * FROM agent_profiles WHERE ${conditions.join(" AND ")} ORDER BY name ASC LIMIT ?;`;
      params.push(limit);

      const rows = this.db.query(sql).all(...params) as AgentProfileRow[];
      return ok(rows.map(rowToProfile));
    } catch (err) {
      return fail(handleSqliteError(err, "AgentProfile", "search"));
    }
  }

  async create(profile: AgentProfile): Promise<Result<AgentProfile, DuplicateEntityError | DatabaseError>> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO agent_profiles (
          id, slug, name, display_name, department, role, description,
          system_prompt_template, capabilities_json, supported_tasks_json,
          constraints_json, limits_json, model_preference_json, permissions_json,
          version, status, tags_json, persona_attributes_json, metadata_json,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?
        );
      `);

      stmt.run(
        profile.id,
        profile.slug,
        profile.name,
        profile.displayName,
        profile.department,
        profile.role,
        profile.description,
        profile.systemPromptTemplate,
        JSON.stringify(profile.capabilities),
        JSON.stringify(profile.supportedTasks),
        JSON.stringify(profile.constraints),
        JSON.stringify(profile.limits),
        JSON.stringify(profile.modelPreference),
        JSON.stringify(profile.permissions),
        profile.version,
        profile.status,
        JSON.stringify(profile.tags),
        profile.personaAttributes ? JSON.stringify(profile.personaAttributes) : null,
        JSON.stringify(profile.metadata ?? {}),
        profile.createdAt,
        profile.updatedAt
      );

      return ok(profile);
    } catch (err) {
      return fail(handleSqliteError(err, "AgentProfile", profile.id));
    }
  }

  async update(profile: AgentProfile): Promise<Result<AgentProfile, NotFoundError | DatabaseError>> {
    try {
      const stmt = this.db.prepare(`
        UPDATE agent_profiles SET
          slug = ?,
          name = ?,
          display_name = ?,
          department = ?,
          role = ?,
          description = ?,
          system_prompt_template = ?,
          capabilities_json = ?,
          supported_tasks_json = ?,
          constraints_json = ?,
          limits_json = ?,
          model_preference_json = ?,
          permissions_json = ?,
          version = ?,
          status = ?,
          tags_json = ?,
          persona_attributes_json = ?,
          metadata_json = ?,
          updated_at = ?
        WHERE id = ?;
      `);

      const result = stmt.run(
        profile.slug,
        profile.name,
        profile.displayName,
        profile.department,
        profile.role,
        profile.description,
        profile.systemPromptTemplate,
        JSON.stringify(profile.capabilities),
        JSON.stringify(profile.supportedTasks),
        JSON.stringify(profile.constraints),
        JSON.stringify(profile.limits),
        JSON.stringify(profile.modelPreference),
        JSON.stringify(profile.permissions),
        profile.version,
        profile.status,
        JSON.stringify(profile.tags),
        profile.personaAttributes ? JSON.stringify(profile.personaAttributes) : null,
        JSON.stringify(profile.metadata ?? {}),
        profile.updatedAt,
        profile.id
      );

      if (result.changes === 0) {
        return fail(new NotFoundError("AgentProfile", profile.id));
      }

      return ok(profile);
    } catch (err) {
      return fail(handleSqliteError(err, "AgentProfile", profile.id));
    }
  }

  async delete(id: string): Promise<Result<boolean, DatabaseError>> {
    try {
      const stmt = this.db.prepare("DELETE FROM agent_profiles WHERE id = ?;");
      const result = stmt.run(id);
      return ok(result.changes > 0);
    } catch (err) {
      return fail(handleSqliteError(err, "AgentProfile", id));
    }
  }

  async count(department?: AgentDepartment): Promise<Result<number, DatabaseError>> {
    try {
      let sql = "SELECT COUNT(*) as count FROM agent_profiles";
      const params: any[] = [];
      if (department) {
        sql += " WHERE department = ?";
        params.push(department);
      }
      const row = this.db.query(sql).get(...params) as { count: number } | null;
      return ok(row?.count ?? 0);
    } catch (err) {
      return fail(handleSqliteError(err, "AgentProfile", "count"));
    }
  }
}
