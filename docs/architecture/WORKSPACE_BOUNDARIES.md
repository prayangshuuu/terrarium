# TERRARIUM — Workspace Architecture & Package Boundaries

> Architecture reference documenting monorepo layout, package responsibilities, dependency directions, and presentation decoupling.

---

## 1. Monorepo Architecture Overview

TERRARIUM is configured as a single Bun workspace managing applications in `apps/*` and shared domain packages in `packages/*`.

```text
terrarium/
├── package.json              (Root monorepo manifest with Bun workspaces configuration)
├── bun.lock                  (Single, authoritative lockfile for entire workspace)
├── tsconfig.base.json        (Canonical TypeScript compiler settings and path aliases)
├── tsconfig.json             (Root TypeScript project referencing all packages & apps)
├── packages/
│   ├── contracts/            (@terrarium/contracts: shared domain models, types, status unions)
│   ├── config/               (@terrarium/config: environment resolution, settings, redaction)
│   └── core/                 (@terrarium/core: orchestration runtime engine, lifecycle abstractions)
├── apps/
│   └── cli/                  (terrarium-cli: interactive OpenTUI terminal interface)
└── docs/                     (Architecture, plan context, specifications, and reports)
```

---

## 2. Package Responsibilities & Boundaries

| Package | Purpose & Responsibilities | Prohibited Content |
|---|---|---|
| **`@terrarium/contracts`** | Shared domain contracts, entity interfaces (`BaseEntity`), execution/task lifecycle status unions (`ExecutionStatus`, `TaskStatus`), functional primitives (`Result<T, E>`), package metadata. | 0 runtime dependencies. No terminal UI code (`@opentui/*`), no AI model SDKs, no filesystem I/O, no DB drivers. |
| **`@terrarium/config`** | Typed configuration loading, defaults (`getDefaultConfig`), environment validation (`AppEnvironment`), sensitive key identification (`isSensitiveKey`), redaction primitives. | No TUI presentation code, no direct agent runtime execution, no database connection handles. |
| **`@terrarium/core`** | Multi-agent orchestration engine (`createCoreEngine`), task coordination, lifecycle state tracking (`CoreEngineState`), agent profiles, memory, and tool registry interfaces. | No OpenTUI or terminal rendering code. No frontend DOM or web framework code. Must remain usable in headless or server modes. |
| **`apps/cli`** | User-facing terminal user interface (`@opentui/react`, `@opentui/core`), interactive keyboard navigation, real-time status display, CLI entry point. | No business logic or direct provider calls that bypass `@terrarium/core`. |
| *(Future) `apps/studio`* | Web-based management interface, browser dashboard, rich visual inspection. | Decoupled from `@opentui/*` and ANSI escape sequences; consumes `@terrarium/core`, `@terrarium/contracts`, and `@terrarium/config`. |

---

## 3. Strict Unidirectional Dependency Hierarchy

All dependencies must flow downward strictly. No circular references, lateral dependencies between sibling domain packages, or upward dependencies from core/contracts to presentation apps are permitted.

```
       ┌──────────────────────┐         ┌──────────────────────┐
       │   apps/cli (TUI)     │         │ apps/studio (Future) │
       └──────────┬───────────┘         └──────────┬───────────┘
                  │                                │
                  └───────────────┬────────────────┘
                                  ▼
                     ┌──────────────────────────┐
                     │     @terrarium/core      │ (Runtime & Orchestration)
                     └────────────┬─────────────┘
                                  │
                                  ▼
                     ┌──────────────────────────┐
                     │     @terrarium/config    │ (Configuration & Environment)
                     └────────────┬─────────────┘
                                  │
                                  ▼
                     ┌──────────────────────────┐
                     │   @terrarium/contracts   │ (Domain Models & Primitives)
                     └──────────────────────────┘
```

### Dependency Rules:
1. **Level 0 (Leaf) — `@terrarium/contracts`**: Must not depend on any workspace package or external library. Pure TypeScript only.
2. **Level 1 — `@terrarium/config`**: May only depend on `@terrarium/contracts`.
3. **Level 2 — `@terrarium/core`**: May depend on `@terrarium/contracts` and `@terrarium/config`.
4. **Level 3 (Applications) — `apps/*`**: May consume any `packages/*` package via workspace references (`workspace:*`).

---

## 4. Runtime Dependency Placement (A2 Protocol)

- **AI SDKs & Providers (Prompt 9 & 19):** Model providers (OpenAI, Anthropic, Gemini, etc.) and HTTP client adapters will be isolated within `@terrarium/core` (or dedicated provider packages). They must never be imported into `@terrarium/contracts` or `@terrarium/config`.
- **Execution Boundaries:** Long-running agent executions are driven asynchronously behind `@terrarium/core` engine interfaces, preventing terminal UI render blocking in `apps/cli`.
- **Minimal Dependencies:** Zero speculative packages or third-party dependencies are introduced ahead of concrete requirements.

---

## 5. Install Reproducibility & Lockfile Ownership (A3 Protocol)

- **Single Lockfile Authority:** All workspace packages share the single root `bun.lock`. Nested lockfiles (e.g. `apps/cli/bun.lock`) are strictly prohibited and eliminated.
- **Internal Resolution:** Inter-package dependencies declare `"workspace:*"` in package manifests. Bun resolves these via local symlinks inside `node_modules/@terrarium/*`.
- **Deterministic CI Installs:** Reproducible installs are guaranteed via `bun install --frozen-lockfile` at the repository root.

---

## 6. TypeScript Configuration & Tooling (A1 / A4 Protocol)

- **Centralized Compiler Settings:** Base compiler options reside in `tsconfig.base.json` using `moduleResolution: "bundler"`, `verbatimModuleSyntax: true`, and `strict: true`.
- **Path Mappings:** Root `paths` map `@terrarium/contracts`, `@terrarium/config`, and `@terrarium/core` directly to their TypeScript source files (`./packages/*/src/index.ts`) for instant IDE resolution without requiring premature compilation build steps.
- **Application Specializations:** `apps/cli/tsconfig.json` extends `../../tsconfig.base.json` and configures JSX support (`jsx: "react-jsx"`, `jsxImportSource: "@opentui/react"`).

---

## 7. Future Studio Compatibility (A5 Protocol)

To ensure seamless future development of `apps/studio` (the web dashboard) without refactoring the core domain:
1. **No Node/Bun-exclusive globals** in `@terrarium/contracts`.
2. **No terminal escape codes or OpenTUI primitives** in `@terrarium/config` or `@terrarium/core`.
3. All contracts and configuration schemas are fully serializable across network boundaries (JSON-compatible).
