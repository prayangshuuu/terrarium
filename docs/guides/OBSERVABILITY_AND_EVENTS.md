# Terrarium Architecture Guide: Events, Logs, and Observability

## 1. Overview and Core Principles

Observability and auditability are foundational to Terrarium's design. In autonomous multi-agent environments, human operators must have complete clarity into what the system did, which agents participated, what tools were executed, what secrets were scrubbed, and what costs were incurred.

This subsystem strictly implements the requirements outlined in **PLAN.md Section 18 (Observability and Auditability)** and **Section 20 (Analytics and Evaluation)**:
1. **Typed Lifecycle Events**: Exhaustive domain events for task, execution, step, tool, approval, usage, memory, and artifact lifecycles.
2. **Distributed Correlation IDs**: Every operation carries a `correlationId` and `traceId`, propagating through asynchronous tasks and sub-agent delegations.
3. **Automatic Secret Redaction**: High-entropy provider API keys (OpenAI, Anthropic, Gemini), Bearer tokens, private RSA keys, and passwords are unconditionally scrubbed before persisting to logs, events, or terminal cards.
4. **Activity vs. Diagnostics Separation**: High-level human activity narratives (milestones) are cleanly decoupled from high-frequency low-level internal diagnostic telemetry.
5. **Statistical Performance Metrics**: Real-time aggregation of latency distributions (p50, p95, p99), success/failure rates, queue delays, transient retries, and token spend.
6. **Telemetry Failure Isolation**: Logging or telemetry sink failures (e.g. database write errors, throwing subscribers) are isolated and **never abort core orchestrator execution or corrupt database state**.
7. **Automated Retention Management**: Configurable time-based and count-based retention policies automatically prune stale audit data without compromising active executions.

```
                      ┌────────────────────────────────────────┐
                      │        Core Orchestrator Task          │
                      └──────────────────┬─────────────────────┘
                                         │ CorrelationContext (ALS)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │            TelemetryManager            │
                      ├──────────────────┬─────────────────────┤
                      │  SecretRedactor  │   MetricsCollector  │
                      └─────────┬────────┴──────────┬──────────┘
       [Failure Isolated]       │                   │
                ┌───────────────┴──────────────┐    │
                ▼                              ▼    ▼
     ┌─────────────────────┐       ┌───────────────────────┐
     │  SqliteLogRepository│       │     ActivityFeed      │
     │  • structured_logs  │       │ (User-visible events) │
     │  • domain_events    │       └───────────┬───────────┘
     └──────────┬──────────┘                   │
                │                              ▼
                ▼                  ┌───────────────────────┐
     ┌─────────────────────┐       │     OpenTUI & CLI     │
     │  RetentionCleaner   │       │ • Timeline view       │
     │  (Prune stale rows) │       │ • Metrics summary     │
     └─────────────────────┘       │ • Structured logs     │
                                   └───────────────────────┘
```

---

## 2. Typed Domain Event Lifecycles

Terrarium captures structured `DomainEvent` entities across seven distinct lifecycle phases:

| Lifecycle | Event Types | Entity Type | Purpose |
| :--- | :--- | :--- | :--- |
| **Task** | `task:created`, `task:status_changed`, `task:completed`, `task:failed`, `task:cancelled` | `Task` | Top-level user goal progression |
| **Execution** | `execution:queued`, `execution:started`, `execution:completed`, `execution:failed`, `execution:cancelled`, `execution:retrying` | `Execution` | Concrete runner attempt and retries |
| **Step** | `step:started`, `step:completed`, `step:failed` | `TaskStep` | Agent sub-task work unit |
| **Tool** | `tool:invoked`, `tool:succeeded`, `tool:failed`, `tool:blocked` | `Tool` | Real-world tool execution and policy blocks |
| **Approval** | `approval:requested`, `approval:resolved`, `approval:approved`, `approval:rejected`, `approval:expired`, `approval:cancelled` | `ApprovalRequest` | Consequential action approval checkpoints |
| **Budget** | `budget:reserved`, `budget:committed`, `budget:released`, `budget:warning`, `budget:exceeded`, `budget:paused_approval` | `Budget` | Token & spend ledger tracking |
| **Artifact** | `artifact:generated`, `artifact:verified`, `artifact:rejected`, `artifact:published` | `Artifact` | Deliverable lifecycle |

---

## 3. Distributed Correlation Context

Distributed correlation context is propagated seamlessly across asynchronous tasks and sub-agent delegations using Node.js/Bun `AsyncLocalStorage`:

```typescript
export interface CorrelationContext {
  readonly correlationId: string; // End-to-end request / user command ID
  readonly traceId: string;       // Distributed trace identifier
  readonly spanId?: string;       // Current operation span
  readonly parentSpanId?: string; // Caller's span ID
  readonly taskId?: string;       // Scoped task
  readonly stepId?: string;       // Scoped step
  readonly agentSlug?: string;    // Executing agent persona
}
```

- `createRootContext(initial)`: Initializes a root context at intake.
- `createChildSpan(parent)`: Creates child spans for steps and tool invocations.
- `runWithContext(context, fn)`: Executes operations within the bound context.
- `getCurrentContext()`: Reads the active context anywhere in the execution graph.

---

## 4. Secret & Sensitive Data Redaction

The `SecretRedactor` (`packages/core/src/observability/secret-redactor.ts`) protects privacy and prevents credential leaks in persistent logs and telemetry:

### 4.1 Automatic Patterns
- **Bearer Tokens**: `Bearer [REDACTED:BEARER_TOKEN]`
- **OpenAI API Keys**: `[REDACTED:OPENAI_KEY]` (e.g. `sk-...`)
- **Anthropic API Keys**: `[REDACTED:ANTHROPIC_KEY]` (e.g. `sk-ant-...`)
- **Google / Gemini API Keys**: `[REDACTED:GEMINI_KEY]` (e.g. `AIza...`)
- **AWS Access Keys**: `[REDACTED:AWS_KEY]` (e.g. `AKIA...`)
- **GitHub Tokens**: `[REDACTED:GITHUB_TOKEN]` (e.g. `ghp_...`)
- **Private Keys**: `[REDACTED:PRIVATE_KEY]` (RSA, EC, OpenSSH)
- **Sensitive Field Names**: Keys named `password`, `apiKey`, `token`, `authorization`, `privateKey`, `cookie` are unconditionally scrubbed to `[REDACTED]`.

---

## 5. Telemetry Failure Isolation Guarantee

A fundamental requirement of Terrarium's observability architecture is that **telemetry failures cannot corrupt or abort core orchestrator state**:

```typescript
// TelemetryManager wraps all database writes, event dispatches, and subscriber callbacks:
try {
  const res = sub(event);
  if (res instanceof Promise) {
    res.catch((err) => console.error("Event subscriber non-fatal error:", err));
  }
} catch (err) {
  console.error("Event subscriber non-fatal synchronous error:", err);
}
```

If an analytics sink goes down, SQLite disk write fails, or an external subscriber throws an uncaught error, the exception is safely absorbed, logged non-fatally, and the core agent workflow proceeds unhindered.

---

## 6. Retention Policy & Automated Cleanup

The `RetentionCleaner` (`packages/core/src/observability/retention-cleaner.ts`) enforces configurable age and volume ceilings to prevent unbounded database bloat:

- `maxLogAgeDays`: Default 30 days.
- `maxEventAgeDays`: Default 90 days.
- `maxLogRecords`: Default 50,000 logs.
- `maxEventRecords`: Default 100,000 events.

Stale records are pruned in atomic SQLite batches without degrading runtime read/write throughput.

---

## 7. OpenTUI Terminal Experience & CLI Handlers

Contributed by **A4 (CLI/TUI Designer)** and **A5 (Product Interface Designer)**:

### 7.1 `terrarium activity`
Displays human-visible milestone narratives:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🛰️  ACTIVITY FEED (HUMAN TIMELINE)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ [12:04:15] ● orchestrator    │ Task initiated: "Deploy Auth Microservice"   │
│ [12:04:16] ▶ lead-architect  │ Step started by lead-architect: "Schema"    │
│ [12:04:18] 🔒 security-guard │ Approval required for production_deploy      │
│ [12:04:22] ✓ operator        │ Approval granted by operator                 │
│ [12:04:25] ✓ lead-architect  │ Step finished by lead-architect              │
│ [12:04:26] ✓ orchestrator    │ Task completed successfully                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 `terrarium metrics`
Displays runtime performance, latency percentiles, and spend:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📈 RUNTIME TELEMETRY & SYSTEM PERFORMANCE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Reporting Window: 2026-11-08T07:00:00 to 2026-11-08T07:30:00                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🎯 SUCCESS RATE:                                                            │
│   [████████████████----] 80% (12 passed / 3 failed)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⏱️  LATENCY DISTRIBUTION (ms):                                               │
│   • Samples: 15 | Avg: 245.3ms | Min: 85ms | Max: 1200ms                    │
│   • Percentiles: p50: 190ms | p95: 850ms | p99: 1150ms                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔄 SCHEDULING & RETRIES:                                                    │
│   • Queue Delay: avg 24.5ms (max 65ms, 15 samples)                          │
│   • Retry Count: 2 transient recovery attempts                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 💰 USAGE & SPEND ACCUMULATION:                                              │
│   • Total Tokens: 42,500 tokens                                             │
│   • Estimated Spend: $0.2450 USD*                                           │
│   * Estimates are operational approximations, not exact provider invoices. │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 `terrarium logs`
Inspects structured audit logs with secret redaction indicators:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📜 STRUCTURED AUDIT LOGS                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 12:04:16 [INFO]  [corr-4a1]   Agent activated for task step execution       │
│ 12:04:18 [WARN]  [corr-4a1] 🔒 Tool invoked with key [REDACTED:OPENAI_KEY] │
│ 12:04:22 [INFO]  [corr-4a1]   Approval granted by operator                  │
└─────────────────────────────────────────────────────────────────────────────┘
```
