/**
 * @terrarium/core - persistence/repositories/sqlite-artifact-repository.ts
 *
 * SQLite implementation of ArtifactRepository.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type Artifact,
  type ArtifactRepository,
  type DatabaseError,
  type DuplicateEntityError,
  NotFoundError,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface ArtifactRow {
  id: string;
  task_id: string;
  agent_id: string;
  title: string;
  artifact_type: string;
  path: string;
  mime_type: string;
  checksum: string | null;
  size_bytes: number;
  is_verified: number;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

function rowToArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    taskId: row.task_id,
    agentId: row.agent_id,
    title: row.title,
    artifactType: row.artifact_type as any,
    path: row.path,
    mimeType: row.mime_type,
    checksum: row.checksum ?? undefined,
    sizeBytes: row.size_bytes,
    isVerified: Boolean(row.is_verified),
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteArtifactRepository implements ArtifactRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Result<Artifact | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM artifacts WHERE id = ?;").get(id) as ArtifactRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToArtifact(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Artifact", id));
    }
  }

  async listByTaskId(taskId: string): Promise<Result<readonly Artifact[], DatabaseError>> {
    try {
      const rows = this.db
        .query("SELECT * FROM artifacts WHERE task_id = ? ORDER BY created_at ASC;")
        .all(taskId) as ArtifactRow[];
      return ok(rows.map(rowToArtifact));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Artifact", taskId));
    }
  }

  async create(artifact: Artifact): Promise<Result<Artifact, DuplicateEntityError | DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO artifacts (
          id, task_id, agent_id, title, artifact_type, path, mime_type,
          checksum, size_bytes, is_verified, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          artifact.id,
          artifact.taskId,
          artifact.agentId,
          artifact.title,
          artifact.artifactType,
          artifact.path,
          artifact.mimeType,
          artifact.checksum ?? null,
          artifact.sizeBytes,
          artifact.isVerified ? 1 : 0,
          artifact.metadata ? JSON.stringify(artifact.metadata) : null,
          artifact.createdAt,
          artifact.updatedAt,
        ]
      );
      return ok(artifact);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Artifact", artifact.id, "task_id"));
    }
  }

  async update(artifact: Artifact): Promise<Result<Artifact, NotFoundError | DatabaseError>> {
    try {
      const res = this.db.run(
        `UPDATE artifacts SET
          title = ?,
          artifact_type = ?,
          path = ?,
          mime_type = ?,
          checksum = ?,
          size_bytes = ?,
          is_verified = ?,
          metadata_json = ?,
          updated_at = ?
        WHERE id = ?;`,
        [
          artifact.title,
          artifact.artifactType,
          artifact.path,
          artifact.mimeType,
          artifact.checksum ?? null,
          artifact.sizeBytes,
          artifact.isVerified ? 1 : 0,
          artifact.metadata ? JSON.stringify(artifact.metadata) : null,
          artifact.updatedAt,
          artifact.id,
        ]
      );

      if (res.changes === 0) {
        return fail(new NotFoundError("Artifact", artifact.id));
      }
      return ok(artifact);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Artifact", artifact.id));
    }
  }

  async delete(id: string): Promise<Result<boolean, DatabaseError>> {
    try {
      const res = this.db.run("DELETE FROM artifacts WHERE id = ?;", [id]);
      return ok(res.changes > 0);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Artifact", id));
    }
  }
}
