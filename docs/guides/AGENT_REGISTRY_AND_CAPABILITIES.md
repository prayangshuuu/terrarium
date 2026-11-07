# TERRARIUM — Agent Profile Registry and Capability Catalog Guide

> Architecture, lifecycle boundaries, department taxonomies, capability resolution, and non-execution invariants for agent profiles.

---

## 1. Core Principles

In TERRARIUM, an **Agent Profile** is fundamentally separated from an **Agent Execution** or an **Agent Session**:

- **Agent Profile:** Inexpensive, durable data configuration (registered role, specialization, system prompt, capabilities, supported tasks, operational constraints, model preferences, permissions, version, and status).
- **Agent Execution:** A bounded, resource-metered instance of work triggered only on-demand for a specific task.
- **Agent Session:** An interactive conversational thread associated with a human user or manager.

```
┌─────────────────────────────────────────────────────────────┐
│                       Agent Registry                        │
│ (Durable Catalog of Profiles as Data, Zero LLM Invocations) │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
    ┌──────────────────────┐        ┌──────────────────────┐
    │ Task Orchestrator    │        │ Directory & CLI UX   │
    │ (Demand-Based Activation)     │ (Search, List, Inspect)
    └──────────┬───────────┘        └──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │   Bounded Execution  │  <-- Model Providers Invoked ONLY Here
    └──────────────────────┘
```

> [!IMPORTANT]
> **Non-Execution Invariants:**
> 1. Registry operations (`register`, `list`, `search`, `inspect`, `enable`, `disable`, `validate`, `resolve`) **NEVER** instantiate LLM provider clients or execute model calls.
> 2. Registration and listing **NEVER** initiate interactive sessions or generate message records.

---

## 2. Agent Profile Schema

Every registered agent profile contains:

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique stable identifier (e.g., `agent-eng-architect`). |
| `slug` | `string` | Unique URL/CLI-friendly slug (e.g., `principal-software-architect`). |
| `name` | `string` | Human-readable name (e.g., `Sophia Chen`). |
| `displayName` | `string` | Presentation name with role title. |
| `department` | `AgentDepartment` | One of the 10 canonical virtual organization departments. |
| `role` | `string` | Formal role title. |
| `description` | `string` | High-level summary of responsibilities and focus areas. |
| `systemPromptTemplate` | `string` | Persona instructions and operational guidelines. |
| `capabilities` | `readonly AgentCapability[]` | Declared capability items with permissions and consequentiality flags. |
| `supportedTasks` | `readonly string[]` | List of task types this profile is suited to perform. |
| `constraints` | `AgentConstraints` | Operational limits: max tokens, delegation depth, children tasks, timeouts, prohibited tools. |
| `modelPreference` | `ModelPreference` | Preferred tier (`fast`, `standard`, `advanced`), provider, model, and temperature. |
| `permissions` | `readonly string[]` | Explicit least-privilege permission grants (e.g., `["read:code", "run:tests"]`). |
| `version` | `string` | Semantic profile version (e.g., `1.0.0`). |
| `status` | `AgentProfileStatus` | Lifecycle status: `available`, `busy`, `disabled`, or `deprecated`. |
| `tags` | `readonly string[]` | Keyword classification tags. |
| `personaAttributes` | `PersonaAttributes?` | Simulated buyer/user attributes for Customer Intelligence profiles. |

---

## 3. Department Taxonomy

TERRARIUM defines 10 canonical departments:

1. **Executive Leadership (`executive`):** Strategic direction, thesis validation, priority decisions, risk appetite.
2. **Engineering (`engineering`):** Architecture, backend, frontend, test automation, infra, and refactoring.
3. **Customer Intelligence (`customer_intelligence`):** Simulated personas for buyer feedback, pricing reactions, and UX friction.
4. **Product Management (`product`):** PRDs, scope bounding, acceptance criteria, user journeys.
5. **Design & UX (`design`):** Information architecture, terminal UI layout, interaction ergonomics, accessibility.
6. **Marketing & Growth (`marketing`):** Competitive differentiation, value proposition framing, go-to-market channels.
7. **Security & Compliance (`security`):** Threat modeling (STRIDE), secret leak auditing, least privilege reviews.
8. **Research & Intelligence (`research`):** SOTA model benchmarking, prompt engineering research, literature synthesis.
9. **Documentation (`documentation`):** API reference docs, architecture runbooks, developer guides.
10. **Legal & Risk Analysis (`legal`):** Open-source license reviews (MIT/Apache/GPL), IP risks, data privacy boundaries.

---

## 4. Capability Resolution Engine

When a task requires an agent, the orchestrator invokes `resolve(criteria)` on the registry:

```typescript
const matches = await registry.resolve({
  taskType: "architecture_review",
  requiredCapabilities: ["cap-arch-review"],
  requiredPermissions: ["read:code"],
  department: "engineering",
  preferFastTier: false,
});
```

The matching algorithm scores candidates based on:
- Exact department match (+30)
- Declared task type match (+40) or keyword match (+20)
- Declared capability ID or name match (+25 per match)
- Tag matches (+5 per tag)
- Status is available (+10)
- Fast model tier match if requested (+15)
- All required permissions must be satisfied (disqualifies candidate if missing).

---

## 5. Persistence and SQLite Table

Agent profiles are optionally persisted into SQLite via table `agent_profiles` (migration `002_agent_profiles.ts`):

- **Unique Constraints:** `id` (PRIMARY KEY), `slug` (UNIQUE).
- **Indexed Fields:** `slug`, `department`, `status`.
- **JSON Serialization:** `capabilities_json`, `supported_tasks_json`, `constraints_json`, `limits_json`, `model_preference_json`, `permissions_json`, `tags_json`, `persona_attributes_json`, `metadata_json`.
