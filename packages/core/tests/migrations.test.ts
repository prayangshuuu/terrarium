import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import {
  MigrationMismatchError,
} from "@terrarium/contracts";
import {
  MigrationRunner,
  type MigrationDefinition,
} from "../src/persistence/migrations/migration-runner.ts";

describe("Database Migration Runner & Integrity", () => {
  it("runs initial migration cleanly and creates tracking table", () => {
    const rawDb = new Database(":memory:");
    const runner = new MigrationRunner(rawDb);

    const res = runner.runMigrations();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.length).toBe(4);
      expect(res.data[0]?.version).toBe(1);
      expect(res.data[1]?.version).toBe(2);
      expect(res.data[2]?.version).toBe(3);
      expect(res.data[3]?.version).toBe(4);
    }

    const applied = runner.getAppliedMigrations();
    expect(applied.length).toBe(4);
    expect(applied[0]?.version).toBe(1);
    expect(applied[1]?.version).toBe(2);
    expect(applied[2]?.version).toBe(3);
    expect(applied[3]?.version).toBe(4);
    expect(applied[0]?.checksum).toBeDefined();
    expect(applied[1]?.checksum).toBeDefined();
    expect(applied[2]?.checksum).toBeDefined();
    expect(applied[3]?.checksum).toBeDefined();

    rawDb.close();
  });

  it("is idempotent: subsequent migration runs apply 0 new migrations", () => {
    const rawDb = new Database(":memory:");
    const runner = new MigrationRunner(rawDb);

    runner.runMigrations();
    const secondRun = runner.runMigrations();
    expect(secondRun.success).toBe(true);
    if (secondRun.success) {
      expect(secondRun.data.length).toBe(0);
    }

    rawDb.close();
  });

  it("detects checksum tampering on previously applied migrations", () => {
    const rawDb = new Database(":memory:");
    const initialMigrations: MigrationDefinition[] = [
      {
        version: 1,
        name: "test_m1",
        up: "CREATE TABLE t1 (id TEXT PRIMARY KEY);",
      },
    ];

    const runner1 = new MigrationRunner(rawDb, initialMigrations);
    runner1.runMigrations();

    // Now instantiate runner with altered SQL for the same migration version
    const alteredMigrations: MigrationDefinition[] = [
      {
        version: 1,
        name: "test_m1",
        up: "CREATE TABLE t1 (id TEXT PRIMARY KEY, tampered TEXT);",
      },
    ];

    const runner2 = new MigrationRunner(rawDb, alteredMigrations);
    const res = runner2.runMigrations();

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error instanceof MigrationMismatchError).toBe(true);
      expect(res.error.message).toContain("Checksum mismatch");
    }

    rawDb.close();
  });

  it("detects database version ahead of codebase definitions", () => {
    const rawDb = new Database(":memory:");
    const runner = new MigrationRunner(rawDb, []);

    // Manually insert a future migration record
    rawDb.run(`
      CREATE TABLE IF NOT EXISTS _terrarium_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    rawDb.run("INSERT INTO _terrarium_migrations VALUES (999, 'future', 'xyz', '2030-01-01');");

    const res = runner.runMigrations();
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error instanceof MigrationMismatchError).toBe(true);
      expect(res.error.message).toContain("newer than codebase version");
    }

    rawDb.close();
  });
});
