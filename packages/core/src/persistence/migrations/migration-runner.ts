/**
 * @terrarium/core - persistence/migrations/migration-runner.ts
 *
 * Deterministic database migration runner with checksum verification and transaction wrapping.
 * Aligns with PLAN_CONTEXT.md Section 8 and PLAN.md Section 10.1.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  DatabaseError,
  MigrationMismatchError,
} from "@terrarium/contracts";
import {
  MIGRATION_001_NAME,
  MIGRATION_001_UP,
  MIGRATION_001_VERSION,
} from "./001_initial_schema.ts";
import {
  MIGRATION_002_NAME,
  MIGRATION_002_UP,
  MIGRATION_002_VERSION,
} from "./002_agent_profiles.ts";

export interface MigrationDefinition {
  readonly version: number;
  readonly name: string;
  readonly up: string;
}

export const REGISTERED_MIGRATIONS: readonly MigrationDefinition[] = [
  {
    version: MIGRATION_001_VERSION,
    name: MIGRATION_001_NAME,
    up: MIGRATION_001_UP,
  },
  {
    version: MIGRATION_002_VERSION,
    name: MIGRATION_002_NAME,
    up: MIGRATION_002_UP,
  },
];

/**
 * Computes deterministic 32-bit checksum for migration content string.
 */
function computeChecksum(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export interface AppliedMigrationRow {
  version: number;
  name: string;
  checksum: string;
  applied_at: string;
}

export class MigrationRunner {
  private readonly db: Database;
  private readonly migrations: readonly MigrationDefinition[];

  constructor(db: Database, migrations = REGISTERED_MIGRATIONS) {
    this.db = db;
    this.migrations = migrations;
  }

  /**
   * Initializes the internal migrations tracking table if not present.
   */
  private ensureMigrationsTable(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS _terrarium_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  /**
   * Returns list of all migrations recorded in the database.
   */
  getAppliedMigrations(): AppliedMigrationRow[] {
    this.ensureMigrationsTable();
    return this.db
      .query("SELECT version, name, checksum, applied_at FROM _terrarium_migrations ORDER BY version ASC;")
      .all() as AppliedMigrationRow[];
  }

  /**
   * Runs all pending migrations in order, verifying checksums of previously applied migrations.
   */
  runMigrations(): Result<AppliedMigrationRow[], DatabaseError | MigrationMismatchError> {
    try {
      this.ensureMigrationsTable();
      const applied = this.getAppliedMigrations();
      const appliedMap = new Map(applied.map((m) => [m.version, m]));

      // 1. Verify integrity of all previously applied migrations
      for (const def of this.migrations) {
        const recorded = appliedMap.get(def.version);
        if (recorded) {
          const currentChecksum = computeChecksum(def.up);
          if (recorded.checksum !== currentChecksum) {
            return fail(
              new MigrationMismatchError(
                def.version,
                recorded.version,
                `Checksum mismatch on migration ${def.version} (${def.name}). Recorded: ${recorded.checksum}, Current: ${currentChecksum}`
              )
            );
          }
        }
      }

      // Check if DB has migrations ahead of our code definitions
      const latestCodeVersion = Math.max(0, ...this.migrations.map((m) => m.version));
      for (const rec of applied) {
        if (rec.version > latestCodeVersion) {
          return fail(
            new MigrationMismatchError(
              latestCodeVersion,
              rec.version,
              `Database has version ${rec.version} which is newer than codebase version ${latestCodeVersion}`
            )
          );
        }
      }

      // 2. Apply pending migrations within transactions
      const newlyApplied: AppliedMigrationRow[] = [];

      for (const def of this.migrations) {
        if (!appliedMap.has(def.version)) {
          const checksum = computeChecksum(def.up);
          const now = new Date().toISOString();

          // Execute migration and record in a transaction
          const applyTx = this.db.transaction(() => {
            this.db.run(def.up);
            this.db.run(
              "INSERT INTO _terrarium_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?);",
              [def.version, def.name, checksum, now]
            );
          });

          applyTx();

          newlyApplied.push({
            version: def.version,
            name: def.name,
            checksum,
            applied_at: now,
          });
        }
      }

      return ok(newlyApplied);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(new DatabaseError(`Failed to run migrations: ${message}`));
    }
  }
}
