# TERRARIUM — Platform Architecture & Subsystem Scenarios

> **Role**: Platform & System Architecture Lead (A1 Lead).  
> **Status**: Comprehensive guide covering domain boundaries, decoupled contracts, state machine specifications, and lifecycle transitions.

---

## 1. Architectural Philosophy

TERRARIUM is architected around a single defining principle:

> **A large virtual organization, activated selectively, coordinated intelligently, and measured by useful outcomes rather than agent count.**

Most traditional multi-agent systems instantiate persistent worker threads or long-lived daemons for each registered persona. In contrast, TERRARIUM treats agent identities as **declarative configuration data**:
1. **On-Demand Activation**: Agent profiles incur zero CPU, memory, or network overhead when idle.
2. **Selective Recruitment**: The orchestrator matches task requirements against candidate capabilities and recruits *only* the minimal specialist set needed.
3. **Execution Decoupling**: Planning never creates runtime execution records; execution records are minted strictly when steps begin.
4. **Deterministic Bounding**: Every workflow runs under explicit constraints limiting recursion depth, concurrent steps, wall-clock duration, and dollar spend.

---

## 2. Monorepo Domain Boundaries

```text
┌────────────────────────────────────────────────────────┐
│                      terrarium-cli                     │
│  (OpenTUI Shell, Workspaces 1-10, Command Handlers)    │
└───────────────────────────┬────────────────────────────┘
                            │ imports
                            ▼
┌────────────────────────────────────────────────────────┐
│                    @terrarium/core                     │
│  (Orchestrator, Intake, Persistence, Studio, Reports)  │
└─────────────┬────────────────────────────┬─────────────┘
              │ imports                    │ imports
              ▼                            ▼
┌───────────────────────────┐┌───────────────────────────┐
│     @terrarium/config     ││   @terrarium/contracts    │
│  (Paths, Secrets, Limits) ││  (Pure Types, Schemas,    │
└─────────────┬─────────────┘│   State Machines, Errors) │
              │ imports      └───────────────────────────┘
              ▼                            ▲
              └────────────────────────────┘
```

### Boundary Guarantees
- **`@terrarium/contracts`**: Zero external dependencies. Can be compiled in any TypeScript environment (browser, edge worker, node, bun) without bringing in Node APIs or filesystem code.
- **`@terrarium/core`**: Decoupled from OpenTUI and React. Does not contain any terminal rendering or CLI formatting logic. Communicates with consumers via structured typed records (`Result<T, E>`).
- **`terrarium-cli`**: Decoupled from direct database tables; interacts with the platform strictly via `CoreEngine` services and command handlers.

---

## 3. Formal State Machines & Lifecycle Transitions

State transitions in TERRARIUM are mathematically verified at runtime. Attempting an illegal transition throws `InvalidStateTransitionError`.

### 3.1 Task Status Machine (`TaskStatus`)

```text
                      ┌───────────────┐
                      │     draft     │
                      └───────┬───────┘
                              │
                              ▼
                      ┌───────────────┐
                      │    planned    │
                      └───────┬───────┘
                              │
                              ▼
                      ┌───────────────┐
        ┌────────────►│    queued     │◄────────────┐
        │             └───────┬───────┘             │
        │                     │                     │
        │                     ▼                     │
        │             ┌───────────────┐             │
        │   ┌────────►│    running    │─────────┐   │
        │   │         └───────┬───────┘         │   │
        │   │                 │                 │   │
        │   │   ┌─────────────┴─────────────┐   │   │
        │   │   ▼                           ▼   │   │
        │ ┌───────────────┐       ┌───────────┴─┐   │
        │ │waiting_for_app│       │waiting_for_i│   │
        │ └──────┬────────┘       └──────┬──────┘   │
        │        │                       │          │
        │        └───────────────────────┘          │
        │                                           │
        └─────────────────── blocked ───────────────┘
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
     ┌───────────────┐┌───────────────┐┌───────────────┐
     │   completed   ││    failed     ││   cancelled   │
     └───────────────┘└───────────────┘└───────────────┘
```

- **Legal Transitions**:
  - `draft -> planned`
  - `planned -> queued, cancelled`
  - `queued -> running, cancelled`
  - `running -> waiting_for_input, waiting_for_approval, blocked, completed, failed, cancelled`
  - `waiting_for_input -> running, cancelled, failed`
  - `waiting_for_approval -> running, cancelled, failed, blocked`
  - `blocked -> running, cancelled, failed`
- **Terminal States**: `completed`, `failed`, `cancelled` (no transitions out).

---

### 3.2 Approval Request Machine (`ApprovalStatus`)

```text
                      ┌───────────────┐
                      │    pending    │
                      └───────┬───────┘
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
  │   approved    │   │   rejected    │   │    expired    │
  └───────────────┘   └───────────────┘   └───────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │   cancelled   │
                      └───────────────┘
```

- **Guarantees**:
  - An approval cannot be approved twice or modified after rejection (`DuplicateExecutionError`).
  - Action payloads are hashed (`calculatePayloadHash`) using SHA-256 with deterministic key sorting. If payload changes between request and execution, execution is blocked with `TamperDetectedError`.

---

### 3.3 Workflow Stage Machine (`WorkflowStage`)

The high-level end-to-end pipeline executes through sequential lifecycle phases:

```text
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
│  intake  ├──►│ planning ├──►│ approval ├──►│ execution ├──►│ artifacts ├──►│ reporting ├──►│ completed │
└────┬─────┘   └────┬─────┘   └────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └───────────┘
     │              │              │               │               │               │
     └──────────────┴──────────────┴───────┬───────┴───────────────┴───────────────┘
                                           │
                                           ▼
                                 ┌───────────────────┐
                                 │ failed, cancelled │
                                 └───────────────────┘
```

---

## 4. Invariant & Safety Proofs

### 4.1 Dormant Profile Proof
```text
Registered Agent Profiles (Total = N)
 ├── Active / Selected Profiles   (Set A: steps.flatMap(s => s.candidateAgentSlugs))
 └── Dormant Profiles             (Set D: Total Profiles \ Set A)

 Invariant:
 1. A ∩ D = ∅ (Disjoint)
 2. Zero executions, zero tokens, zero network requests for any agent in Set D.
```
This is verified at runtime by `EndToEndWorkflowPipeline.analyzeProfileDormancy()`.

### 4.2 Epistemic Classification in Reports
Reports generated by TERRARIUM are required to partition claims into distinct categories:
- **Verified Facts**: Backed by executed tests, compilation outcomes, or checksummed source files.
- **Generated Analyses**: Inferences and deductions derived from verified facts.
- **Assumptions & Hypotheses**: Stated premises requiring external validation.
- **Simulated Persona Feedback**: Opinions produced by simulated customer archetypes, tagged with `isSimulated: true` and accompanied by the mandatory simulation notice.
