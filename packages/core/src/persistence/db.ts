/**
 * @terrarium/core - persistence/db.ts
 *
 * SQLite connection manager using Bun's native bun:sqlite.
 * Configures WAL mode, foreign keys, busy timeout, and connection health monitoring.
 * Aligns with PLAN.md Section 10.1 & 14 and PLAN_CONTEXT.md Section 8.
 */

import { Database } from "bun:sqlite";
import { dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import {
  type Result,
  ok,
  fail,
  DatabaseError,
  DatabaseUnavailableError,
} from "@terrarium/contracts";

export interface DatabaseConnectionOptions {
  readonly path: string;
  readonly readonly?: boolean;
  readonly busyTimeoutMs?: number;
}

export class SqliteConnection {
  private db: Database | null = null;
  readonly path: string;
  private readonly busyTimeoutMs: number;

  constructor(options: DatabaseConnectionOptions) {
    this.path = options.path;
    this.busyTimeoutMs = options.busyTimeoutMs ?? 5000;
  }

  /**
   * Opens and initializes the SQLite database connection with performance and safety PRAGMAs.
   */
  open(): Result<Database, DatabaseUnavailableError> {
    if (this.db) {
      return ok(this.db);
    }

    try {
      // Ensure parent directory exists for file databases
      if (this.path !== ":memory:") {
        const dir = dirname(this.path);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      }

      this.db = new Database(this.path, {
        create: true,
        readwrite: true,
      });

      // 1. Enable WAL mode for high concurrency (writers do not block readers)
      if (this.path !== ":memory:") {
        this.db.run("PRAGMA journal_mode = WAL;");
      }

      // 2. Enforce relational foreign key constraints
      this.db.run("PRAGMA foreign_keys = ON;");

      // 3. Set busy timeout so concurrent transactions wait rather than failing immediately
      this.db.run(`PRAGMA busy_timeout = ${this.busyTimeoutMs};`);

      // 4. Synchronous NORMAL provides great durability in WAL mode with minimal I/O stalls
      this.db.run("PRAGMA synchronous = NORMAL;");

      return ok(this.db);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(new DatabaseUnavailableError(this.path, message));
    }
  }

  /**
   * Returns the active raw database instance or throws if not open.
   */
  getRawDb(): Database {
    if (!this.db) {
      const openRes = this.open();
      if (!openRes.success) {
        throw openRes.error;
      }
    }
    return this.db!;
  }

  /**
   * Verifies database responsiveness via quick health check query.
   */
  ping(): Result<boolean, DatabaseUnavailableError> {
    try {
      const db = this.getRawDb();
      const res = db.query("SELECT 1 as alive").get() as { alive: number } | null;
      if (res && res.alive === 1) {
        return ok(true);
      }
      return fail(new DatabaseUnavailableError(this.path, "Health check query returned unexpected result"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(new DatabaseUnavailableError(this.path, message));
    }
  }

  /**
   * Runs SQLite PRAGMA integrity_check to detect page corruption.
   */
  checkIntegrity(): Result<boolean, DatabaseError> {
    try {
      const db = this.getRawDb();
      const rows = db.query("PRAGMA integrity_check;").all() as Array<{ integrity_check: string }>;
      const isOk = rows.length === 1 && rows[0]?.integrity_check === "ok";
      if (isOk) {
        return ok(true);
      }
      const issues = rows.map((r) => r.integrity_check).join(", ");
      return fail(new DatabaseError(`Database integrity check failed: ${issues}`));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(new DatabaseError(`Failed to run integrity check: ${message}`));
    }
  }

  /**
   * Backs up the live database to a destination file safely using VACUUM INTO.
   */
  backup(destinationPath: string): Result<string, DatabaseError> {
    try {
      const db = this.getRawDb();
      const destDir = dirname(destinationPath);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      // VACUUM INTO safely snapshots live WAL database without locking readers
      db.run(`VACUUM INTO ?;`, [destinationPath]);
      return ok(destinationPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(new DatabaseError(`Backup failed: ${message}`));
    }
  }

  /**
   * Gracefully closes the database connection.
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } finally {
        this.db = null;
      }
    }
  }
}
