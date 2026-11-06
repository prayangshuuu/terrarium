# TERRARIUM — Configuration, Environment, and Secrets Guide

This document defines the configuration architecture, environment variables, credential lookup precedence, and secret protection standards for TERRARIUM.

---

## 1. Architectural Principles

TERRARIUM strictly separates configuration into four distinct subsystems:

1. **Machine Paths (`paths`):**
   - Filesystem directories for local SQLite persistence, runtime execution logs, reports, and working tree boundaries.
   - Decoupled from project source code and normalized to absolute filesystem paths at runtime.
2. **Behavioral Preferences (`preferences`):**
   - User choices such as default model tier, default provider, and human approval enforcement modes.
3. **Budget & Execution Limits (`budget`):**
   - Token caps, recursion depth limits, warning thresholds, and task spend ceilings to prevent runaway costs or infinite agent loops.
4. **Provider Settings & Secrets (`providers`):**
   - Endpoints, API keys, and organization identifiers. Credentials are isolated from plain config inspection and automatically redacted in logs and diagnostic outputs.

---

## 2. Credential Lookup Precedence

When initializing the platform or executing an agent task, credentials and environment variables are resolved in the following strict order:

```text
┌────────────────────────────────────────────────────────┐
│ 1. Explicit Programmatic Overrides (CLI / Test input)  │
└───────────────────────────┬────────────────────────────┘
                            │ (if unset)
                            ▼
┌────────────────────────────────────────────────────────┐
│ 2. Process Environment Variables (process.env)         │
└───────────────────────────┬────────────────────────────┘
                            │ (if unset)
                            ▼
┌────────────────────────────────────────────────────────┐
│ 3. Local Workspace .env File (.env in project root)    │
└───────────────────────────┬────────────────────────────┘
                            │ (if unset)
                            ▼
┌────────────────────────────────────────────────────────┐
│ 4. Safe Defaults / Graceful Unconfigured State         │
└────────────────────────────────────────────────────────┘
```

If an external provider (e.g., Anthropic or OpenAI) is requested but unconfigured, TERRARIUM gracefully handles the missing credential rather than crashing, reporting an actionable remediation prompt to the user.

---

## 3. Environment Variable Reference

| Variable | Type | Default | Description |
|---|---|---|---|
| `TERRARIUM_ENV` / `NODE_ENV` | `string` | `development` | App environment: `development`, `test`, `staging`, `production`. |
| `TERRARIUM_APP_NAME` | `string` | `TERRARIUM` | Application name. |
| `TERRARIUM_DEBUG` | `boolean` | `false` (or `true` in dev) | Enable verbose debug logging. |
| `TERRARIUM_PROJECT_ROOT` | `path` | `.` (cwd) | Absolute or relative root directory for the project. |
| `TERRARIUM_DATA_DIR` | `path` | `.terrarium/data` | Local data directory for SQLite database and state. |
| `TERRARIUM_LOG_DIR` | `path` | `.terrarium/logs` | Execution logs and trace outputs. |
| `TERRARIUM_REPORTS_DIR` | `path` | `docs/reports` | Generated Markdown deliverables and audit reports. |
| `TERRARIUM_DB_PATH` | `path` | `<dataDir>/terrarium.sqlite3` | SQLite database file location. |
| `TERRARIUM_DEFAULT_PROVIDER` | `string` | `anthropic` | Default model provider: `anthropic`, `openai`, `gemini`, `ollama`. |
| `TERRARIUM_DEFAULT_MODEL_TIER`| `string` | `standard` | Default model capability tier: `fast`, `standard`, `advanced`. |
| `TERRARIUM_APPROVAL_MODE` | `string` | `consequential_only` | Gate mode: `always`, `consequential_only`, `never`. |
| `TERRARIUM_MAX_TOKENS_PER_TURN` | `number` | `8192` | Hard token limit per model generation turn. |
| `TERRARIUM_MAX_DELEGATION_DEPTH`| `number` | `3` | Maximum recursive delegation depth between agents (0-10). |
| `TERRARIUM_WARNING_THRESHOLD_PERCENT` | `number` | `80` | Percentage of budget consumed before triggering a warning (1-100). |
| `TERRARIUM_DEFAULT_TASK_BUDGET_USD` | `number` | `0.50` | Default per-task spend ceiling in USD. |
| `ANTHROPIC_API_KEY` | `secret` | `undefined` | Anthropic Claude API key (`sk-ant-...`). |
| `OPENAI_API_KEY` | `secret` | `undefined` | OpenAI API key (`sk-...`). |
| `GEMINI_API_KEY` | `secret` | `undefined` | Google AI Studio Gemini API key (`AIzaSy...`). |
| `OLLAMA_HOST` | `url` | `http://localhost:11434` | Local Ollama endpoint. |

---

## 4. Local Quick Start

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Add desired provider keys:**
   Open `.env` in your editor and provide your keys. For zero-cost local development without API keys, leave keys blank and use Ollama:
   ```env
   TERRARIUM_DEFAULT_PROVIDER=ollama
   OLLAMA_HOST=http://localhost:11434
   ```

3. **Verify configuration loading:**
   ```bash
   bun test
   ```

---

## 5. Secret Protection and Diagnostic Redaction

In accordance with `PLAN_CONTEXT.md` Section 7 and `PLAN.md` Section 17:
- **Keys are never logged:** Any key name containing `key`, `secret`, `token`, `password`, `credential`, or `auth` is masked automatically.
- **Pattern scrubbing:** String values matching known token signatures (`sk-...`, `sk-ant-...`, `AIzaSy...`, `ghp_...`, Bearer tokens, and JWTs) are scrubbed before printing to the terminal, logs, or reports.
- **Serialized objects:** Calling `config.toJSON()` defaults to `redact = true`, producing safe diagnostics without leaking credentials across IPC or UI layers.
