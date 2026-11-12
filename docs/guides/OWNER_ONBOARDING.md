# TERRARIUM — Owner Onboarding & First-Run Guide

> **Audience**: Platform Owners, Lead Architects, and Systems Operators.  
> **Purpose**: End-to-end walkthrough for installing, configuring, exploring the OpenTUI terminal shell, and running multi-agent workflows.

---

## 1. Welcome to TERRARIUM

TERRARIUM coordinates an on-demand virtual organization of specialized AI agents to inspect, evaluate, plan, implement, review, test, and improve software codebases.

Execution is strictly **demand-driven**:
- Agents do not sit in memory as idle processes.
- They are selected dynamically based on task requirements, risk profile, and budget.
- Consequential actions require explicit human approval before files are touched.

---

## 2. Quick Setup & First Launch

### Step 1: Clone & Install Dependencies
Ensure you have [Bun](https://bun.sh/) `v1.3.14` or higher installed:
```bash
git clone <private-repo-url> terrarium
cd terrarium
bun install
```

### Step 2: Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```
Open `.env` to review operational paths and provider settings.  
> [!NOTE]
> All external model calls default to disabled (`allowExternalCalls=false`). You can immediately run and test the platform offline using built-in mock models or local Ollama without configuring any paid API keys.

### Step 3: Run Verification Checks
Execute the automated test and typecheck suites to ensure environment integrity:
```bash
bun run typecheck
bun test
```
All tests should pass cleanly (572+ tests across 76 files).

### Step 4: Launch the OpenTUI Terminal Shell
Launch the interactive terminal application:
```bash
bun run cli
```

---

## 3. Interactive OpenTUI Workspace Tour

The TERRARIUM OpenTUI shell provides 10 dedicated workspaces accessible via single-key numeric shortcuts:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ◈ TERRARIUM v0.1.0        Workspace: Overview [1]         Project: default [DEV] ●    │
├────────────────────────────┬───────────────────────────────────────────────────────────┤
│  ▸ [1] Overview            │  System health, active tasks, budget spend, activity feed │
│    [2] Agent Ecosystem     │  Virtual organization directory across 10 departments     │
│    [3] Task Manager        │  DAG execution steps, status transitions, state machines  │
│    [4] Conversations       │  Cross-agent debates, perspective synthesis, transcripts  │
│    [5] Tools & Approvals   │  Sandboxed tools, permission matrix, approval gates       │
│    [6] Project Memory      │  Durable decisions, conflict detection, context assembler │
│    [7] Engineering Studio  │  Repository analyzer, diff review, bounded test runner    │
│    [8] Reports & Evidence  │  Evidence provenance, synthetic personas, Markdown export │
│    [9] Budget & Routing    │  Spend caps, model tier distribution, token telemetry     │
│    [0] Settings            │  Provider adapters, CLI runners, rankings, diagnostics    │
└────────────────────────────┴───────────────────────────────────────────────────────────┘
```

### [1] Workspace 1 — System Overview
- **Header KPI Cards**: Active executions, queued tasks, total spend vs. budget cap, registered profiles.
- **Activity Feed**: Live event stream with sequence numbers, event levels, and missed-event replay.
- **Quick Actions**: Press `[c]` to create a new task, `[Ctrl+K]` to open the Command Palette.

### [2] Workspace 2 — Agent Ecosystem & Virtual Organization
- **Department Tabs**: Cycle through 10 canonical departments (`engineering`, `product`, `security`, `architecture`, `customer_intelligence`, etc.).
- **Profile Inspector**: View agent capabilities, role descriptions, operational risk limits, and permission scopes.
- **Demand-Based Indicator**: Unactivated profiles are labeled `IDLE (ON-DEMAND)`.

### [3] Workspace 3 — Task Manager & Execution Lifecycle
- **Task DAG View**: Inspect execution steps, dependency order (`dependsOn`), and duration estimates.
- **State Machine Badges**: Real-time visualization of task lifecycles (`draft -> planned -> running -> waiting_for_approval -> completed`).
- **Inspection Modal**: Press `[Enter]` on any task to view input prompts, classification metadata, and execution logs.

### [4] Workspace 4 — Conversations & Agent Debates
- **Perspective Synthesis**: View structured debates between differing specialist personas (e.g. Performance vs. Maintainability).
- **Preserved Disagreements**: Direct inspection of acknowledged trade-offs without manufactured consensus.

### [5] Workspace 5 — Tools & Consequential Approvals
- **Tool Sandbox**: Registry of registered capabilities with input schemas, category, and risk level.
- **Approval Gate Queue**: Pending human authorizations for file writes, destructive operations, or budget overrides.
- **Decision Actions**: Press `[a]` to approve with operator sign-off, or `[r]` to reject.

### [6] Workspace 6 — Project Memory & Knowledge
- **Durable Decisions**: Sourced project facts and architectural decisions with date, owner, and confidence score.
- **Conflict Detection**: Automated detection when a proposed change contradicts durable project memory.

### [7] Workspace 7 — Engineering Studio & Safe Code
- **Repository Tree Scan**: Press `[s]` to analyze codebase structure, detected languages, and sensitive files.
- **Unified Diff Inspector**: Colorized visual inspection of agent-proposed file modifications.
- **Bounded Test Runner**: Press `[t]` to run unit and regression checks in a sandboxed child process with strict timeouts.
- **Patch Management**: Apply approved patches or press `[u]` to roll back cleanly.

### [8] Workspace 8 — Reports & Evidence
- **Structured Findings**: Categorized findings with severity ratings (Critical, High, Medium, Low, Info).
- **Evidence Provenance**: Verified facts linked to checksummed files or test outputs.
- **Synthetic Customer Feedback**: Simulated persona reactions with mandatory synthetic disclaimers.
- **Export**: Press `[e]` to export full GitHub-flavored Markdown reports.

### [9] Workspace 9 — Budget, Routing & Telemetry
- **Model Tiers**: Fast (Tier 1), Standard (Tier 2), and Advanced (Tier 3) routing policies.
- **Token Telemetry**: Prompt vs. completion token breakdown and real-time cost estimation.

### [10] Workspace 10 — Settings & Specialist Providers
- **Provider Adapters**: Health probes for Anthropic, Ollama, OpenAI, Google Gemini, and Claude Code CLI.
- **Priority Rankings Matrix**: Evaluated matrix ranking candidate providers by user value, risk, and maintenance overhead.
- **Connection Diagnostics**: Press `[t]` to test local loopback and configured credentials safely.

---

## 4. Keyboard Navigation Cheat Sheet

| Keybinding | Scope | Description |
|:---|:---:|:---|
| `1` – `9` | Global | Direct jump to Workspaces 1 through 9 |
| `0` | Global | Direct jump to Workspace 10 (Settings) |
| `Ctrl+K` or `/` | Global | Open Command Palette with fuzzy action search |
| `Esc` or `b` | Global | Dismiss modal or navigate back in workspace history |
| `?` | Global | Open Keyboard Help overlay |
| `q` or `Ctrl+C` | Global | Gracefully terminate shell and shut down database cleanly |
| `Tab` / `Shift+Tab` | Viewport | Cycle through sub-tabs in active workspace |
| `↑` / `↓` or `k` / `j` | Lists/Tables | Navigate items and rows |
| `Enter` | Lists/Tables | Select or inspect highlighted item |

---

## 5. Non-Interactive CLI & Scripting Modes

TERRARIUM commands can be integrated into build pipelines, CI checks, or shell scripts:

```bash
# 1. Run an end-to-end workflow and capture output
bun run --cwd apps/cli start -- workflow run "Verify authentication contracts" --json

# 2. Inspect plan DAG before committing to execution
bun run --cwd apps/cli start -- task plan "Refactor database migrations"

# 3. List pending human approval requests
bun run --cwd apps/cli start -- approval list --pending

# 4. Generate and export a comprehensive architecture review report
bun run --cwd apps/cli start -- report generate --task task_12345 --type architecture_review

# 5. Test provider connections
bun run --cwd apps/cli start -- provider test ollama
```

---

## 6. Next Steps

- Consult [Operations & Maintenance Guide](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/OPERATIONS_AND_MAINTENANCE.md) for data paths, backup procedures, and troubleshooting.
- Read [Architecture & Subsystem Scenarios](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/ARCHITECTURE_AND_SUBSYSTEMS.md) for core contracts and state machines.
- Review [Specialist Integrations](file:///Users/prayangshuuu/Desktop/terrarium/docs/INTEGRATIONS.md) for enabling private local Ollama or cloud providers.
