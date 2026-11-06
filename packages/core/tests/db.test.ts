import { describe, expect, it } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { SqliteConnection } from "../src/persistence/db.ts";

describe("SQLite Connection Management (bun:sqlite)", () => {
  it("opens an in-memory database and executes queries", () => {
    const conn = new SqliteConnection({ path: ":memory:" });
    const openRes = conn.open();
    expect(openRes.success).toBe(true);

    const pingRes = conn.ping();
    expect(pingRes.success).toBe(true);

    const integrityRes = conn.checkIntegrity();
    expect(integrityRes.success).toBe(true);

    conn.close();
  });

  it("verifies WAL mode and foreign keys PRAGMAs on disk", () => {
    const testDbPath = `/tmp/terrarium-test-${Date.now()}.sqlite3`;
    const conn = new SqliteConnection({ path: testDbPath });

    const openRes = conn.open();
    expect(openRes.success).toBe(true);

    const rawDb = conn.getRawDb();
    const fkRow = rawDb.query("PRAGMA foreign_keys;").get() as { foreign_keys: number };
    expect(fkRow.foreign_keys).toBe(1);

    const jmRow = rawDb.query("PRAGMA journal_mode;").get() as { journal_mode: string };
    expect(jmRow.journal_mode.toLowerCase()).toBe("wal");

    conn.close();

    // Clean up temporary database files
    for (const ext of ["", "-wal", "-shm"]) {
      const p = `${testDbPath}${ext}`;
      if (existsSync(p)) {
        unlinkSync(p);
      }
    }
  });

  it("safely backs up database using VACUUM INTO", () => {
    const testDbPath = `/tmp/terrarium-src-${Date.now()}.sqlite3`;
    const backupDbPath = `/tmp/terrarium-bak-${Date.now()}.sqlite3`;

    const conn = new SqliteConnection({ path: testDbPath });
    conn.open();
    const rawDb = conn.getRawDb();
    rawDb.run("CREATE TABLE test_data (id TEXT PRIMARY KEY, text TEXT);");
    rawDb.run("INSERT INTO test_data VALUES ('1', 'backup_verification');");

    const backupRes = conn.backup(backupDbPath);
    expect(backupRes.success).toBe(true);
    expect(existsSync(backupDbPath)).toBe(true);

    conn.close();

    // Verify backup database contents
    const bakConn = new SqliteConnection({ path: backupDbPath });
    bakConn.open();
    const row = bakConn.getRawDb().query("SELECT * FROM test_data;").get() as { id: string; text: string };
    expect(row.text).toBe("backup_verification");
    bakConn.close();

    // Cleanup
    for (const basePath of [testDbPath, backupDbPath]) {
      for (const ext of ["", "-wal", "-shm"]) {
        const p = `${basePath}${ext}`;
        if (existsSync(p)) unlinkSync(p);
      }
    }
  });

  it("fails gracefully with DatabaseUnavailableError on illegal path", () => {
    // Attempting to open a path in a non-creatable root directory
    const conn = new SqliteConnection({ path: "/dev/null/cannot/create.sqlite3" });
    const res = conn.open();
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.name).toBe("DatabaseUnavailableError");
    }
  });
});
