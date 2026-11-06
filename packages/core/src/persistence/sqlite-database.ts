/**
 * @terrarium/core - persistence/sqlite-database.ts
 *
 * Composite SQLite database container implementing TerrariumRepositories.
 * Provides unified access to all domain repositories, migration execution, and transaction wrappers.
 * Aligns with PLAN.md Section 10.1 & 14 and PLAN_CONTEXT.md Section 8.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  DatabaseError,
  type DatabaseUnavailableError,
  type MigrationMismatchError,
  type TerrariumRepositories,
} from "@terrarium/contracts";
import { SqliteConnection } from "./db.ts";
import { MigrationRunner } from "./migrations/migration-runner.ts";
import { SqliteTaskRepository } from "./repositories/sqlite-task-repository.ts";
import { SqliteStepRepository } from "./repositories/sqlite-step-repository.ts";
import { SqliteExecutionRepository } from "./repositories/sqlite-execution-repository.ts";
import { SqliteSessionRepository } from "./repositories/sqlite-session-repository.ts";
import { SqliteArtifactRepository } from "./repositories/sqlite-artifact-repository.ts";
import { SqliteApprovalRepository } from "./repositories/sqlite-approval-repository.ts";
import { SqliteEventRepository } from "./repositories/sqlite-event-repository.ts";
import { SqliteReportRepository } from "./repositories/sqlite-report-repository.ts";
import { SqliteMemoryRepository } from "./repositories/sqlite-memory-repository.ts";

export interface SqliteDatabaseOptions {
  readonly path: string;
  readonly autoMigrate?: boolean;
}

export class SqliteDatabase implements TerrariumRepositories {
  readonly connection: SqliteConnection;
  readonly tasks: SqliteTaskRepository;
  readonly steps: SqliteStepRepository;
  readonly executions: SqliteExecutionRepository;
  readonly sessions: SqliteSessionRepository;
  readonly artifacts: SqliteArtifactRepository;
  readonly approvals: SqliteApprovalRepository;
  readonly events: SqliteEventRepository;
  readonly reports: SqliteReportRepository;
  readonly memory: SqliteMemoryRepository;

  private isInitialized = false;

  constructor(options: SqliteDatabaseOptions) {
    this.connection = new SqliteConnection({ path: options.path });
    const rawDb = this.connection.getRawDb();

    this.tasks = new SqliteTaskRepository(rawDb);
    this.steps = new SqliteStepRepository(rawDb);
    this.executions = new SqliteExecutionRepository(rawDb);
    this.sessions = new SqliteSessionRepository(rawDb);
    this.artifacts = new SqliteArtifactRepository(rawDb);
    this.approvals = new SqliteApprovalRepository(rawDb);
    this.events = new SqliteEventRepository(rawDb);
    this.reports = new SqliteReportRepository(rawDb);
    this.memory = new SqliteMemoryRepository(rawDb);

    if (options.autoMigrate ?? true) {
      const initRes = this.initialize();
      if (!initRes.success) {
        throw initRes.error;
      }
    }
  }

  /**
   * Runs pending database schema migrations.
   */
  initialize(): Result<void, DatabaseError | MigrationMismatchError> {
    if (this.isInitialized) {
      return ok(undefined);
    }

    const runner = new MigrationRunner(this.connection.getRawDb());
    const migrateRes = runner.runMigrations();
    if (!migrateRes.success) {
      return fail(migrateRes.error);
    }

    this.isInitialized = true;
    return ok(undefined);
  }

  /**
   * Executes an asynchronous operation inside an atomic database transaction.
   * Automatically rolls back on failure or re-throws.
   */
  async withTransaction<T>(operation: () => Promise<T>): Promise<Result<T, DatabaseError>> {
    const rawDb = this.connection.getRawDb();
    try {
      rawDb.run("BEGIN IMMEDIATE;");
      const result = await operation();
      rawDb.run("COMMIT;");
      return ok(result);
    } catch (err: unknown) {
      try {
        rawDb.run("ROLLBACK;");
      } catch {
        // Rollback attempt best-effort
      }
      const message = err instanceof Error ? err.message : String(err);
      return fail(new DatabaseError(`Transaction rolled back due to error: ${message}`));
    }
  }

  /**
   * Checks database connectivity.
   */
  ping(): Result<boolean, DatabaseUnavailableError> {
    return this.connection.ping();
  }

  /**
   * Checks database page integrity.
   */
  checkIntegrity(): Result<boolean, DatabaseError> {
    return this.connection.checkIntegrity();
  }

  /**
   * Creates an online snapshot of the database.
   */
  backup(destinationPath: string): Result<string, DatabaseError> {
    return this.connection.backup(destinationPath);
  }

  /**
   * Closes the database connection.
   */
  close(): void {
    this.connection.close();
    this.isInitialized = false;
  }
}

/**
 * Creates and initializes an on-disk or in-memory SQLite database.
 */
export function createSqliteDatabase(path = ":memory:"): SqliteDatabase {
  return new SqliteDatabase({ path });
}
