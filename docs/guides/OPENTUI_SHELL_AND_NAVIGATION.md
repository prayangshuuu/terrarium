# OpenTUI Shell and Navigation Architecture

## 1. Overview & Purpose

The TERRARIUM terminal interface provides a keyboard-first, full-screen terminal user interface (TUI) powered by OpenTUI (`@opentui/core` and `@opentui/react`).

In strict alignment with `PLAN.md` Section 16 (CLI and Terminal User Experience) and `PLAN_CONTEXT.md` Section 2 (Product Identity & Principles), the OpenTUI shell establishes:
1. **Restrained Design Tokens**: Accessible, high-contrast, dark slate visual system avoiding eye strain and visual noise.
2. **Product Identity & Shell Layout**: Header brand wordmark, active project context, real-time connection status, responsive navigation bar, main content viewport, breadcrumb trail, and bottom telemetry status bar.
3. **Canonical 10 Workspace Areas**: Single-key hotkey navigation (`[1]` through `[9]`, `[0]`) covering all 10 core workspace sections defined in `PLAN.md` Section 16.2.
4. **Predictable Back Behavior**: Dedicated history stack enabling instant reverse navigation (`Esc`, `b`, `Backspace`) with modal dismissal priority.
5. **Command Palette**: Rapid action launcher (`Ctrl+K` or `/`) with real-time fuzzy search filtering.
6. **Responsive Layout & Narrow Terminal Degradation**: Adaptive width monitoring that safely collapses the navigation sidebar and issues non-destructive layout warnings when dimensions fall below 80x20.
7. **Strict UI/Core Decoupling**: Complete architectural isolation between presentation components and domain state machines via `UiStateController`.
8. **Explicit Labeling of Simulated/Demo Data**: Rigid compliance with `PLAN_CONTEXT.md` Section 2 requiring all simulated personas and demo data to be clearly flagged (`[SIMULATED]`, `[DEMO DATA]`).

---

## 2. Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Header Component                                     │
│  ◈ TERRARIUM v0.1.0 (contracts v0.1.0)       Project: default     [DEV] ● CONNECTED    │
├────────────────────────────┬───────────────────────────────────────────────────────────┤
│    NavigationBar (Sidebar) │                      Content Region                       │
│  ▸ [1] Overview            │  Breadcrumbs: TERRARIUM › Overview                        │
│    [2] Agent Ecosystem     │                                                           │
│    [3] Departments         │  ┌─ VIRTUAL ORG ────────┐ ┌─ TASKS ───────┐ ┌─ BUDGET ──┐ │
│    [4] Conversations       │  │ 880 profiles         │ │ 0 active      │ │ $0.00     │ │
│    [5] Task Manager        │  └──────────────────────┘ └───────────────┘ └───────────┘ │
│    [6] Engineering Studio  │                                                           │
│    [7] Project Memory      │  Core Principles & Activity feed...                       │
│    [8] Reports & Evidence  │                                                           │
│    [9] Analytics & Budget  │                                                           │
│    [0] Settings            │                                                           │
├────────────────────────────┴───────────────────────────────────────────────────────────┤
│                                  StatusBar Component                                   │
│  ⚡ Active: 0 • Tasks: 0   Spend: $0.00 / $10.00 • 0.0k tok   [1-9,0] Nav [Ctrl+K] [Q] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Keyboard Navigation Specification

| Keybinding | Scope | Description |
| :--- | :--- | :--- |
| `1` – `9` | Global | Direct jump to Workspaces 1 through 9 |
| `0` | Global | Direct jump to Workspace 10 (Settings) |
| `Ctrl+K` or `/` | Global | Toggle Command Palette |
| `?` or `F1` | Global | Toggle Keyboard Help & Reference modal |
| `Esc` / `b` / `Backspace` | Global | Navigate Back in history / Dismiss active modal |
| `Ctrl+B` | Global | Toggle Navigation Sidebar collapsed state |
| `Tab` / `Shift+Tab` | Global | Cycle focus between navigation and content areas |
| `↑` / `↓` / `[` / `]` | Focused | Cycle workspace items or move list selection |
| `Enter` / `Return` | Palette | Execute selected command palette action |
| `q` / `Ctrl+C` | Global | Quit interactive terminal shell |

---

## 4. UI/Core Engine Boundary (`UiStateController`)

The presentation layer never queries SQLite databases or invokes private engine internals directly. All interactions flow through `UiStateController`:
- **Read Path**: The controller listens to domain events from `TelemetryManager` via `subscribeEvents(...)`.
- **Write Path**: Dispatches user intent via typed engine service methods.
- **Safety States**:
  - `LoadingState`: Indeterminate progress indicator.
  - `EmptyState`: Contextual empty container with icon and call-to-action hint.
  - `ErrorState`: Isolated error container offering retry/reset without tearing down terminal alternate screens.
  - `DisconnectedState`: Non-blocking degraded mode when core engine daemon is offline.
