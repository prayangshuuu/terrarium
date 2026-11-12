# TERRARIUM — Engineering Studio & Safe Code Workflows

> **Role**: AI Runtime & Security Operations Lead (A2 & A3 Lead).  
> **Status**: Comprehensive guide covering repository analysis, sandboxed diff review, bounded test runner, and atomic patch lifecycles.

---

## 1. Overview & Purpose

The **Engineering Studio** (accessible via OpenTUI Workspace 7 or `terrarium studio` CLI commands) provides a secure, sandboxed environment where AI agents can inspect codebases, generate proposed modifications as unified diffs, run tests within strict boundaries, and apply atomic patches under human supervision.

In strict alignment with `PLAN.md` Section 7 and `PLAN_CONTEXT.md` Section 7:
- **Agents NEVER write directly to production branches or primary source files without authorization.**
- **Code modifications are structured as inspectable Unified Diffs.**
- **Every proposed patch must pass a bounded test runner check before approval.**

---

## 2. Code Security Sandbox Boundaries

The `CodeSecuritySandbox` enforces rigorous boundaries on all file operations initiated by agents:

```text
┌────────────────────────────────────────────────────────┐
│                   Active Repository Root               │
│  (workspaceRoot / process.cwd())                       │
│                                                        │
│  ┌─────────────────────────┐  ┌──────────────────────┐ │
│  │ Allowed Workspace Files │  │ Sensitive Protected  │ │
│  │ packages/*, apps/*, src │  │ .env, .git, keys     │ │
│  │ (Read, Diff, Patch OK)  │  │ (BLOCKED)            │ │
│  └─────────────────────────┘  └──────────────────────┘ │
└───────────────────────────┬────────────────────────────┘
                            │
               ┌────────────┴────────────┐
               │ Traversal Blocked (../) │
               │ /etc/passwd, /tmp       │
               │ (SANDBOX VIOLATION)     │
               └─────────────────────────┘
```

### Security Rules
1. **Path Traversal Guard**:
   - Any path resolving outside `workspaceRoot` throws `SandboxViolationError`.
   - Null-byte injection (`\0`) and path traversal sequences (`../`, `..\`) are detected and blocked.
2. **Sensitive File Protection**:
   - Files matching protected patterns (`.env*`, `.git/*`, `id_rsa*`, `*.pem`, `*.key`) are completely blocked from automated modification or external export.
3. **Execution Isolation**:
   - Subprocess executions (`ClaudeCodeCliAdapter` and `BoundedCoordinator`) run with constrained working directories and inherited sanitized environment variables without credential leakage.

---

## 3. Unified Diff Engine & Patch Lifecycle

Proposed code modifications are managed through the `PatchManager` state machine:

```text
                      ┌───────────────┐
                      │     draft     │
                      └───────┬───────┘
                              │
                              ▼
                      ┌───────────────┐
                      │pending_review │
                      └───────┬───────┘
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
  │   approved    │   │   rejected    │   │    expired    │
  └───────┬───────┘   └───────────────┘   └───────────────┘
          │
          ▼
  ┌───────────────┐
  │    applied    │
  └───────┬───────┘
          │
          ▼
  ┌───────────────┐
  │  rolled_back  │
  └───────────────┘
```

### Patch Verification
- **Unified Diff Standard**: Diffs conform to standard unified diff format with 3 lines of contextual padding.
- **SHA-256 Hashing**: Each patch is hashed upon generation. Before applying, the target file's current checksum is verified to prevent applying patches against stale code (conflict prevention).
- **Atomic Rollback**: When a patch is applied, a backup snapshot of the modified files is stored in `~/.terrarium/patches/backups/`. Running `terrarium studio patch rollback <patch-id>` restores files to their exact prior state.

---

## 4. Bounded Test Runner

Before applying code changes, the Engineering Studio executes test suites through a sandboxed runner:

### Execution Controls
- **Strict Timeout**: Defaults to 30,000ms. If tests hang or loop indefinitely, the child process is terminated with SIGTERM, followed by SIGKILL.
- **Output Truncation**: Excessively verbose test output is capped at 500 lines to prevent terminal buffer flooding.
- **Structured Exit Records**: Captures exit codes, duration, passed/failed test counts, and stack traces.

---

## 5. CLI Studio Commands

```bash
# 1. Analyze repository structure, languages, entrypoints, and sensitive files
terrarium studio scan

# 2. Run bounded test checks across workspace
terrarium studio test --timeout 45000

# 3. List generated patches and their current review status
terrarium studio patch list

# 4. Inspect unified diff for a specific patch
terrarium studio patch diff <patch-id>

# 5. Approve and apply an inspected patch
terrarium studio patch apply <patch-id>

# 6. Revert an applied patch cleanly
terrarium studio patch rollback <patch-id>
```
