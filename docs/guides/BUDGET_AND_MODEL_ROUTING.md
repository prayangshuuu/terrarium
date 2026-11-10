# Terrarium Architecture Guide: Budget, Bounds Enforcement, and Model Routing

## 1. Overview and Core Principles

Terrarium treats compute resources, token budgets, and dollar spend as first-class constraints rather than afterthoughts. In distributed multi-agent systems, unconstrained loops, unbounded retries, runaway debate rounds, and unbounded concurrency can rapidly deplete token quotas and incur catastrophic cloud provider costs.

This architecture satisfies the requirements in **PLAN.md Section 12 (Model Routing)** and **Section 13 (Token, Cost, & Performance Management)**:
1. **Scopes of Budgeting**: Budgets operate at `task`, `project`, and `agent` scopes.
2. **Bounds Enforcement**: Hard bounds govern duration, concurrency slots, debate rounds, retry attempts, and delegation depth.
3. **Concurrency-Safe Reservations**: Agents reserve estimated token and spend slices atomically before invocation to eliminate parallel overspending races.
4. **Intelligent Model Routing**: Dynamic tier selection (`fast`, `standard`, `advanced`) based on task complexity, risk severity, required capabilities, and budget headroom.
5. **Graceful Degradation**: Constrained budgets automatically downgrade model tiers while recording transparent rationales and fallback flags.
6. **Approval Interception**: Exceeded budgets trigger interactive human approval (`pause_and_request_approval` with `budget_override`) rather than abrupt crashes.
7. **Transparent Estimation**: Token spend figures are strictly demarcated with `isEstimate: true` and disclaimed as operational approximations, never mischaracterized as exact provider invoices (PLAN.md Section 13.3).

```
                      ┌────────────────────────────────────────┐
                      │             Task Request               │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │              ModelRouter               │
                      │  • Complexity & Risk Assessment        │
                      │  • Capability Requirements             │
                      │  • Budget Degradation Check            │
                      └──────────────────┬─────────────────────┘
                                         │ RoutingDecision
                                         ▼
                      ┌────────────────────────────────────────┐
                      │             BudgetManager              │
                      │  • Pre-Invocation Reservation          │
                      │  • Bounds & Concurrency Enforcement    │
                      └─────────┬────────────────────┬─────────┘
        [Limit Exceeded]        │                    │ [Normal]
                                ▼                    ▼
                 ┌────────────────────────┐  ┌────────────────────────┐
                 │    ApprovalManager     │  │   Model Invocation     │
                 │ (pause_and_request_appr│  │ (Provider Adapter Run) │
                 └────────────────────────┘  └───────────┬────────────┘
                                                         │ Actual Tokens
                                                         ▼
                                             ┌────────────────────────┐
                                             │      BudgetLedger      │
                                             │  • Settle Reservation  │
                                             │  • Atomic Ledger Debit │
                                             └────────────────────────┘
```

---

## 2. Multi-Scope Budget Ledger & Concurrency Safety

### 2.1 Ledger Schema
The persistence layer (`packages/core/src/persistence/migrations/005_budget_and_model_routing.ts`) introduces three SQLite tables:
- `budget_configs`: Configured token, spend, concurrency, duration, and debate limits per `(scope, target_id)`.
- `budget_reservations`: In-flight active token reservations with expiration timestamps (`expires_at`), preventing double-spending across parallel agents.
- `budget_ledger`: Immutable audit trail of committed token usage and USD spend tagged with `is_estimate`.

### 2.2 Concurrency Lock
The `BudgetLedger` (`packages/core/src/budget/budget-ledger.ts`) utilizes an asynchronous lock queue (`withLock`) to guarantee that concurrent reservation checks and commits execute serially without data races. Stale reservations past their `expires_at` TTL are automatically expired during summary calculation.

---

## 3. Operational Bounds Enforcer

The `BoundsEnforcer` (`packages/core/src/budget/bounds-enforcer.ts`) enforces strict operational limits to guarantee predictable multi-agent runtime behavior:

| Bound | Contract Limit | Violation Error | Purpose |
| :--- | :--- | :--- | :--- |
| **Max Concurrency** | Configurable slots (default 5) | `ConcurrencyLimitExceededError` | Prevents local CPU/network overload and provider 429 rate limits |
| **Max Duration** | Configurable ms (default 300s) | `DurationLimitExceededError` | Halts runaway step execution and hanging provider calls |
| **Max Retries** | Max 3 attempts | `TerrariumError(BUDGET_EXCEEDED)` | Prevents retry storms upon permanent provider outage |
| **Max Debate Rounds** | Max 3 rounds | `TerrariumError(BUDGET_EXCEEDED)` | Eliminates endless circular arguments between critic personas |
| **Max Delegation Depth** | Max 3 levels | `DelegationDepthExceededError` | Prevents runaway tree recursion across sub-agents |

---

## 4. Intelligent Model Routing & Graceful Degradation

The `ModelRouter` (`packages/core/src/routing/model-router.ts`) selects model providers and tiers according to deterministic business rules:

```typescript
// 1. Determine baseline tier from complexity and risk
if (complexity === "low" && (riskLevel === "read_only" || riskLevel === "low")) {
  targetTier = "fast";     // e.g. gpt-4o-mini, gemini-1.5-flash
} else if (complexity === "high" || riskLevel === "high" || riskLevel === "critical") {
  targetTier = "advanced"; // e.g. o1, claude-3-opus
} else {
  targetTier = "standard"; // e.g. gpt-4o, claude-3-5-sonnet
}

// 2. Evaluate budget constraints for graceful degradation
if (remainingSpendUsd < 0.05 && targetTier === "advanced") {
  targetTier = "standard";
  isFallback = true;
}
if (remainingSpendUsd < 0.01 && targetTier !== "fast") {
  targetTier = "fast";
  isFallback = true;
}
```

Every decision returns transparent rationales, capability tags, and cost estimates. When degradation occurs, `isFallback` is set to `true` and the rationale details the financial driver for the downgrade.

---

## 5. Limit Actions & Human Approval Gate

When an agent's token reservation or spend exceeds configured limits:
1. If `onLimitExceeded: "stop"`, the runtime returns `BudgetExhaustedError` and terminates the step.
2. If `onLimitExceeded: "pause_and_request_approval"`, `BudgetManager` halts the operation and dispatches an approval request to `ApprovalManager` under action type `budget_override` (risk level: `high`).
3. An inspectable approval card is presented to the user. If approved by the operator, execution resumes with augmented limits.

---

## 6. OpenTUI Terminal Experience & CLI Handlers

Contributed by **A4 (CLI/TUI Designer)** and **A5 (Product Interface Designer)**:

### 6.1 `terrarium budget show <scope> <targetId>`
Renders an ASCII terminal card featuring dual utilization meters:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 💰 BUDGET & RESOURCE LIMITS                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Scope:       TASK                                                          │
│ Target ID:   task-100                                                      │
│ Status:      ✅ NORMAL                                                     │
│ Checked At:  2026-11-08T07:20:00.000Z                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 📊 TOKEN UTILIZATION:                                                       │
│   [████████------------] 40% (20,000 / 50,000 tokens)                      │
│   • Used: 15,000 tokens | Reserved: 5,000 tokens                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 💵 ESTIMATED SPEND:                                                         │
│   [████----------------] 20% ($0.4000 / $2.00 USD)*                        │
│   • Used: $0.3000 | Reserved: $0.1000                                      │
│   * Estimates are operational approximations, not exact provider invoices. │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⚙️  OPERATIONAL BOUNDS & POLICIES:                                            │
│   • Active Concurrency: 0 / 3 slots                                        │
│   • Max Duration: 120s                                                     │
│   • On Limit Action: PAUSE_AND_REQUEST_APPROVAL                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 `terrarium model route`
Displays the model routing rationale:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🧭 MODEL ROUTING DECISION                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Model:       openai/gpt-4o-mini                                             │
│ Tier:        ⚡ FAST                                                        │
│ Fallback:    ✅ NO (Optimal Selection)                                     │
│ Est. Rate:   $0.000750 / 1k tokens (estimate)*                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 💡 TRANSPARENT RATIONALE:                                                   │
│   Selected openai/gpt-4o-mini (fast tier) for low complexity and low risk. │
│   * Estimates are operational approximations, not exact provider invoices. │
└─────────────────────────────────────────────────────────────────────────────┘
```
