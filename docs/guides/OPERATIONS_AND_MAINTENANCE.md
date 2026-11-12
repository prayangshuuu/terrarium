# TERRARIUM — Operations, Maintenance & Troubleshooting Playbook

> **Role**: Platform Engineering & Site Reliability Operations (A3 Lead).  
> **Status**: Comprehensive guide covering storage layout, backup/restore, safe resets, log inspection, and troubleshooting.

---

## 1. Storage Architecture & Data Locations

TERRARIUM uses deterministic, isolated local storage paths configured via `@terrarium/config` and environment variables.

### Primary Filesystem Layout

```text
~/.terrarium/               # Default platform home directory (or ./.terrarium/ in workspace)
├── terrarium.db           # Primary SQLite database (WAL mode enabled)
├── terrarium.db-wal       # SQLite Write-Ahead Log
├── terrarium.db-shm       # SQLite Shared Memory index
├── logs/                  # Rotated execution and diagnostic log files
│   ├── terrarium.log      # Active platform log stream
│   └── audit.log          # Security audit trail with redacted credentials
├── artifacts/             # Durable execution deliverables and code patches
│   └── <task-id>/         # Per-task deliverable directory
└── reports/               # Synthesized Markdown reports and evidence exports
```

### Path Resolution Precedence
1. **Explicit Environment Variables**:
   - `TERRARIUM_DB_PATH`: Absolute or relative path to SQLite database.
   - `TERRARIUM_LOGS_DIR`: Path to log storage directory.
   - `TERRARIUM_REPORTS_DIR`: Path to exported reports directory.
   - `TERRARIUM_ARTIFACTS_DIR`: Path to execution artifacts.
2. **Local Workspace Directory**:
   - If `./.terrarium/` exists in the current project root, TERRARIUM operates in localized workspace mode.
3. **User Home Directory Fallback**:
   - Defaults to `~/.terrarium/` if no workspace directory or environment variable is set.

---

## 2. Backup & Disaster Recovery Procedures

Because all task states, plans, approvals, memory items, and event logs are stored in SQLite, disaster recovery is straightforward.

### 2.1 Online Hot Backup (Zero Downtime)
SQLite supports non-blocking hot backups while the platform is running using the `VACUUM INTO` command:

```bash
# 1. Hot snapshot using sqlite3 CLI
sqlite3 ~/.terrarium/terrarium.db "VACUUM INTO '~/.terrarium/backups/terrarium_backup_$(date +%Y%m%d_%H%M%S).db';"

# 2. Verify snapshot integrity
sqlite3 ~/.terrarium/backups/terrarium_backup_*.db "PRAGMA integrity_check;"
```

### 2.2 Cold Backup (Recommended for Major Maintenance)
1. Stop all active CLI sessions (`q` in OpenTUI or terminate processes).
2. Archive the database, WAL file, and artifacts:
   ```bash
   tar -czvf "terrarium_cold_backup_$(date +%Y%m%d).tar.gz" \
     ~/.terrarium/terrarium.db* \
     ~/.terrarium/artifacts/ \
     ~/.terrarium/reports/
   ```

### 2.3 Restoration Procedure
1. Ensure TERRARIUM processes are completely stopped.
2. Replace the target database file:
   ```bash
   cp ~/.terrarium/backups/terrarium_backup_<timestamp>.db ~/.terrarium/terrarium.db
   rm -f ~/.terrarium/terrarium.db-wal ~/.terrarium/terrarium.db-shm
   ```
3. Run integrity and foreign-key checks:
   ```bash
   sqlite3 ~/.terrarium/terrarium.db "PRAGMA integrity_check;"
   sqlite3 ~/.terrarium/terrarium.db "PRAGMA foreign_key_check;"
   ```
4. Verify migration state:
   ```bash
   sqlite3 ~/.terrarium/terrarium.db "SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC;"
   ```

---

## 3. Safe Reset & Zero-State Initialization

When resetting a test environment, developing new schemas, or clearing sensitive historical data:

### 3.1 Soft Reset (Preserve Config & Seed Catalog)
To wipe task history, artifacts, and transient event logs while preserving agent profiles and configuration:
```bash
sqlite3 ~/.terrarium/terrarium.db << 'EOF'
BEGIN TRANSACTION;
DELETE FROM artifacts;
DELETE FROM step_executions;
DELETE FROM plan_steps;
DELETE FROM task_plans;
DELETE FROM approval_requests;
DELETE FROM task_executions;
DELETE FROM tasks;
DELETE FROM reports;
DELETE FROM events;
DELETE FROM logs;
COMMIT;
VACUUM;
EOF
```

### 3.2 Hard Reset (Full Zero-State Reinitialization)
To reset the entire database to a clean slate:
1. Stop all CLI sessions.
2. Delete the database files:
   ```bash
   rm -f ~/.terrarium/terrarium.db*
   ```
3. Launch TERRARIUM (`bun run cli` or `bun test`).  
   The built-in `MigrationRunner` automatically detects the missing database, applies migrations 001 through 007, and seeds the initial representative virtual organization catalog.

---

## 4. Observability, Logs & Audit Trails

### Log Levels
TERRARIUM categorizes system messages into five standard severities:
- `DEBUG`: Fine-grained adapter payloads, token counts, and step state transitions.
- `INFO`: Normal operational milestones (task intake, plan approval, report generation).
- `WARN`: Recoverable anomalies (rate limit backoff, model tier fallback, budget warning thresholds).
- `ERROR`: Step execution failures, tool exceptions, network timeouts.
- `CRITICAL`: Database corruption, sandbox containment breach attempts, security violations.

### Secret Scrubbing & Privacy Guarantees
All logging sinks (SQLite `logs` table, stdout, and file logs) pass through `ReportSanitizer` and `redactSecretsInString`:
- **API Keys**: Pattern matching for `sk-ant-*`, `sk-*`, `AIzaSy*` replaces tokens with `[REDACTED_API_KEY]`.
- **Authorization Headers**: `Bearer *` replaced with `Bearer [REDACTED]`.
- **Credentials & Passwords**: Connection strings with passwords (e.g. `postgres://user:pass@host`) are automatically masked.

---

## 5. Troubleshooting Playbook

### Issue 1: Database Locked (`SQLITE_BUSY`)
- **Symptom**: CLI throws `DatabaseError: database is locked` or hangs during writes.
- **Root Cause**: Another process holds an open exclusive write lock without committing, or previous process terminated uncleanly.
- **Resolution**:
  1. Check for dangling Bun processes:
     ```bash
     ps aux | grep bun
     ```
  2. Kill abandoned processes:
     ```bash
     kill -9 <pid>
     ```
  3. Ensure WAL mode is active:
     ```bash
     sqlite3 ~/.terrarium/terrarium.db "PRAGMA journal_mode=WAL;"
     ```

### Issue 2: External Call Rejected (`PROVIDER_UNAUTHORIZED_CALL_ERROR`)
- **Symptom**: Task fails with `ProviderUnauthorizedCallError: External network call to provider 'anthropic' is disallowed by current configuration`.
- **Root Cause**: Safety default prevents unauthorized network egress. Cloud model calls require explicit opt-in.
- **Resolution**:
  1. Check `.env` configuration.
  2. Set `TERRARIUM_ALLOW_EXTERNAL_CALLS=true` in `.env` or pass programmatic override:
     ```bash
     TERRARIUM_ALLOW_EXTERNAL_CALLS=true bun run cli
     ```
  3. Alternatively, switch to local offline inference via Ollama (`http://localhost:11434`) which requires no external network egress.

### Issue 3: Approval Gate Blocking Pipeline (`APPROVAL_REQUIRED`)
- **Symptom**: Task hangs at `waiting_for_approval` or workflow status is `blocked`.
- **Root Cause**: The planned step performs a consequential action (code file modification, database alteration, package installation, or budget override).
- **Resolution**:
  1. Inspect pending approval requests:
     ```bash
     bun run --cwd apps/cli start -- approval list --pending
     ```
  2. Review description and payload hash, then approve or reject:
     ```bash
     bun run --cwd apps/cli start -- approval decide <approval-id> --approve
     ```
  3. In automated tests or CI, pass `--auto-approve` to bypass manual confirmation for non-destructive operations.

### Issue 4: Budget Limit Exceeded (`BUDGET_EXCEEDED`)
- **Symptom**: Workflow halts with `SpendLimitExceededError: Budget spend limit exceeded`.
- **Root Cause**: Task token accumulation exceeded `budgetCapUsd` or default threshold ($10.00).
- **Resolution**:
  1. Inspect task spend via CLI:
     ```bash
     bun run --cwd apps/cli start -- budget status
     ```
  2. Increase spend ceiling for the specific task:
     ```bash
     bun run --cwd apps/cli start -- workflow run "<prompt>" --budget 25.0
     ```

### Issue 5: Local Ollama Connection Refused (`ECONNREFUSED 127.0.0.1:11434`)
- **Symptom**: Diagnostics report `OLLAMA: UNREACHABLE`.
- **Root Cause**: The local Ollama daemon is not running on port 11434.
- **Resolution**:
  1. Start the Ollama background daemon:
     ```bash
     ollama serve
     ```
  2. Pull the default offline model:
     ```bash
     ollama pull llama3.2:latest
     ```
  3. Verify probe:
     ```bash
     bun run --cwd apps/cli start -- provider test ollama
     ```

### Issue 6: Sandbox Containment Violation (`SANDBOX_VIOLATION`)
- **Symptom**: Engineering Studio or Tool execution rejects file path with `Path escapes workspace root directory`.
- **Root Cause**: An agent attempted to read, write, or diff a file outside `workspaceRoot` (e.g. `../../etc/passwd` or `/tmp/secret`).
- **Resolution**:
  - This is an intentional security guard. Ensure tasks specify relative paths located strictly within the active repository tree.
