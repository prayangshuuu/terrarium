/**
 * apps/cli/src/ui/state/ui-state-controller.ts
 *
 * Decoupled UI State Controller and Core Engine boundary adapter.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime),
 * with strict metric correctness and real-state guarantees enforced by A3.
 * Strictly maintains UI/Core separation: UI observes events and calls engine commands,
 * but never mutates database rows or internal core structures directly.
 */

import {
  WORKSPACE_AREAS,
  type WorkspaceId,
  type AgentProfile,
  type AgentDepartment,
  type AgentLifecycleStatus,
  type OverviewSummary,
  type AgentEcosystemFilter,
  type AgentSelectionRationale,
  type OverviewExecutionItem,
  type OverviewTaskItem,
  type OverviewApprovalItem,
  resolveAgentLifecycleStatus,
} from "@terrarium/contracts";
import type { CoreEngine } from "@terrarium/core";
import {
  type CommandPaletteItem,
  createDefaultOverviewSummary,
  type FocusedRegion,
  type UiAlert,
  type UiState,
  type ViewMode,
} from "./ui-state-types.js";

export interface UiStateControllerOptions {
  readonly engine?: CoreEngine;
  readonly initialWorkspace?: WorkspaceId;
  readonly projectName?: string;
  readonly environment?: "development" | "production" | "test";
  readonly initialProfiles?: readonly AgentProfile[];
  readonly initialOverviewSummary?: Partial<OverviewSummary>;
}

export class UiStateController {
  private state: UiState;
  private readonly listeners = new Set<(state: UiState) => void>();
  private readonly engineUnsubscribers: (() => void)[] = [];
  private readonly engine?: CoreEngine;

  constructor(options: UiStateControllerOptions = {}) {
    this.engine = options.engine;

    const initialWorkspace = options.initialWorkspace ?? "overview";
    const engineStatus = this.engine ? "ready" : "disconnected";

    const initialProfiles = options.initialProfiles ?? [];
    const baseOverview = createDefaultOverviewSummary(engineStatus);

    // Seed department counts and simulated count from initialProfiles if provided
    const deptCounts: Record<string, number> = {};
    let simulatedCount = 0;
    for (const p of initialProfiles) {
      deptCounts[p.department] = (deptCounts[p.department] ?? 0) + 1;
      if (p.department === "customer_intelligence" || p.personaAttributes) {
        simulatedCount++;
      }
    }

    const initialOverview: OverviewSummary = {
      ...baseOverview,
      departmentCounts: deptCounts,
      simulatedPersonaCount: simulatedCount,
      ...(options.initialOverviewSummary ?? {}),
      registeredProfileCount:
        options.initialOverviewSummary?.registeredProfileCount ??
        (initialProfiles.length > 0 ? initialProfiles.length : baseOverview.registeredProfileCount),
    };

    this.state = {
      activeWorkspace: initialWorkspace,
      history: [initialWorkspace],
      isSidebarCollapsed: false,
      isCommandPaletteOpen: false,
      isHelpModalOpen: false,
      focusedRegion: "content",
      viewMode: "ready",
      errorMessage: undefined,
      alert: undefined,
      paletteQuery: "",
      selectedPaletteIndex: 0,
      engineStatus,
      activeAgentCount: initialOverview.activeExecutionCount,
      registeredAgentCount: initialOverview.registeredProfileCount,
      activeTaskCount: initialOverview.activeTaskCount,
      totalTokensUsed: initialOverview.totalTokensUsed,
      totalSpendUsd: initialOverview.totalSpendUsd,
      maxSpendUsd: initialOverview.maxSpendUsd ?? 10.0,
      projectName: options.projectName ?? "terrarium-workspace",
      environment: options.environment ?? "development",

      // Prompt 15 Real-State Additions
      overviewSummary: initialOverview,
      ecosystemProfiles: initialProfiles,
      ecosystemFilter: {
        searchQuery: "",
        department: "all",
        lifecycleStatus: "all",
      },
      selectedAgentIndex: 0,
      selectedAgentId: initialProfiles[0]?.id ?? null,
      isAgentDetailOpen: false,
      selectionRationales: {},
      activeExecutions: initialOverview.recentExecutions ?? [],
      selectedAgentIds: [],
      pausedAgentIds: [],
    };

    if (this.engine) {
      this.bindEngineEvents();
      void this.refreshOverview();
      void this.loadEcosystem();
    }
  }

  public getState(): UiState {
    return this.state;
  }

  public subscribe(listener: (state: UiState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("Error in UI state listener:", err);
      }
    }
  }

  private setState(updates: Partial<UiState>): void {
    this.state = { ...this.state, ...updates };
    this.emit();
  }

  /**
   * Navigates to a workspace area, pushing the previous area onto the history stack.
   */
  public navigate(workspace: WorkspaceId, addToHistory = true): void {
    if (!WORKSPACE_AREAS[workspace]) {
      return;
    }

    if (this.state.activeWorkspace === workspace) {
      // Already on this workspace; ensure palette/help/agent detail are closed
      if (this.state.isCommandPaletteOpen || this.state.isHelpModalOpen || this.state.isAgentDetailOpen) {
        this.setState({
          isCommandPaletteOpen: false,
          isHelpModalOpen: false,
          isAgentDetailOpen: false,
          focusedRegion: "content",
        });
      }
      return;
    }

    const nextHistory = addToHistory
      ? [...this.state.history, workspace].slice(-50) // bounded history stack
      : this.state.history;

    this.setState({
      activeWorkspace: workspace,
      history: nextHistory,
      isCommandPaletteOpen: false,
      isHelpModalOpen: false,
      isAgentDetailOpen: false,
      focusedRegion: "content",
      paletteQuery: "",
      selectedPaletteIndex: 0,
    });
  }

  /**
   * Navigates back in history, or dismisses an open overlay (detail modal, palette, or help).
   * Returns true if a back action occurred, false if history is at root.
   */
  public goBack(): boolean {
    if (this.state.isAgentDetailOpen) {
      this.closeAgentDetail();
      return true;
    }

    if (this.state.isCommandPaletteOpen) {
      this.closeCommandPalette();
      return true;
    }

    if (this.state.isHelpModalOpen) {
      this.closeHelp();
      return true;
    }

    if (this.state.history.length <= 1) {
      return false;
    }

    const nextHistory = [...this.state.history];
    nextHistory.pop(); // Pop current
    const previous = nextHistory[nextHistory.length - 1];

    if (previous) {
      this.setState({
        activeWorkspace: previous,
        history: nextHistory,
        focusedRegion: "content",
      });
      return true;
    }

    return false;
  }

  public toggleSidebar(): void {
    this.setState({ isSidebarCollapsed: !this.state.isSidebarCollapsed });
  }

  public setSidebarCollapsed(collapsed: boolean): void {
    if (this.state.isSidebarCollapsed !== collapsed) {
      this.setState({ isSidebarCollapsed: collapsed });
    }
  }

  public openCommandPalette(): void {
    this.setState({
      isCommandPaletteOpen: true,
      isHelpModalOpen: false,
      focusedRegion: "palette",
      paletteQuery: "",
      selectedPaletteIndex: 0,
    });
  }

  public closeCommandPalette(): void {
    this.setState({
      isCommandPaletteOpen: false,
      focusedRegion: "content",
      paletteQuery: "",
      selectedPaletteIndex: 0,
    });
  }

  public toggleCommandPalette(): void {
    if (this.state.isCommandPaletteOpen) {
      this.closeCommandPalette();
    } else {
      this.openCommandPalette();
    }
  }

  public openHelp(): void {
    this.setState({
      isHelpModalOpen: true,
      isCommandPaletteOpen: false,
      focusedRegion: "help",
    });
  }

  public closeHelp(): void {
    this.setState({
      isHelpModalOpen: false,
      focusedRegion: "content",
    });
  }

  public toggleHelp(): void {
    if (this.state.isHelpModalOpen) {
      this.closeHelp();
    } else {
      this.openHelp();
    }
  }

  public setFocusedRegion(region: FocusedRegion): void {
    this.setState({ focusedRegion: region });
  }

  public setPaletteQuery(query: string): void {
    this.setState({ paletteQuery: query, selectedPaletteIndex: 0 });
  }

  public setPaletteIndex(index: number): void {
    this.setState({ selectedPaletteIndex: Math.max(0, index) });
  }

  public setAlert(message: string, level: UiAlert["level"] = "info"): void {
    const alert: UiAlert = {
      id: `alert-${Date.now()}`,
      level,
      message,
      timestamp: Date.now(),
    };
    this.setState({ alert });
  }

  public clearAlert(): void {
    if (this.state.alert) {
      this.setState({ alert: undefined });
    }
  }

  public setViewMode(mode: ViewMode, errorMessage?: string): void {
    this.setState({ viewMode: mode, errorMessage });
  }

  // =========================================================================
  // Ecosystem Directory & Detail Inspection (Prompt 15)
  // =========================================================================

  public setEcosystemSearch(query: string): void {
    this.setState({
      ecosystemFilter: { ...this.state.ecosystemFilter, searchQuery: query },
      selectedAgentIndex: 0,
    });
  }

  public setEcosystemDepartmentFilter(department: AgentDepartment | "all"): void {
    this.setState({
      ecosystemFilter: { ...this.state.ecosystemFilter, department },
      selectedAgentIndex: 0,
    });
  }

  public setEcosystemLifecycleFilter(lifecycleStatus: AgentLifecycleStatus | "all"): void {
    this.setState({
      ecosystemFilter: { ...this.state.ecosystemFilter, lifecycleStatus },
      selectedAgentIndex: 0,
    });
  }

  public resetEcosystemFilters(): void {
    this.setState({
      ecosystemFilter: {
        searchQuery: "",
        department: "all",
        lifecycleStatus: "all",
      },
      selectedAgentIndex: 0,
    });
  }

  public setEcosystemIndex(index: number): void {
    const filtered = this.getFilteredEcosystemProfiles();
    if (filtered.length === 0) {
      this.setState({ selectedAgentIndex: 0, selectedAgentId: null });
      return;
    }
    const safeIdx = Math.max(0, Math.min(filtered.length - 1, index));
    const target = filtered[safeIdx];
    this.setState({
      selectedAgentIndex: safeIdx,
      selectedAgentId: target ? target.id : null,
    });
  }

  public openAgentDetail(agentId?: string): void {
    const id = agentId ?? this.state.selectedAgentId;
    if (id) {
      const filtered = this.getFilteredEcosystemProfiles();
      const idx = filtered.findIndex((p) => p.id === id);
      this.setState({
        selectedAgentId: id,
        selectedAgentIndex: idx >= 0 ? idx : this.state.selectedAgentIndex,
        isAgentDetailOpen: true,
      });
    }
  }

  public closeAgentDetail(): void {
    this.setState({ isAgentDetailOpen: false });
  }

  /**
   * Records a demand-based candidate selection rationale for an agent.
   */
  public recordSelectionRationale(rationale: AgentSelectionRationale): void {
    const nextRationales = {
      ...this.state.selectionRationales,
      [rationale.profileId]: rationale,
    };
    const nextSelectedIds = this.state.selectedAgentIds.includes(rationale.profileId)
      ? this.state.selectedAgentIds
      : [...this.state.selectedAgentIds, rationale.profileId];

    this.setState({
      selectionRationales: nextRationales,
      selectedAgentIds: nextSelectedIds,
    });
  }

  /**
   * Computes the operational lifecycle status for an agent profile.
   */
  public getAgentLifecycleStatus(profile: AgentProfile): AgentLifecycleStatus {
    const isExecuting = this.state.activeExecutions.some(
      (e) => (e.agentProfileId === profile.id || e.agentSlug === profile.slug) && e.status === "running"
    );
    const isPaused = this.state.pausedAgentIds.includes(profile.id);
    const isSelected = this.state.selectedAgentIds.includes(profile.id);

    return resolveAgentLifecycleStatus(profile, { isExecuting, isPaused, isSelected });
  }

  /**
   * Filters ecosystem profiles by current search query, department, and lifecycle status.
   */
  public getFilteredEcosystemProfiles(): readonly AgentProfile[] {
    const { searchQuery, department, lifecycleStatus } = this.state.ecosystemFilter;
    const q = searchQuery.trim().toLowerCase();

    return this.state.ecosystemProfiles.filter((profile) => {
      // 1. Department filter
      if (department !== "all" && profile.department !== department) {
        return false;
      }

      // 2. Lifecycle status filter
      if (lifecycleStatus !== "all") {
        const status = this.getAgentLifecycleStatus(profile);
        if (status !== lifecycleStatus) {
          return false;
        }
      }

      // 3. Search query
      if (q) {
        const matchesName = profile.name.toLowerCase().includes(q);
        const matchesRole = profile.role.toLowerCase().includes(q);
        const matchesSlug = profile.slug.toLowerCase().includes(q);
        const matchesDept = profile.department.toLowerCase().includes(q);
        const matchesDesc = profile.description.toLowerCase().includes(q);
        const matchesTag = profile.tags.some((t) => t.toLowerCase().includes(q));
        const matchesCap = profile.capabilities.some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            (c.keywords && c.keywords.some((k) => k.toLowerCase().includes(q)))
        );

        if (!matchesName && !matchesRole && !matchesSlug && !matchesDept && !matchesDesc && !matchesTag && !matchesCap) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Asynchronously loads profiles from engine registry or database into the ecosystem state.
   */
  public async loadEcosystem(): Promise<void> {
    if (!this.engine) return;

    try {
      let profiles: readonly AgentProfile[] = [];

      if (this.engine.db) {
        const res = await this.engine.db.agentProfiles.list();
        if (res.success && Array.isArray(res.data)) {
          profiles = res.data;
        }
      }

      if (profiles.length === 0 && this.engine.registry) {
        const res = await this.engine.registry.list();
        if (res.success && Array.isArray(res.data)) {
          profiles = res.data;
        }
      }

      this.setState({
        ecosystemProfiles: profiles,
        selectedAgentId: profiles[this.state.selectedAgentIndex]?.id ?? null,
      });
    } catch (err) {
      console.warn("Failed to load ecosystem profiles:", err);
    }
  }

  /**
   * Fetches real state from CoreEngine components to populate OverviewSummary (A2 & A3).
   * Guaranteed: NO fabricated or invented metrics.
   */
  public async refreshOverview(): Promise<void> {
    if (!this.engine) {
      this.setState({
        overviewSummary: createDefaultOverviewSummary("disconnected"),
      });
      return;
    }

    try {
      const db = this.engine.db;
      let registeredCount = 0;
      let profiles: readonly AgentProfile[] = [];
      const deptCounts: Record<string, number> = {};
      let simulatedCount = 0;

      // 1. Registered Profiles
      if (db) {
        const profRes = await db.agentProfiles.list();
        if (profRes.success && Array.isArray(profRes.data)) {
          profiles = profRes.data;
          registeredCount = profiles.length;
        }
      } else if (this.engine.registry) {
        const profRes = await this.engine.registry.list();
        if (profRes.success && Array.isArray(profRes.data)) {
          profiles = profRes.data;
          registeredCount = profiles.length;
        }
      }

      for (const p of profiles) {
        deptCounts[p.department] = (deptCounts[p.department] ?? 0) + 1;
        if (p.department === "customer_intelligence" || p.personaAttributes) {
          simulatedCount++;
        }
      }

      // 2. Tasks
      let queuedTasks = 0;
      let runningTasks = 0;
      let completedTasks = 0;
      let failedTasks = 0;
      const recentTasks: OverviewTaskItem[] = [];

      if (db) {
        const tasksRes = await db.tasks.list();
        if (tasksRes.success && Array.isArray(tasksRes.data)) {
          for (const t of tasksRes.data) {
            if (t.status === "queued") queuedTasks++;
            else if (t.status === "running") runningTasks++;
            else if (t.status === "completed") completedTasks++;
            else if (t.status === "failed") failedTasks++;
          }

          // Latest 5 tasks
          const sorted = [...tasksRes.data].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          for (const t of sorted.slice(0, 5)) {
            recentTasks.push({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority ?? "standard",
              createdAt: t.createdAt,
            });
          }
        }
      }

      // 3. Executions
      let activeExecutionsCount = 0;
      const recentExecutions: OverviewExecutionItem[] = [];

      if (db && typeof db.executions.list === "function") {
        const execRes = await db.executions.list();
        if (execRes.success && Array.isArray(execRes.data)) {
          for (const e of execRes.data) {
            if (e.status === "running") {
              activeExecutionsCount++;
            }
          }

          const runningOrQueued = execRes.data.filter(
            (e) => e.status === "running" || e.status === "queued"
          );
          for (const e of runningOrQueued.slice(0, 5)) {
            const agent = profiles.find((p) => p.id === e.agentProfileId);
            recentExecutions.push({
              id: e.id,
              taskId: e.taskId,
              agentProfileId: e.agentProfileId,
              agentSlug: agent ? agent.slug : e.agentProfileId,
              status: e.status,
              provider: e.provider,
              model: e.model,
              startedAt: e.startedAt,
            });
          }
        }
      }

      // 4. Approvals
      let pendingApprovalsCount = 0;
      const pendingApprovals: OverviewApprovalItem[] = [];

      if (db) {
        const appRes = await db.approvals.list();
        if (appRes.success && Array.isArray(appRes.data)) {
          const pending = appRes.data.filter((a) => a.status === "pending");
          pendingApprovalsCount = pending.length;
          for (const a of pending.slice(0, 5)) {
            pendingApprovals.push({
              id: a.id,
              taskId: a.taskId,
              toolName: a.toolName,
              riskLevel: a.riskLevel,
              requestedAt: a.requestedAt,
              consequenceSummary: a.justification,
            });
          }
        }
      }

      // 5. Budget & Tokens
      let totalSpendUsd = 0.0;
      let totalTokensUsed = 0;
      let maxSpendUsd = 10.0;

      if (this.engine.budget) {
        const checkRes = await this.engine.budget.checkBudget("project", "default");
        if (checkRes.success && checkRes.data) {
          totalSpendUsd = checkRes.data.usedSpendUsd;
          totalTokensUsed = checkRes.data.usedTokens;
          if (checkRes.data.allocatedSpendUsd) {
            maxSpendUsd = checkRes.data.allocatedSpendUsd;
          }
        }
      }

      const activeTaskCount = queuedTasks + runningTasks;
      const now = new Date().toISOString();

      const summary: OverviewSummary = {
        engineStatus: activeExecutionsCount > 0 ? "running" : "ready",
        lastUpdatedAt: now,
        isFresh: true,
        registeredProfileCount: registeredCount,
        activeExecutionCount: activeExecutionsCount,
        activeTaskCount,
        queuedTaskCount: queuedTasks,
        runningTaskCount: runningTasks,
        completedTaskCount: completedTasks,
        failedTaskCount: failedTasks,
        pendingApprovalCount: pendingApprovalsCount,
        totalSpendUsd,
        maxSpendUsd,
        totalTokensUsed,
        departmentCounts: deptCounts,
        simulatedPersonaCount: simulatedCount,
        recentExecutions,
        recentTasks,
        pendingApprovals,
      };

      this.setState({
        overviewSummary: summary,
        registeredAgentCount: registeredCount,
        activeAgentCount: activeExecutionsCount,
        activeTaskCount,
        totalSpendUsd,
        totalTokensUsed,
        maxSpendUsd,
        activeExecutions: recentExecutions,
        engineStatus: summary.engineStatus,
      });
    } catch (err) {
      console.warn("Failed to refresh overview metrics:", err);
      this.setState({
        overviewSummary: {
          ...this.state.overviewSummary,
          isFresh: false,
        },
      });
    }
  }

  /**
   * Returns standard command palette actions.
   */
  public getCommandPaletteItems(): CommandPaletteItem[] {
    const items: CommandPaletteItem[] = [
      // Quick navigation to all workspaces
      ...Object.values(WORKSPACE_AREAS).map((area) => ({
        id: `nav-${area.id}`,
        title: `Go to ${area.label}`,
        subtitle: area.description,
        shortcut: `[${area.shortcut}]`,
        category: "navigation" as const,
        action: () => this.navigate(area.id),
      })),
      // Prompt 15: Ecosystem & Overview Specific Quick Actions
      {
        id: "action-refresh-overview",
        title: "Refresh Overview Metrics",
        subtitle: "Re-query database and engine runtime for real-state pulse",
        shortcut: "[r]",
        category: "action",
        action: () => {
          void this.refreshOverview();
          void this.loadEcosystem();
        },
      },
      {
        id: "action-filter-engineering",
        title: "Filter Agents: Engineering",
        subtitle: "View engineering specialists and software architects",
        category: "action",
        action: () => {
          this.navigate("ecosystem");
          this.setEcosystemDepartmentFilter("engineering");
        },
      },
      {
        id: "action-filter-simulated-personas",
        title: "Filter Agents: Simulated Customer Personas",
        subtitle: "View simulated customer personas with demographic attributes",
        category: "action",
        action: () => {
          this.navigate("ecosystem");
          this.setEcosystemDepartmentFilter("customer_intelligence");
        },
      },
      // View / UI toggles
      {
        id: "view-toggle-sidebar",
        title: this.state.isSidebarCollapsed ? "Expand Navigation Sidebar" : "Collapse Navigation Sidebar",
        subtitle: "Toggle navigation sidebar visibility",
        shortcut: "[Ctrl+B]",
        category: "view",
        action: () => this.toggleSidebar(),
      },
      {
        id: "view-help",
        title: "Keyboard Shortcuts & Help",
        subtitle: "Show complete keybinding reference modal",
        shortcut: "[?]",
        category: "system",
        action: () => this.openHelp(),
      },
      {
        id: "system-clear-alert",
        title: "Dismiss Active Alert",
        subtitle: "Clear current notification message",
        category: "system",
        action: () => this.clearAlert(),
      },
    ];

    const q = this.state.paletteQuery.trim().toLowerCase();
    if (!q) {
      return items;
    }

    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(q))
    );
  }

  /**
   * Binds to CoreEngine domain events for real-time observability.
   */
  private bindEngineEvents(): void {
    if (!this.engine) return;

    try {
      // Event listener for real-time domain events via telemetry
      if (this.engine.telemetry && typeof this.engine.telemetry.subscribeEvents === "function") {
        const sub = this.engine.telemetry.subscribeEvents((event: any) => {
          if (!event || !event.eventType) return;

          switch (event.eventType) {
            case "task:started":
            case "task:created":
            case "task:completed":
            case "task:failed":
            case "task:cancelled":
            case "execution:started":
            case "execution:completed":
            case "execution:failed":
            case "execution:cancelled":
              void this.refreshOverview();
              break;
            case "usage:recorded":
              if (event.payload?.usage?.totalTokens) {
                this.setState({
                  totalTokensUsed: this.state.totalTokensUsed + Number(event.payload.usage.totalTokens),
                  totalSpendUsd: this.state.totalSpendUsd + Number(event.payload.usage.estimatedCostUsd ?? 0),
                });
              }
              break;
            case "budget:exceeded":
              this.setAlert(`Budget limit reached for ${event.payload?.scope ?? "task"}`, "warning");
              void this.refreshOverview();
              break;
            case "approval:requested":
              this.setAlert(`Consequential action requires human approval`, "warning");
              void this.refreshOverview();
              break;
          }
        });

        if (typeof sub === "function") {
          this.engineUnsubscribers.push(sub);
        }
      }
    } catch (err) {
      console.warn("Failed to attach engine listeners:", err);
    }
  }

  public destroy(): void {
    for (const unsub of this.engineUnsubscribers) {
      try {
        unsub();
      } catch {}
    }
    this.engineUnsubscribers.length = 0;
    this.listeners.clear();
  }
}
