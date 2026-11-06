# TERRARIUM — Persistence and Migrations Guide

This document defines the storage architecture, entity-relationship schema, migration system, transaction semantics, and operational procedures for TERRARIUM's persistence foundation.

---

## 1. Architectural Principles

In alignment with **PLAN.md Section 10.1 & 14** and **PLAN_CONTEXT.md Section 8**, TERRARIUM adheres to strict storage principles:

1. **Embedded Local SQLite (`bun:sqlite`):**
   - Built directly into the Bun runtime with zero external npm dependencies or native binding overhead.
   - Operates in-process with minimal latency, avoiding network hops and multi-service complexity.
   - Zero Redis, zero queue daemons, and zero vector database dependencies.
2. **Storage-Independent Contracts:**
   - The `@terrarium/contracts` package defines pure, storage-agnostic repository interfaces (`TaskRepository`, `StepRepository`, `ExecutionRepository`, etc.).
   - Orchestration runtimes and agent life-cycles interact solely with repository abstractions and `Result<T, E>` types, never issuing raw SQL directly.
3. **Write-Ahead Logging (WAL) & Foreign Key Constraints:**
   - On-disk databases enforce `PRAGMA journal_mode = WAL;` enabling concurrent readers and writers without lock starvation.
   - `PRAGMA foreign_keys = ON;` is enforced on every connection to maintain referential integrity across relational entities.
4. **Deterministic Migration Verification:**
   - Migrations are version-ordered, transactional, and validated via SHA-256 checksums to prevent subtle schema drift and tampering.

---

## 2. Entity-Relationship Schema

The initial migration (`001_initial_schema`) creates 10 core tables with foreign keys and performance indexes:

```
┌─────────────────┐       1:N       ┌─────────────────┐       1:N       ┌─────────────────┐
│      tasks      ├─────────────────►│   task_steps    ├─────────────────►│   executions    │
└────────┬────────┘                 └─────────────────┘                 └─────────────────┘
         │
         │ 1:N
         ├──────────────────────────┬──────────────────────────┬──────────────────────────┐
         ▼                          ▼                          ▼                          ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│    artifacts    │        │    approvals    │        │     reports     │        │  domain_events  │
└─────────────────┘        └─────────────────┘        └─────────────────┘        └─────────────────┘

┌─────────────────┐       1:N       ┌─────────────────┐                 ┌─────────────────┐
│    sessions     ├─────────────────►│    messages     │                 │  memory_items   │
└─────────────────┘                 └─────────────────┘                 └─────────────────┘
```

### Table Summary

| Table | Primary Key | Key Relationships | Purpose |
|---|---|---|---|
| `tasks` | `id (TEXT)` | `parent_task_id REFERENCES tasks(id) ON DELETE SET NULL` | Top-level goals, delegations, and departmental assignments |
| `task_steps` | `id (TEXT)` | `task_id REFERENCES tasks(id) ON DELETE CASCADE` | Granular sequential steps within an orchestration task |
| `executions` | `id (TEXT)` | `task_id REFERENCES tasks(id) ON DELETE CASCADE`, `step_id REFERENCES task_steps(id)` | Model invocation instances, token counts, and spend metrics |
| `sessions` | `id (TEXT)` | `active_task_id REFERENCES tasks(id) ON DELETE SET NULL` | Interactive chat sessions, modes, and participant agents |
| `messages` | `id (TEXT)` | `session_id REFERENCES sessions(id) ON DELETE CASCADE` | Chat transcripts, tool call records, citations, and roles |
| `artifacts` | `id (TEXT)` | `task_id REFERENCES tasks(id) ON DELETE CASCADE` | Output deliverables (code patches, test plans, specs) |
| `approvals` | `id (TEXT)` | `task_id REFERENCES tasks(id) ON DELETE CASCADE`, `execution_id REFERENCES executions(id)` | Consequential action approval gates and human decisions |
| `domain_events`| `id (TEXT)` | Indexed by `entity_type, entity_id`, `event_type`, `timestamp` | Append-only audit and observability event log |
| `reports` | `id (TEXT)` | `task_id REFERENCES tasks(id) ON DELETE CASCADE` | Multi-agent structured synthesis, findings, and recommendations |
| `memory_items` | `id (TEXT)` | `UNIQUE(category, key)` | Durable project context, decisions, requirements, and risks |

---

## 3. Connection & Concurrency Management

All SQLite connections are encapsulated within `SqliteConnection` (`packages/core/src/persistence/db.ts`):

```ts
import { SqliteConnection } from "@terrarium/core";

const connection = new SqliteConnection({
  path: ".terrarium/data/terrarium.sqlite3",
  busyTimeoutMs: 5000,
});
```

### Key Pragmas Configured
- **`PRAGMA journal_mode = WAL;`**  
  Applied automatically for on-disk databases. WAL provides high-performance concurrent readers without blocking writes.
- **`PRAGMA synchronous = NORMAL;`**  
  Reduces filesystem sync overhead while remaining crash-safe in WAL mode.
- **`PRAGMA foreign_keys = ON;`**  
  Guarantees relational consistency and prevents orphan records.
- **`PRAGMA busy_timeout = 5000;`**  
  Waits up to 5,000ms if another process holds a write lock before throwing `SQLITE_BUSY`.

### Page Integrity Verification & Online Backups
- **`checkIntegrity()`**: Runs `PRAGMA integrity_check;` and verifies pages are not corrupted.
- **`backup(destPath)`**: Uses SQLite native `VACUUM INTO '<destination>';` to create an atomic, non-locking snapshot of the live database without service interruption.

---

## 4. Migration Architecture & Integrity

Database migrations are managed by `MigrationRunner` (`packages/core/src/persistence/migrations/migration-runner.ts`):

1. **Tracking Table (`_terrarium_migrations`):**
   - Stores `version (INTEGER)`, `name (TEXT)`, `checksum (TEXT)`, and `applied_at (TEXT)`.
2. **SHA-256 Checksum Verification:**
   - Every migration file's SQL content is hashed using SHA-256.
   - On startup, previously executed migrations are verified against codebase definitions. If any already-applied migration has been modified, execution immediately halts with `MigrationMismatchError`.
3. **Version Regression Protection:**
   - If the database file has a version higher than what the current application codebase knows, startup fails with `MigrationMismatchError` rather than proceeding in an undefined state.
4. **Transactional Execution:**
   - Each migration's DDL and tracking entry are committed together inside an atomic transaction (`BEGIN` / `COMMIT`). If DDL fails, it is rolled back completely.

---

## 5. Repository Layer & Error Mapping

Core repositories implement storage-agnostic interfaces from `@terrarium/contracts`:

- `SqliteTaskRepository`
- `SqliteStepRepository`
- `SqliteExecutionRepository`
- `SqliteSessionRepository`
- `SqliteArtifactRepository`
- `SqliteApprovalRepository`
- `SqliteEventRepository`
- `SqliteReportRepository`
- `SqliteMemoryRepository`

### Error Translation (`handleSqliteError`)

Raw SQLite exceptions are intercepted and converted into strongly typed domain errors:

| SQLite Error Condition | Translated Domain Error | Contract Location |
|---|---|---|
| `UNIQUE constraint failed`, `PRIMARY KEY constraint failed` | `DuplicateEntityError` | `@terrarium/contracts` |
| `FOREIGN KEY constraint failed` | `ForeignKeyConstraintError` | `@terrarium/contracts` |
| File open failures, permissions, missing parent directories | `DatabaseUnavailableError` | `@terrarium/contracts` |
| Checksum mismatch, version ahead | `MigrationMismatchError` | `@terrarium/contracts` |
| General SQL execution errors | `DatabaseError` | `@terrarium/contracts` |

---

## 6. Transaction Semantics (`withTransaction`)

Multi-entity operations that must succeed or fail together use `withTransaction` on `SqliteDatabase`:

```ts
const result = await db.withTransaction(async () => {
  const taskRes = await db.tasks.create(task);
  if (!taskRes.success) throw taskRes.error;

  const stepRes = await db.steps.create(step);
  if (!stepRes.success) throw stepRes.error;

  return { taskId: taskRes.data.id, stepId: stepRes.data.id };
});
```

- Begins with `BEGIN IMMEDIATE;` to reserve a write lock immediately and avoid deadlocks under concurrency.
- If the inner function resolves without error, commits with `COMMIT;`.
- If an unhandled exception is thrown, issues `ROLLBACK;` and returns `Result.fail(new DatabaseError(...))`.

---

## 7. Operational Troubleshooting & FAQs

### Database File Locked (`SQLITE_BUSY`)
- **Cause:** Another process or background worker holds an exclusive lock longer than `busyTimeoutMs`.
- **Remedy:** Ensure all connections use `WAL` mode and keep `withTransaction` blocks brief. Avoid wrapping long-running network or LLM API calls inside database transactions.

### Tampered Migration Detected
- **Error:** `MigrationMismatchError: Checksum mismatch on migration 1`
- **Cause:** The SQL string of an applied migration was modified in the codebase after being executed against an existing database file.
- **Remedy:** Never modify committed migrations. Always author a new sequential migration (e.g., `002_add_index.ts`). For local testing, remove `.terrarium/data/terrarium.sqlite3` to recreate fresh.

### In-Memory Database for Testing
- Pass `":memory:"` as the database path. All migrations execute in memory with sub-millisecond execution times and zero filesystem cleanup required.
