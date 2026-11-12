# TERRARIUM — TUI Redesign Audit & Visual System Specification

**Authors:** A4 (Senior CLI/TUI Designer & Developer) & A5 (Product Interface Designer)  
**Date:** November 13, 2026  
**Scope:** PROMPT 23 Part D — Premium, Professional, Emoji-Free CLI/TUI Redesign

---

## 1. Audit of Current Problems

| Component / Area | Defect / Anti-Pattern | Operational Impact | Corrective Measure |
|:---|:---|:---|:---|
| `glyphs.ts` | Emoji symbols used for workspaces (`👥`, `🏛`, `💬`, `📋`, `⚡`, `🧠`, `📊`, `📈`, `⚙`) and status (`⏳`, `🔍`, `🔒`, `🛡`, `📁`, `📄`, `💰`, `🕒`, `✨`). | Inconsistent terminal cell widths (1 vs. 2 cells across macOS Terminal, iTerm2, Alacritty, Kitty), causing misalignment, clipping, and toy-demo aesthetic. | Remove 100% of emojis. Replace with restrained Unicode box-drawing tokens and monospace textual badges (`[ORG]`, `[TSK]`, `[DEV]`, `[WAIT]`, `[OK]`, `[ERR]`). |
| `EcosystemView.tsx` | Hardcoded `.slice(0, 14)` on profile list. | Silent truncation of agent profiles when catalog exceeds 14 items. | Implement windowed scrolling viewport (`pageSize = 12`) tracking `selectedAgentIndex`, with page indicators (`Showing X-Y of Z profiles`) and PgUp/PgDn navigation. |
| `EcosystemView.tsx` | Hardcoded copy: "15-profile virtual organization". | Confusing copy when catalog is dynamic or contains 50+ profiles. | Replace with data-driven count: `${totalCount}-profile virtual organization`. |
| `TasksView.tsx` | Hardcoded `.slice(0, 15)` on task list. | Silent truncation of tasks when project exceeds 15 tasks. | Implement windowed viewport with pagination status. |
| `Header.tsx` & `NavigationBar.tsx` | Emoji workspace indicators. | Cluttered top frame, inconsistent character heights. | Clean numeric hotkey labels: `[1] Overview`, `[2] Ecosystem`, `[3] Tasks`, etc. |
| Status Displays | Color-only or emoji indicators. | Violates accessibility standard: terminal users with color blindness cannot distinguish status. | Pair every color with a distinct text badge: `[RUNNING]`, `[COMPLETED]`, `[WAITING]`, `[FAILED]`, `[PAUSED]`, `[DISABLED]`. |

---

## 2. Navigation Hierarchy & App Frame

The app frame adheres to a strict 4-zone terminal geometry:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ZONE 1: APPLICATION HEADER                                                             │
│ ◈ TERRARIUM v0.1.0        Workspace: Overview [1]         Project: default [DEV] ●     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ZONE 2: WORKSPACE NAVIGATION BAR                                                       │
│ [1] Overview  [2] Ecosystem  [3] Tasks  [4] Conversations  [5] Tools  [6] Memory       │
│ [7] Studio    [8] Reports    [9] Budget [0] Settings                                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ZONE 3: MAIN VIEWPORT (WINDOWED CONTENT & DETAIL SPLIT)                                │
│                                                                                        │
│                                                                                        │
│                                                                                        │
│                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ZONE 4: STATUS FOOTER & KEYBOARD HINTS                                                 │
│ [1-0] Workspaces • [j/k/↑/↓] Navigate • [PgUp/PgDn] Page • [Ctrl+K] Palette • [q] Quit │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Design Tokens: Colors & Emoji-Free Glyphs

### Semantic Color Tiers (High-Contrast Restrained Dark Slate)
- **Application Background:** `#0B0F17` (Deep Obsidian Slate)
- **Card / Container Background:** `#131B26` (Muted Steel Slate)
- **Active Selection Background:** `#1E293B` (Elevated Slate)
- **Border Subtle:** `#1E293B`
- **Border Focused:** `#38BDF8` (Sky Blue)
- **Primary Text:** `#F8FAFC` (Near White, 15:1 contrast on Obsidian)
- **Secondary Text:** `#94A3B8` (Cool Grey, 7:1 contrast on Obsidian)
- **Muted Text:** `#64748B` (Dim Slate)

### Emoji-Free Status Tokens
- Success: `[OK]` (Green `#10B981`)
- Error: `[ERR]` (Red `#EF4444`)
- Warning: `[WARN]` (Amber `#F59E0B`)
- Pending / Waiting: `[WAIT]` (Yellow `#EAB308`)
- Running: `[RUN]` (Sky Blue `#38BDF8`)
- Idle / Inactive: `[IDLE]` (Muted `#64748B`)
- Blocked: `[BLOCK]` (Orange `#F97316`)
- Simulated Persona: `[SIMULATED]` (Purple `#C084FC`)

---

## 4. Windowed Viewport & Scrolling Rules

When lists exceed terminal screen height:
1. `pageSize`: Standardized to 12 rows in dense tables, 8 rows in card lists.
2. `scrollOffset`: Dynamically computed as:
   $$\text{scrollOffset} = \max\left(0, \min\left(\text{selectedIdx} - \lfloor\text{pageSize} / 2\rfloor, \text{totalItems} - \text{pageSize}\right)\right)$$
3. Table footer displays:
   `Showing items ${start}-${end} of ${total} • Page ${currentPage} of ${totalPages} • Use [↑/↓] or [PgUp/PgDn] to scroll`
4. Empty states display explicit text guidance, never empty boxes.

---

## 5. Keyboard Navigation Standards

- `[1]` through `[9]`, `[0]`: Instant workspace switching.
- `[j]` / `[Down]`: Move selection down. Auto-scrolls viewport.
- `[k]` / `[Up]`: Move selection up. Auto-scrolls viewport.
- `[PgDn]` / `[PageDown]`: Advance viewport by `pageSize`.
- `[PgUp]` / `[PageUp]`: Rewind viewport by `pageSize`.
- `[Enter]` / `[Space]`: Inspect selected item or trigger contextual action.
- `[Esc]`: Close modal / clear active filters.
- `[Ctrl+K]`: Searchable Command Palette.
- `[?]`: Open Help Modal.
- `[q]`: Clean application exit (restores terminal raw mode).
