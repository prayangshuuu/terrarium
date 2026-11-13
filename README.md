# TERRARIUM

> **Private & Confidential** — On-demand, multi-agent AI orchestration and software engineering platform.  
> *Strictly for authorized internal development. Do not publish, redistribute, or deploy externally without explicit approval.*

---

## 1. Executive Overview

**TERRARIUM** is a high-performance, demand-driven multi-agent orchestration platform designed to help software engineering organizations evaluate, plan, build, review, test, and improve software products.

Unlike daemon-heavy agent frameworks that keep dozens of background processes running continuously, TERRARIUM operates on a **demand-based activation model**:
- **Zero Idle Resource Drain**: Virtual organization agent profiles are inexpensive metadata definitions until selected for a specific objective.
- **Bounded Autonomous Execution**: Every task runs with strict ceilings on delegation depth, concurrent tasks, execution timeouts, token usage, and budget spend.
- **Human Authorization Gates**: Consequential actions (code mutation, database altering, external publishing, package installation) halt for human review unless explicitly authorized.
- **Durable Local Persistence**: Complete task lifecycles, plans, approvals, artifacts, and synthesized reports are persisted locally via SQLite.
- **Full Provenance & Epistemic Humility**: Synthesized reports strictly separate verified facts, generated analyses, unverified assumptions, and simulated customer feedback with mandatory synthetic research disclaimers.

---

## 2. System Prerequisites & Quick Start

### Prerequisites
- **Runtime**: [Bun](https://bun.sh/) `v1.3.14` or later.
- **Operating System**: macOS (Apple Silicon or Intel) or Linux (x86_64 or aarch64).
- **Optional Specialist CLI**: [Claude Code](https://claude.ai/code) (for sandboxed subprocess runner).
- **Optional Local LLM**: [Ollama](https://ollama.com/) (for 100% private, air-gapped offline inference).

### Installation & First Run

1. **Clone and Install Dependencies**:
   ```bash
   cd terrarium
   bun install
   ```

2. **Initialize Environment Configuration**:
   ```bash
   cp .env.example .env
   ```
   *(By default, all external network egress is disabled (`allowExternalCalls=false`). Local mock adapters and offline Ollama run out of the box with zero external credentials).*

3. **Verify Installation & Run Self-Checks**:
   ```bash
   bun run typecheck
   bun test
   ```

4. **Launch Interactive OpenTUI Terminal Shell**:
   ```bash
   bun run cli
   ```

5. **Execute a Non-Interactive Workflow (CI / Scripting Mode)**:
   ```bash
   bun run --cwd apps/cli start -- workflow run "Conduct architectural inspection of packages/core"
   ```

---

## 3. Monorepo Architecture

The repository is organized as a unified Bun workspace comprising four isolated packages:

```text
terrarium/
├── packages/
│   ├── contracts/   # Pure TypeScript domain models, schemas, and state machines (Zero external deps)
│   ├── config/      # Configuration loading, environment resolution, and secret redaction
│   └── core/        # Orchestration engine, SQLite storage, provider runtime, and workflow pipeline
├── apps/
│   └── cli/         # OpenTUI terminal shell (Workspaces 1-10) and traditional CLI commands
└── docs/
    ├── guides/      # In-depth architectural and operational documentation
    └── architecture/# Formal domain boundaries and entity-relationship models
```

### Package Summary

| Package | Role | Key Dependencies | Invariants |
|:---|:---|:---|:---|
| `@terrarium/contracts` | Domain Contracts | None | Zero runtime dependencies; pure TypeScript types, validators, and error codes. |
| `@terrarium/config` | Environment & Config | `@terrarium/contracts` | Automatic credential isolation; sensitive token redaction; priority resolution. |
| `@terrarium/core` | Engine & Orchestration | `contracts`, `config`, `bun:sqlite` | Demand-based profile selection; bounded coordinator; provenance hashing. |
| `terrarium-cli` | Presentation Shell | `@opentui/core`, `@opentui/react`, `core` | High-contrast restrained tokens; 10 workspace views; dual TUI/headless modes. |

---

## 4. Feature Maturity Matrix

In compliance with project auditing standards, every subsystem in TERRARIUM is labeled with its current implementation status:

| Subsystem / Feature | Status | Notes |
|:---|:---:|:---|
| **Demand-Based Profile Selection** | `[IMPLEMENTED]` | Deterministic matching against required capabilities, department, and risk. |
| **Bounded Orchestration Coordinator** | `[IMPLEMENTED]` | Hard bounds on concurrency, delegation depth, timeouts, and spend. |
| **Task Intake & Plan Generation** | `[IMPLEMENTED]` | Classifies task types, scores risk/uncertainty, and outputs inspectable DAG steps. |
| **Consequential Action Approval Gates** | `[IMPLEMENTED]` | SHA-256 tamper-proof payload hashing; human approval lifecycle. |
| **SQLite Persistence & Migrations** | `[IMPLEMENTED]` | Foreign keys, WAL journaling, transaction wrappers, and versioned migrations. |
| **Tool Registry & Security Shield** | `[IMPLEMENTED]` | Declarative schemas, permission enforcement, and path traversal guards. |
| **Project Memory & Context Assembler** | `[IMPLEMENTED]` | Durable decision tracking, conflict detection, and token-capped prompt assembly. |
| **Budget Manager & Model Router** | `[IMPLEMENTED]` | Token reservations, multi-tier cost tracking, and tier fallback policies. |
| **Observability, Logs & Events** | `[IMPLEMENTED]` | Structured audit trails, sequence numbers, and missed-event replay. |
| **OpenTUI Shell (Workspaces 1–10)** | `[IMPLEMENTED]` | Interactive full-screen terminal interface built with `@opentui/react`. |
| **Engineering Studio & Diff Engine** | `[IMPLEMENTED]` | Workspace file analysis, unified diff inspector, and sandboxed test runner. |
| **Report Generation & Provenance** | `[IMPLEMENTED]` | Evidence classification, disagreement preservation, and Markdown export. |
| **Synthetic Customer Simulation** | `[IMPLEMENTED]` | Persona-based feedback exploration with mandatory simulation disclaimers. |
| **Specialist Provider Adapters** | `[IMPLEMENTED]` | Anthropic (Tier 1), Ollama (Offline Tier 1), OpenAI (Tier 1), Gemini (Tier 2). |
| **Precision Terminal Design System & Geometry** | `[IMPLEMENTED]` | Responsive box engine (compact, standard, wide, ultra-wide) with zero overflow. |
| **Unified Multi-Provider Coding Agent CLI** | `[IMPLEMENTED]` | Unified commands for Claude Code, Antigravity (`agy`), Cursor Agent (`agent`), and Ollama. |
| **First-Class Claude Code Integration** | `[IMPLEMENTED]` | Exact CLI invocation (`bun run terrarium -- claude code`), explicit dangerous-permissions mode, and fail-closed isolation gate. |
| **700+ Agent Profile Ecosystem** | `[IMPLEMENTED]` | 750+ schema-valid profiles across 50 canonical domains, zero duplicates, rich metadata, 100% zero emojis. |
| **Experimental Coding Agent Bridges** | `[EXPERIMENTAL]` | Native Linux namespace/bwrap containers and secondary coding agent bridges. |
| **Multi-Node Distributed Clustering** | `[PLANNED]` | Local single-node multi-process supported; distributed cluster planned for v2. |
| **Web Studio GUI** | `[PLANNED]` | Terminal TUI implemented; future web UI will consume identical `@terrarium/core` state. |

---

## 5. CLI Command Reference

TERRARIUM provides full-screen TUI views, scriptable command-line utilities, and first-class coding-agent process execution:

```bash
# Unified Multi-Provider Coding Agent Execution (Prompt 24 & Prompt 25)
bun run terrarium -- claude code                     # Claude Code in standard mode (prompts preserved)
bun run terrarium -- claude code --dangerously-skip-permissions --yes  # Dangerous mode with verified isolation
bun run terrarium -- agy [options]                   # Google Antigravity CLI launcher
bun run terrarium -- agent [options]                 # Cursor Agent CLI launcher
bun run terrarium --ollama <model>                   # Local offline model execution via Ollama
bun run terrarium -- ollama <model>                  # Alternative syntax for Ollama runner
bun run terrarium -- help                            # Terrarium unified CLI launcher help

# Workflow Execution
terrarium workflow run <prompt> [--auto-approve] [--budget <usd>] [--json]
terrarium workflow resume <workflow-id> [--approve | --reject]
terrarium workflow status <workflow-id>
terrarium workflow list

# Tasks & Planning
terrarium task plan <prompt> [--json]
terrarium task list [--status <status>]
terrarium task inspect <task-id>

# Virtual Organization & Agents
terrarium agent list [--department <dept>]
terrarium agent inspect <agent-slug>
terrarium agent seed

# Providers & Integrations
terrarium provider list
terrarium provider test <provider-id>
terrarium provider rankings
terrarium provider info <provider-id>

# Tools & Approvals
terrarium tool list
terrarium approval list [--pending]
terrarium approval decide <id> --approve|--reject

# Memory & Context
terrarium memory list [--category <cat>]
terrarium context assemble --task <id> --agent <slug>

# Engineering Studio & Safe Code
terrarium studio scan
terrarium studio test [--timeout <ms>]
terrarium studio patch list

# Reports & Deliverables
terrarium report generate --task <task-id> [--type <report-type>]
terrarium report list
terrarium report view <report-id>
```

---

## 6. Complete Documentation Index

For exhaustive operational and technical details, consult the guides in `docs/guides/`:

- [Owner Onboarding & Interactive Tour](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/OWNER_ONBOARDING.md) — Step-by-step first-run guide and OpenTUI workspace navigation.
- [Operations, Maintenance & Troubleshooting](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/OPERATIONS_AND_MAINTENANCE.md) — Data paths, backup/restore, reset procedures, and troubleshooting playbook.
- [Architecture & Subsystem Scenarios](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/ARCHITECTURE_AND_SUBSYSTEMS.md) — Domain boundaries, state machines, and demand-based activation invariants.
- [Specialist Integrations & Provider Adapters](file:///Users/prayangshuuu/Desktop/terrarium/docs/INTEGRATIONS.md) — Evaluated rankings, credential isolation, and offline Ollama setup.
- [Engineering Studio & Safe Code Workflows](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/ENGINEERING_STUDIO.md) — Sandboxed diff review, patch manager, and bounded test runner.
- [Reports, Evidence & Synthetic Customer Research](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/REPORTS_AND_CUSTOMER_RESEARCH.md) — Provenance tracking and synthetic customer research disclaimers.
- [Configuration, Secrets & Environment Precedence](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/CONFIGURATION_AND_SECRETS.md) — Hierarchy of config resolution and secret scrubbing.
- [OpenTUI Shell & Visual System](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/OPENTUI_SHELL_AND_NAVIGATION.md) — Restrained dark slate visual system and keyboard controls.
- [Task Intake, Planning & DAG Blueprints](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/TASK_INTAKE_AND_PLANNING.md) — Intake normalization, risk scoring, and blueprint generation.
- [Persistence, Migrations & SQLite Schema](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/PERSISTENCE_AND_MIGRATIONS.md) — Database schema, migration runner, and relational tables.
- [Tool Registry & Security Shield](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/TOOL_REGISTRY_AND_APPROVALS.md) — Tool sandboxing, permissions, and approval gates.
- [Project Memory & Context Assembly](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/PROJECT_MEMORY_AND_CONTEXT.md) — Durable decisions, conflict detection, and prompt packaging.
- [Budget Management & Model Routing](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/BUDGET_AND_MODEL_ROUTING.md) — Multi-tier routing, token reservations, and spend caps.
- [Observability, Telemetry & Audit Logs](file:///Users/prayangshuuu/Desktop/terrarium/docs/guides/OBSERVABILITY_AND_EVENTS.md) — Structured logging, sequence order, and event streams.

---

## 7. Privacy, Security & Disclosures

- **Confidentiality**: All source code, architecture, agent profiles, benchmarks, and internal reports are proprietary and confidential.
- **Data Egress**: Cloud model calls (Anthropic, OpenAI, Google Gemini) are **disabled by default**. They require explicit user opt-in (`allowExternalCalls=true`) and valid credentials.
- **Synthetic Feedback Disclosure**: All simulated customer persona opinions are synthetic exploration hypotheses and must NEVER be treated as real user research or market measurements.
