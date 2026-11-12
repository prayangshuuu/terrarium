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
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskStep,
  type TaskFilterState,
  type TaskAvailableActions,
  getAvailableTaskActions,
  assertTaskTransition,
  type TaskPlan,
  type PlanStep,
  type Execution,
  type ApprovalRequest,
  type Artifact,
  type Session,
  type SessionMode,
  type SessionStatus,
  type Message,
  type MessageRole,
  type MessageSenderType,
  type ConversationMessageUI,
  type ActivityFeedEventUI,
  type ActivityFeedState,
  resolveAgentLifecycleStatus,
  type TerminalColorName,
  type CodeAnalysisSummary,
  type CodeFilePatch,
  type BoundedTestRunResult,
  type PatchApplicationResult,
  type PatchRollbackResult,
  type Report,
  type ReportType,
} from "@terrarium/contracts";
import type { CoreEngine } from "@terrarium/core";
import {
  type CommandPaletteItem,
  createDefaultOverviewSummary,
  createDefaultTaskFilter,
  createDefaultActivityFeedState,
  type FocusedRegion,
  type TaskDetailData,
  type TaskCreateFormInput,
  type UiAlert,
  type UiState,
  type ViewMode,
  type ReportsActiveTab,
} from "./ui-state-types.js";

export interface UiStateControllerOptions {
  readonly engine?: CoreEngine;
  readonly initialWorkspace?: WorkspaceId;
  readonly projectName?: string;
  readonly environment?: "development" | "production" | "test";
  readonly initialProfiles?: readonly AgentProfile[];
  readonly initialOverviewSummary?: Partial<OverviewSummary>;
  readonly initialTasks?: readonly Task[];
  readonly initialSessions?: readonly Session[];
  readonly initialMessages?: readonly ConversationMessageUI[];
  readonly initialActivityFeed?: readonly ActivityFeedEventUI[];
  readonly initialPatches?: readonly CodeFilePatch[];
  readonly initialStudioAnalysis?: CodeAnalysisSummary | null;
  readonly initialStudioTestRun?: BoundedTestRunResult | null;
  readonly initialReports?: readonly Report[];
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

    const initialTasks = options.initialTasks ?? [];
    const activeTasksCount = initialTasks.filter(
      (t) => t.status === "running" || t.status === "queued"
    ).length;

    const initialOverview: OverviewSummary = {
      ...baseOverview,
      activeTaskCount: activeTasksCount,
      departmentCounts: deptCounts,
      simulatedPersonaCount: simulatedCount,
      ...(options.initialOverviewSummary ?? {}),
      registeredProfileCount:
        options.initialOverviewSummary?.registeredProfileCount ??
        (initialProfiles.length > 0 ? initialProfiles.length : baseOverview.registeredProfileCount),
    };

    const initialSessions = options.initialSessions ?? [];
    const initialMessages = options.initialMessages ?? [];
    const initialActivity = options.initialActivityFeed ?? [];
    const initialPatches = options.initialPatches ?? [];

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

      // Prompt 16 Task Manager State
      tasks: initialTasks,
      taskFilter: createDefaultTaskFilter(),
      selectedTaskId: initialTasks[0]?.id ?? null,
      selectedTaskIndex: 0,
      selectedTaskDetail: null,
      taskViewMode: "list",
      isPlanningTask: false,

      // Prompt 16 Conversations State
      sessions: initialSessions,
      selectedSessionId: initialSessions[0]?.id ?? null,
      selectedSessionIndex: 0,
      sessionMessages: initialMessages,
      chatDraftText: "",
      isSendingMessage: false,

      // Prompt 16 Activity Feed State
      activityFeed: {
        ...createDefaultActivityFeedState(),
        items: initialActivity,
      },

      // Prompt 17: Engineering Studio State
      studioPatches: initialPatches,
      selectedStudioPatchIndex: 0,
      selectedStudioPatchId: initialPatches[0]?.id ?? null,
      studioAnalysis: options.initialStudioAnalysis ?? null,
      latestStudioTestRun: options.initialStudioTestRun ?? null,
      isAnalyzingStudio: false,
      isApplyingStudioPatch: false,
      isRunningStudioTests: false,
      studioActiveTab: "analysis",

      // Prompt 18: Reports & Evidence
      reports: options.initialReports ?? [],
      selectedReportIndex: 0,
      selectedReportId: (options.initialReports ?? [])[0]?.id ?? null,
      selectedReport: (options.initialReports ?? [])[0] ?? null,
      reportsActiveTab: "overview",
      reportFilterType: "all",
      isGeneratingReport: false,
      isSimulatingCustomer: false,
      isExportingReport: false,
      exportedReportPath: null,
    };

    // If initial task exists, initialize its detail
    if (initialTasks[0]) {
      void this.buildTaskDetail(initialTasks[0]);
    }

    if (this.engine) {
      this.bindEngineEvents();
      void this.refreshOverview();
      void this.loadEcosystem();
      void this.loadTasks();
      void this.loadSessions();
      void this.reconnectActivityFeed();
      void this.loadStudioData();
      void this.loadReports();
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
      // Already on this workspace; ensure overlays are dismissed
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
   * Navigates back in history, or dismisses an open overlay.
   */
  public goBack(): boolean {
    if (this.state.isAgentDetailOpen) {
      this.closeAgentDetail();
      return true;
    }

    if (this.state.activeWorkspace === "tasks" && this.state.taskViewMode !== "list") {
      this.setTaskViewMode("list");
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
    nextHistory.pop();
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

  public getAgentLifecycleStatus(profile: AgentProfile): AgentLifecycleStatus {
    const isExecuting = this.state.activeExecutions.some(
      (e) => (e.agentProfileId === profile.id || e.agentSlug === profile.slug) && e.status === "running"
    );
    const isPaused = this.state.pausedAgentIds.includes(profile.id);
    const isSelected = this.state.selectedAgentIds.includes(profile.id);

    return resolveAgentLifecycleStatus(profile, { isExecuting, isPaused, isSelected });
  }

  public getFilteredEcosystemProfiles(): readonly AgentProfile[] {
    const { searchQuery, department, lifecycleStatus } = this.state.ecosystemFilter;
    const q = searchQuery.trim().toLowerCase();

    return this.state.ecosystemProfiles.filter((profile) => {
      if (department !== "all" && profile.department !== department) {
        return false;
      }
      if (lifecycleStatus !== "all") {
        const status = this.getAgentLifecycleStatus(profile);
        if (status !== lifecycleStatus) {
          return false;
        }
      }
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

  public async loadEcosystem(): Promise<void> {
    if (!this.engine) return;

    try {
      let profiles: readonly AgentProfile[] = [];

      if (this.engine.db?.agentProfiles) {
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

  // =========================================================================
  // Task Manager & Execution Controls (Prompt 16)
  // =========================================================================

  public async loadTasks(): Promise<void> {
    if (!this.engine?.db?.tasks) return;

    try {
      const res = await this.engine.db.tasks.list();
      if (res.success && Array.isArray(res.data)) {
        this.setState({ tasks: res.data });
        if (this.state.selectedTaskId) {
          const updated = res.data.find((t) => t.id === this.state.selectedTaskId);
          if (updated) {
            void this.buildTaskDetail(updated);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load tasks:", err);
    }
  }

  public setTaskViewMode(mode: "list" | "detail" | "create"): void {
    this.setState({ taskViewMode: mode });
  }

  public setTaskFilter(filter: Partial<TaskFilterState>): void {
    this.setState({
      taskFilter: { ...this.state.taskFilter, ...filter },
      selectedTaskIndex: 0,
    });
  }

  public resetTaskFilter(): void {
    this.setState({
      taskFilter: createDefaultTaskFilter(),
      selectedTaskIndex: 0,
    });
  }

  public setTaskIndex(index: number): void {
    const filtered = this.getFilteredTasks();
    if (filtered.length === 0) {
      this.setState({ selectedTaskIndex: 0, selectedTaskId: null });
      return;
    }
    const safeIdx = Math.max(0, Math.min(filtered.length - 1, index));
    const target = filtered[safeIdx];
    this.setState({
      selectedTaskIndex: safeIdx,
      selectedTaskId: target ? target.id : null,
    });
  }

  public getFilteredTasks(): readonly Task[] {
    const { searchQuery, status, priority, department } = this.state.taskFilter;
    const q = searchQuery.trim().toLowerCase();

    return this.state.tasks.filter((task) => {
      if (status !== "all" && task.status !== status) return false;
      if (priority !== "all" && task.priority !== priority) return false;
      if (department !== "all" && task.department !== department) return false;
      if (q) {
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description.toLowerCase().includes(q);
        const matchesId = task.id.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesId) return false;
      }
      return true;
    });
  }

  public async selectTask(taskId: string | null): Promise<void> {
    if (!taskId) {
      this.setState({ selectedTaskId: null, selectedTaskDetail: null, taskViewMode: "list" });
      return;
    }

    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    this.setState({ selectedTaskId: taskId, taskViewMode: "detail" });
    await this.buildTaskDetail(task);
  }

  private async buildTaskDetail(task: Task): Promise<void> {
    let assignedProfile: AgentProfile | undefined;
    let plan: TaskPlan | undefined;
    let steps: readonly TaskStep[] = [];
    let executions: readonly Execution[] = [];
    let approvals: readonly ApprovalRequest[] = [];
    let artifacts: readonly Artifact[] = [];
    let budgetSummary: { usedTokens: number; usedSpendUsd: number; maxSpendUsd?: number } | undefined;

    if (task.assignedAgentId) {
      assignedProfile = this.state.ecosystemProfiles.find((p) => p.id === task.assignedAgentId);
      if (!assignedProfile && this.engine?.registry) {
        const pRes = await this.engine.registry.inspect(task.assignedAgentId);
        if (pRes.success) assignedProfile = pRes.data;
      }
    }

    if (this.engine?.db) {
      const db = this.engine.db;
      // Plan
      if (db.plans) {
        const planRes = await db.plans.findByTaskId(task.id);
        if (planRes.success && planRes.data) plan = planRes.data;
      }

      // Steps
      const stepRes = await db.steps.listByTaskId(task.id);
      if (stepRes.success) steps = stepRes.data;

      // Executions
      const execRes = await db.executions.listByTaskId(task.id);
      if (execRes.success) executions = execRes.data;

      // Approvals
      const appRes = await db.approvals.list();
      if (appRes.success) {
        approvals = appRes.data.filter((a) => a.taskId === task.id);
      }

      // Artifacts
      const artRes = await db.artifacts.listByTaskId(task.id);
      if (artRes.success) artifacts = artRes.data;
    }

    // Calculate budget metrics from executions
    let usedTokens = 0;
    let usedSpendUsd = 0;
    for (const e of executions) {
      usedTokens += e.metrics.tokensTotal;
      usedSpendUsd += e.metrics.estimatedCostUsd;
    }
    budgetSummary = {
      usedTokens,
      usedSpendUsd,
      maxSpendUsd: 10.0,
    };

    const detail: TaskDetailData = {
      task,
      assignedProfile,
      plan,
      steps,
      executions,
      approvals,
      artifacts,
      availableActions: getAvailableTaskActions(task),
      budgetSummary,
    };

    this.setState({ selectedTaskDetail: detail });
  }

  // Safe Execution Controls (A2) bounded by assertTaskTransition
  public async pauseTask(taskId: string): Promise<boolean> {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    const actions = getAvailableTaskActions(task);
    if (!actions.canPause) {
      this.setAlert(`Cannot pause task in '${task.status}' state`, "warning");
      return false;
    }

    const transition = assertTaskTransition(task.status, "waiting_for_input");
    if (!transition.success) {
      this.setAlert(`Illegal transition: ${transition.error.message}`, "error");
      return false;
    }

    const updatedTask: Task = {
      ...task,
      status: "waiting_for_input",
      updatedAt: new Date().toISOString(),
    };

    if (this.engine?.db) {
      await this.engine.db.tasks.update(updatedTask);
    }

    const nextTasks = this.state.tasks.map((t) => (t.id === taskId ? updatedTask : t));
    this.setState({ tasks: nextTasks });
    await this.buildTaskDetail(updatedTask);
    this.setAlert(`Task paused (awaiting user input)`, "info");
    this.recordActivityEvent({
      eventType: "task:status_changed",
      entityType: "task",
      entityId: taskId,
      summary: `Task paused: ${task.title}`,
      level: "warn",
    });
    return true;
  }

  public async resumeTask(taskId: string): Promise<boolean> {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    const actions = getAvailableTaskActions(task);
    if (!actions.canResume) {
      this.setAlert(`Cannot resume task in '${task.status}' state`, "warning");
      return false;
    }

    const transition = assertTaskTransition(task.status, "running");
    if (!transition.success) {
      this.setAlert(`Illegal transition: ${transition.error.message}`, "error");
      return false;
    }

    const updatedTask: Task = {
      ...task,
      status: "running",
      updatedAt: new Date().toISOString(),
    };

    if (this.engine?.db) {
      await this.engine.db.tasks.update(updatedTask);
    }

    const nextTasks = this.state.tasks.map((t) => (t.id === taskId ? updatedTask : t));
    this.setState({ tasks: nextTasks });
    await this.buildTaskDetail(updatedTask);
    this.setAlert(`Task resumed execution`, "info");
    this.recordActivityEvent({
      eventType: "task:status_changed",
      entityType: "task",
      entityId: taskId,
      summary: `Task resumed: ${task.title}`,
      level: "info",
    });
    return true;
  }

  public async cancelTask(taskId: string, reason = "Cancelled by user"): Promise<boolean> {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    const actions = getAvailableTaskActions(task);
    if (!actions.canCancel) {
      this.setAlert(`Cannot cancel task in terminal state '${task.status}'`, "warning");
      return false;
    }

    const transition = assertTaskTransition(task.status, "cancelled");
    if (!transition.success) {
      this.setAlert(`Illegal transition: ${transition.error.message}`, "error");
      return false;
    }

    const updatedTask: Task = {
      ...task,
      status: "cancelled",
      failureReason: reason,
      updatedAt: new Date().toISOString(),
    };

    if (this.engine?.db) {
      await this.engine.db.tasks.update(updatedTask);
    }

    const nextTasks = this.state.tasks.map((t) => (t.id === taskId ? updatedTask : t));
    this.setState({ tasks: nextTasks });
    await this.buildTaskDetail(updatedTask);
    this.setAlert(`Task cancelled: ${reason}`, "warning");
    this.recordActivityEvent({
      eventType: "task:cancelled",
      entityType: "task",
      entityId: taskId,
      summary: `Task cancelled: ${task.title} (${reason})`,
      level: "warn",
    });
    return true;
  }

  public async retryTask(taskId: string): Promise<boolean> {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    const actions = getAvailableTaskActions(task);
    if (!actions.canRetry) {
      this.setAlert(`Cannot retry task in state '${task.status}'`, "warning");
      return false;
    }

    const transition = assertTaskTransition(task.status, "queued");
    if (!transition.success) {
      this.setAlert(`Illegal transition: ${transition.error.message}`, "error");
      return false;
    }

    const updatedTask: Task = {
      ...task,
      status: "queued",
      failureReason: undefined,
      updatedAt: new Date().toISOString(),
    };

    if (this.engine?.db) {
      await this.engine.db.tasks.update(updatedTask);
    }

    const nextTasks = this.state.tasks.map((t) => (t.id === taskId ? updatedTask : t));
    this.setState({ tasks: nextTasks });
    await this.buildTaskDetail(updatedTask);
    this.setAlert(`Task re-queued for execution`, "info");
    this.recordActivityEvent({
      eventType: "task:created",
      entityType: "task",
      entityId: taskId,
      summary: `Task re-queued for execution: ${task.title}`,
      level: "info",
    });
    return true;
  }

  public async createTask(input: TaskCreateFormInput): Promise<Task | null> {
    this.setState({ isPlanningTask: true });

    try {
      const now = new Date().toISOString();
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      let planSteps: TaskStep[] = [];
      let taskPlan: TaskPlan | undefined;
      if (this.engine?.intake) {
        const planRes = await this.engine.intake.processIntake({
          prompt: `${input.title}\n\n${input.description}`,
          explicitDepartment: input.department,
          budgetCapUsd: input.budgetLimitUsd,
        });
        if (planRes.success && planRes.data.plan) {
          taskPlan = {
            ...planRes.data.plan,
            taskId,
          };
          if (taskPlan.steps) {
            planSteps = taskPlan.steps.map((s: PlanStep, idx: number) => ({
              id: s.id,
              taskId,
              stepIndex: idx + 1,
              title: s.title,
              description: s.description,
              assignedAgentId: s.candidateAgentSlugs?.[0],
              status: "pending" as const,
            }));
          }
        }
      }

      const newTask: Task = {
        id: taskId,
        title: input.title.trim(),
        description: input.description.trim(),
        department: input.department,
        priority: input.priority,
        status: "planned",
        contextRefs: [],
        expectedDeliverables: [],
        delegationDepth: 0,
        createdAt: now,
        updatedAt: now,
      };

      if (this.engine?.db) {
        await this.engine.db.tasks.create(newTask);
        if (taskPlan && this.engine.db.plans) {
          await this.engine.db.plans.create(taskPlan);
        }
        for (const step of planSteps) {
          await this.engine.db.steps.create(step);
        }
      }

      const nextTasks = [newTask, ...this.state.tasks];
      this.setState({
        tasks: nextTasks,
        selectedTaskId: taskId,
        taskViewMode: "detail",
        isPlanningTask: false,
      });

      await this.buildTaskDetail(newTask);
      this.setAlert(`Task created & planned: ${newTask.title}`, "success");
      this.recordActivityEvent({
        eventType: "task:created",
        entityType: "task",
        entityId: taskId,
        summary: `Created task: ${newTask.title}`,
        level: "info",
      });

      return newTask;
    } catch (err) {
      console.warn("Failed to create task:", err);
      this.setAlert("Failed to plan task", "error");
      this.setState({ isPlanningTask: false });
      return null;
    }
  }

  // =========================================================================
  // Conversations & Multi-Agent Debates (Prompt 16)
  // =========================================================================

  public async loadSessions(): Promise<void> {
    if (!this.engine?.db?.sessions) return;

    try {
      const res = await this.engine.db.sessions.list();
      if (res.success && Array.isArray(res.data)) {
        this.setState({ sessions: res.data });
        if (res.data[0] && !this.state.selectedSessionId) {
          await this.selectSession(res.data[0].id);
        }
      }
    } catch (err) {
      console.warn("Failed to load sessions:", err);
    }
  }

  public async selectSession(sessionId: string | null): Promise<void> {
    if (!sessionId) {
      this.setState({ selectedSessionId: null, sessionMessages: [] });
      return;
    }

    const idx = this.state.sessions.findIndex((s) => s.id === sessionId);
    this.setState({
      selectedSessionId: sessionId,
      selectedSessionIndex: idx >= 0 ? idx : 0,
    });

    if (this.engine?.db?.sessions) {
      const msgRes = await this.engine.db.sessions.getMessages(sessionId, 50);
      if (msgRes.success && Array.isArray(msgRes.data)) {
        const uiMsgs: ConversationMessageUI[] = msgRes.data.map((m) => {
          const profile = this.state.ecosystemProfiles.find((p) => p.id === m.senderId);
          const isSimulated =
            profile?.department === "customer_intelligence" || !!profile?.personaAttributes;
          return {
            id: m.id,
            sessionId: m.sessionId,
            senderId: m.senderId,
            senderName: profile?.displayName || profile?.name || m.senderId,
            senderRole: profile?.role,
            senderDepartment: profile?.department,
            senderType: m.senderType,
            role: m.role,
            content: m.content,
            timestamp: m.createdAt,
            isSimulatedPersona: isSimulated,
            citations: m.citations,
          };
        });
        this.setState({ sessionMessages: uiMsgs });
      }
    }
  }

  public setSessionIndex(index: number): void {
    if (this.state.sessions.length === 0) return;
    const safeIdx = Math.max(0, Math.min(this.state.sessions.length - 1, index));
    const target = this.state.sessions[safeIdx];
    if (target) {
      void this.selectSession(target.id);
    }
  }

  public setChatDraft(text: string): void {
    this.setState({ chatDraftText: text });
  }

  public async createSession(
    title: string,
    participantAgentIds: string[],
    mode: SessionMode = "interactive"
  ): Promise<Session | null> {
    const now = new Date().toISOString();
    const newSession: Session = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      mode,
      status: "active",
      participantAgentIds,
      createdAt: now,
      updatedAt: now,
    };

    if (this.engine?.db?.sessions) {
      await this.engine.db.sessions.create(newSession);
    }

    const nextSessions = [newSession, ...this.state.sessions];
    this.setState({
      sessions: nextSessions,
      selectedSessionId: newSession.id,
      selectedSessionIndex: 0,
      sessionMessages: [],
    });

    this.setAlert(`Started conversation: ${newSession.title}`, "info");
    return newSession;
  }

  public async sendMessage(
    content: string,
    options?: {
      senderId?: string;
      senderName?: string;
      senderType?: MessageSenderType;
      role?: MessageRole;
      isSimulated?: boolean;
      disagreements?: readonly { specialist: string; argument: string }[];
      uncertaintyLevel?: "low" | "medium" | "high" | "critical";
      uncertaintyExplanation?: string;
      toolCalls?: readonly { name: string; riskLevel: any; isConsequential: boolean }[];
    }
  ): Promise<void> {
    const text = content.trim();
    if (!text) return;

    const sessionId = this.state.selectedSessionId ?? "sess_default";
    const now = new Date().toISOString();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const senderType = options?.senderType ?? "user";
    const role = options?.role ?? (senderType === "user" ? "user" : "assistant");
    const senderName = options?.senderName ?? (senderType === "user" ? "User" : "Agent");

    const newMsg: ConversationMessageUI = {
      id: msgId,
      sessionId,
      senderId: options?.senderId ?? "user",
      senderName,
      senderType,
      role,
      content: text,
      timestamp: now,
      isSimulatedPersona: options?.isSimulated ?? false,
      disagreements: options?.disagreements,
      uncertaintyLevel: options?.uncertaintyLevel,
      uncertaintyExplanation: options?.uncertaintyExplanation,
      toolCalls: options?.toolCalls,
    };

    if (this.engine?.db?.sessions) {
      await this.engine.db.sessions.addMessage({
        id: msgId,
        sessionId,
        senderId: newMsg.senderId,
        senderType,
        role,
        content: text,
        createdAt: now,
        updatedAt: now,
      });
    }

    this.setState({
      sessionMessages: [...this.state.sessionMessages, newMsg],
      chatDraftText: "",
    });
  }

  // =========================================================================
  // Activity Feed & Missed-Event Replay (Prompt 16)
  // =========================================================================

  public recordActivityEvent(rawEvent: any): void {
    if (!rawEvent) return;

    const id = rawEvent.id ?? `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const eventType = rawEvent.eventType ?? "system:notice";
    const timestamp = rawEvent.timestamp ?? new Date().toISOString();
    const source = rawEvent.source ?? "system";
    const entityType = rawEvent.entityType ?? "unknown";
    const entityId = rawEvent.entityId ?? "";
    const level: "info" | "warn" | "error" | "debug" =
      rawEvent.level ??
      (eventType.includes("failed") || eventType.includes("error") || eventType.includes("rejected")
        ? "error"
        : eventType.includes("warning") || eventType.includes("exceeded") || eventType.includes("requested")
        ? "warn"
        : "info");

    let glyph = "●";
    let color: TerminalColorName = "cyan";

    if (eventType.startsWith("task:")) {
      glyph = "📋";
      color = "blue";
    } else if (eventType.startsWith("execution:")) {
      glyph = "▶";
      color = "green";
    } else if (eventType.startsWith("approval:")) {
      glyph = "🔒";
      color = "yellow";
    } else if (eventType.startsWith("budget:")) {
      glyph = "💰";
      color = "yellow";
    } else if (eventType.startsWith("tool:")) {
      glyph = "⚡";
      color = "cyan";
    } else if (eventType.startsWith("memory:")) {
      glyph = "🧠";
      color = "magenta";
    }

    if (level === "error") color = "red";
    else if (level === "warn") color = "yellow";

    const summary =
      rawEvent.payload?.description ??
      rawEvent.payload?.message ??
      rawEvent.summary ??
      `${eventType} on ${entityType} ${entityId}`;

    const newEntry: ActivityFeedEventUI = {
      id,
      eventType,
      timestamp,
      sequenceNumber: rawEvent.sequenceNumber ?? this.state.activityFeed.items.length + 1,
      source,
      entityType,
      entityId,
      summary: String(summary),
      level,
      glyph,
      color,
    };

    if (this.state.activityFeed.items.some((item) => item.id === id)) {
      return;
    }

    const nextItems = [newEntry, ...this.state.activityFeed.items].slice(0, 100);
    this.setState({
      activityFeed: {
        ...this.state.activityFeed,
        items: nextItems,
        lastSeenTimestamp: timestamp,
        lastSeenSequenceNumber: newEntry.sequenceNumber,
      },
    });
  }

  public async reconnectActivityFeed(): Promise<number> {
    if (!this.engine?.db?.events) {
      this.setState({
        activityFeed: {
          ...this.state.activityFeed,
          isConnected: false,
        },
      });
      return 0;
    }

    try {
      const queryRes = await this.engine.db.events.query({
        limit: 50,
      });

      if (!queryRes.success || !Array.isArray(queryRes.data)) {
        return 0;
      }

      const existingIds = new Set(this.state.activityFeed.items.map((i) => i.id));
      const missedEvents = queryRes.data.filter((e) => !existingIds.has(e.id));

      if (missedEvents.length === 0) {
        this.setState({
          activityFeed: {
            ...this.state.activityFeed,
            isConnected: true,
          },
        });
        return 0;
      }

      const sorted = [...missedEvents].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      for (const ev of sorted) {
        this.recordActivityEvent(ev);
      }

      const replayedCount = this.state.activityFeed.replayedMissedEventsCount + missedEvents.length;
      this.setState({
        activityFeed: {
          ...this.state.activityFeed,
          isConnected: true,
          replayedMissedEventsCount: replayedCount,
        },
      });

      return missedEvents.length;
    } catch {
      this.setState({
        activityFeed: {
          ...this.state.activityFeed,
          isConnected: false,
        },
      });
      return 0;
    }
  }

  // =========================================================================
  // Overview Metrics Refresh (Prompt 15)
  // =========================================================================

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

      if (db?.agentProfiles) {
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

      let queuedTasks = 0;
      let runningTasks = 0;
      let completedTasks = 0;
      let failedTasks = 0;
      const recentTasks: OverviewTaskItem[] = [];

      if (db?.tasks) {
        const tasksRes = await db.tasks.list();
        if (tasksRes.success && Array.isArray(tasksRes.data)) {
          for (const t of tasksRes.data) {
            if (t.status === "queued") queuedTasks++;
            else if (t.status === "running") runningTasks++;
            else if (t.status === "completed") completedTasks++;
            else if (t.status === "failed") failedTasks++;
          }

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

      let activeExecutionsCount = 0;
      const recentExecutions: OverviewExecutionItem[] = [];

      if (db?.executions && typeof db.executions.list === "function") {
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

      let pendingApprovalsCount = 0;
      const pendingApprovals: OverviewApprovalItem[] = [];

      if (db?.approvals && typeof db.approvals.list === "function") {
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

  public getCommandPaletteItems(): CommandPaletteItem[] {
    const items: CommandPaletteItem[] = [
      ...Object.values(WORKSPACE_AREAS).map((area) => ({
        id: `nav-${area.id}`,
        title: `Go to ${area.label}`,
        subtitle: area.description,
        shortcut: `[${area.shortcut}]`,
        category: "navigation" as const,
        action: () => this.navigate(area.id),
      })),
      {
        id: "action-create-task",
        title: "Create & Plan Task",
        subtitle: "Open task intake form to plan new agent workload",
        shortcut: "[c]",
        category: "action",
        action: () => {
          this.navigate("tasks");
          this.setTaskViewMode("create");
        },
      },
      {
        id: "action-filter-running-tasks",
        title: "Filter Tasks: Running & Queued",
        subtitle: "View active tasks progressing through pipeline",
        category: "action",
        action: () => {
          this.navigate("tasks");
          this.setTaskFilter({ status: "running" });
        },
      },
      {
        id: "action-view-reports",
        title: "View Reports & Intelligence",
        subtitle: "Inspect multi-agent reports, provenance trails, and customer simulations",
        shortcut: "[8]",
        category: "view",
        action: () => {
          this.navigate("reports");
        },
      },
      {
        id: "action-simulate-customer",
        title: "Simulate Customer Research",
        subtitle: "Run synthetic customer persona research simulation",
        category: "action",
        action: () => {
          this.navigate("reports");
          void this.simulateCustomerResearch({
            concept: "Terrarium Multi-Agent CLI and OpenTUI Orchestration Platform",
          });
        },
      },
      {
        id: "action-export-report",
        title: "Export Current Report to Workspace",
        subtitle: "Save structured Markdown report to reports/ directory",
        shortcut: "[e]",
        category: "action",
        action: () => {
          void this.exportReport();
        },
      },
      {
        id: "action-reconnect-activity",
        title: "Reconnect Activity Feed",
        subtitle: "Replay missed events from persistence log",
        category: "action",
        action: () => {
          void this.reconnectActivityFeed();
        },
      },
      {
        id: "action-refresh-overview",
        title: "Refresh Overview Metrics",
        subtitle: "Re-query database and engine runtime for real-state pulse",
        shortcut: "[r]",
        category: "action",
        action: () => {
          void this.refreshOverview();
          void this.loadEcosystem();
          void this.loadTasks();
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
        id: "studio-scan",
        title: "Analyze Repository",
        subtitle: "Scan project tree, detect languages, entry points, and protected files",
        shortcut: "[s]",
        category: "action",
        action: () => void this.analyzeRepository(),
      },
      {
        id: "studio-test",
        title: "Run Bounded Tests",
        subtitle: "Execute workspace tests within execution boundary",
        shortcut: "[t]",
        category: "action",
        action: () => void this.runStudioTests(),
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

  // =========================================================================
  // Prompt 17: Engineering Studio State & Operations (A1, A2, A4, A5)
  // =========================================================================

  /**
   * Refreshes studio patches, analysis summary, and test results from core engine.
   */
  public async loadStudioData(): Promise<void> {
    if (!this.engine?.studio) return;

    try {
      const patches = this.engine.studio.listPatches();
      const analysis = this.engine.studio.getLatestAnalysis();
      const testRun = this.engine.studio.getLatestTestRun();

      const selectedId =
        this.state.selectedStudioPatchId && patches.some((p) => p.id === this.state.selectedStudioPatchId)
          ? this.state.selectedStudioPatchId
          : patches[0]?.id ?? null;

      const selectedIdx = patches.findIndex((p) => p.id === selectedId);

      this.setState({
        studioPatches: patches,
        selectedStudioPatchId: selectedId,
        selectedStudioPatchIndex: Math.max(0, selectedIdx),
        studioAnalysis: analysis,
        latestStudioTestRun: testRun,
      });
    } catch (err) {
      console.warn("Failed to load studio data:", err);
    }
  }

  /**
   * Switches active tab in Engineering Studio view.
   */
  public setStudioActiveTab(tab: "analysis" | "patches" | "diff" | "tests" | "sandbox"): void {
    this.setState({ studioActiveTab: tab });
  }

  /**
   * Selects a studio patch by index or patchId.
   */
  public selectStudioPatch(indexOrId: number | string): void {
    const patches = this.state.studioPatches;
    if (patches.length === 0) return;

    let targetIdx = 0;
    let targetId: string | null = null;

    if (typeof indexOrId === "number") {
      targetIdx = Math.max(0, Math.min(indexOrId, patches.length - 1));
      targetId = patches[targetIdx]?.id ?? null;
    } else {
      const foundIdx = patches.findIndex((p) => p.id === indexOrId);
      if (foundIdx !== -1) {
        targetIdx = foundIdx;
        targetId = indexOrId;
      }
    }

    this.setState({
      selectedStudioPatchIndex: targetIdx,
      selectedStudioPatchId: targetId,
    });
  }

  /**
   * Triggers repository static analysis scan.
   */
  public async analyzeRepository(): Promise<void> {
    if (!this.engine?.studio) {
      this.setAlert("No engine attached to analyze repository", "warning");
      return;
    }

    this.setState({ isAnalyzingStudio: true });
    try {
      const analysis = await this.engine.studio.analyzeRepository();
      this.setState({
        studioAnalysis: analysis,
        isAnalyzingStudio: false,
      });
      this.setAlert(
        `Repository analysis complete: ${analysis.languages.length} languages, ${analysis.frameworks.length} frameworks`,
        "success"
      );
    } catch (err: unknown) {
      this.setState({ isAnalyzingStudio: false });
      this.setAlert(`Repository analysis failed: ${String(err)}`, "error");
    }
  }

  /**
   * Proposes a new code patch with unified diff and creates an approval gate.
   */
  public async proposeStudioPatch(input: {
    filePath: string;
    proposedContent: string;
    rationale: string;
    taskId?: string;
  }): Promise<void> {
    if (!this.engine?.studio) return;

    const res = await this.engine.studio.proposePatch(input);
    if (res.success) {
      await this.loadStudioData();
      this.selectStudioPatch(res.data.id);
      this.setStudioActiveTab("diff");
      this.setAlert(`Patch proposed for '${input.filePath}'. Consequential approval gate created.`, "info");
    } else {
      this.setAlert(`Failed to propose patch: ${res.error.message}`, "error");
    }
  }

  /**
   * Approves and applies a patch to the working tree.
   */
  public async approveAndApplyStudioPatch(patchId: string): Promise<boolean> {
    if (!this.engine?.studio) {
      // In-memory fallback
      const patches = this.state.studioPatches.map((p) =>
        p.id === patchId
          ? {
              ...p,
              status: "applied" as const,
              appliedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : p
      );
      this.setState({ studioPatches: patches });
      this.setAlert(`Patch '${patchId}' approved and applied (in-memory mode).`, "success");
      return true;
    }

    this.setState({ isApplyingStudioPatch: true });
    try {
      // 1. Approve
      await this.engine.studio.approvePatch(patchId, "Approved via Engineering Studio UI");

      // 2. Apply
      const appRes = await this.engine.studio.applyPatch(patchId);
      this.setState({ isApplyingStudioPatch: false });

      if (appRes.success) {
        await this.loadStudioData();
        this.setAlert(`✓ Patch applied to '${appRes.filePath}'. ${appRes.rollbackGuidance}`, "success");
        return true;
      } else {
        await this.loadStudioData();
        this.setAlert(`✗ Failed to apply patch: ${appRes.error}`, "error");
        return false;
      }
    } catch (err: unknown) {
      this.setState({ isApplyingStudioPatch: false });
      this.setAlert(`Error applying patch: ${String(err)}`, "error");
      return false;
    }
  }

  /**
   * Rejects a proposed patch.
   */
  public async rejectStudioPatch(patchId: string, reason = "Rejected via Engineering Studio UI"): Promise<boolean> {
    if (!this.engine?.studio) {
      const patches = this.state.studioPatches.map((p) =>
        p.id === patchId
          ? {
              ...p,
              status: "rejected" as const,
              updatedAt: new Date().toISOString(),
            }
          : p
      );
      this.setState({ studioPatches: patches });
      this.setAlert(`Patch '${patchId}' rejected.`, "info");
      return true;
    }

    try {
      const res = await this.engine.studio.rejectPatch(patchId, reason);
      await this.loadStudioData();
      if (res.success) {
        this.setAlert(`Patch '${patchId}' rejected.`, "info");
        return true;
      } else {
        this.setAlert(`Failed to reject patch: ${res.error.message}`, "error");
        return false;
      }
    } catch (err: unknown) {
      this.setAlert(`Error rejecting patch: ${String(err)}`, "error");
      return false;
    }
  }

  /**
   * Rolls back an applied patch.
   */
  public async rollbackStudioPatch(patchId: string): Promise<boolean> {
    if (!this.engine?.studio) {
      const patches = this.state.studioPatches.map((p) =>
        p.id === patchId
          ? {
              ...p,
              status: "rolled_back" as const,
              rolledBackAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : p
      );
      this.setState({ studioPatches: patches });
      this.setAlert(`Patch '${patchId}' rolled back (in-memory mode).`, "warning");
      return true;
    }

    try {
      const res = await this.engine.studio.rollbackPatch(patchId);
      await this.loadStudioData();
      if (res.success) {
        this.setAlert(`✓ Patch '${patchId}' rolled back. Original file content restored.`, "warning");
        return true;
      } else {
        this.setAlert(`✗ Failed to rollback patch: ${res.error}`, "error");
        return false;
      }
    } catch (err: unknown) {
      this.setAlert(`Error rolling back patch: ${String(err)}`, "error");
      return false;
    }
  }

  /**
   * Executes bounded test run.
   */
  public async runStudioTests(command?: string, timeoutMs?: number): Promise<void> {
    if (!this.engine?.studio) {
      this.setAlert("No engine attached to run bounded tests", "warning");
      return;
    }

    this.setState({ isRunningStudioTests: true });
    try {
      const result = await this.engine.studio.runBoundedTests(command, timeoutMs);
      this.setState({
        latestStudioTestRun: result,
        isRunningStudioTests: false,
      });

      if (result.passed) {
        this.setAlert(`✓ Tests passed: ${result.passedTests}/${result.totalTests} in ${result.durationMs}ms`, "success");
      } else if (result.timedOut) {
        this.setAlert(`⚠ Test run timed out after ${result.durationMs}ms`, "error");
      } else {
        this.setAlert(`✗ Tests failed (${result.failedTests} failed, exit code ${result.exitCode})`, "error");
      }
    } catch (err: unknown) {
      this.setState({ isRunningStudioTests: false });
      this.setAlert(`Failed to execute bounded tests: ${String(err)}`, "error");
    }
  }

  private bindEngineEvents(): void {
    if (!this.engine) return;

    try {
      if (this.engine.telemetry && typeof this.engine.telemetry.subscribeEvents === "function") {
        const sub = this.engine.telemetry.subscribeEvents((event: any) => {
          if (!event || !event.eventType) return;

          // Record into observable activity feed
          this.recordActivityEvent(event);

          switch (event.eventType) {
            case "task:started":
            case "task:created":
            case "task:completed":
            case "task:failed":
            case "task:cancelled":
              void this.refreshOverview();
              void this.loadTasks();
              break;
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

  // =========================================================================
  // Prompt 18: Reports & Intelligence Methods
  // =========================================================================

  /**
   * Loads reports from the engine's ReportService into UI state.
   */
  public async loadReports(): Promise<void> {
    if (!this.engine?.reports) return;
    try {
      const res = await this.engine.reports.listReports();
      if (res.success) {
        const reports = res.data;
        const currentSelectedId = this.state.selectedReportId;
        const currentReport = reports.find((r) => r.id === currentSelectedId) ?? reports[0] ?? null;
        const selectedIndex = currentReport ? reports.findIndex((r) => r.id === currentReport.id) : 0;
        this.setState({
          reports,
          selectedReport: currentReport,
          selectedReportId: currentReport?.id ?? null,
          selectedReportIndex: Math.max(0, selectedIndex),
        });
      }
    } catch (err) {
      console.warn("Failed to load reports:", err);
    }
  }

  /**
   * Switches active tab in Reports view.
   */
  public setReportsActiveTab(tab: ReportsActiveTab): void {
    this.setState({ reportsActiveTab: tab });
  }

  /**
   * Sets filter for report types.
   */
  public setReportFilterType(filter: ReportType | "all"): void {
    this.setState({ reportFilterType: filter });
  }

  /**
   * Selects a report by index.
   */
  public selectReport(index: number): void {
    const reports = this.state.reports;
    if (index >= 0 && index < reports.length) {
      const rep = reports[index]!;
      this.setState({
        selectedReportIndex: index,
        selectedReportId: rep.id,
        selectedReport: rep,
      });
    }
  }

  /**
   * Selects a report by ID.
   */
  public selectReportById(id: string): void {
    const idx = this.state.reports.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.selectReport(idx);
    }
  }

  /**
   * Generates a report from task artifacts.
   */
  public async generateReport(options: {
    taskId: string;
    title: string;
    reportType?: ReportType;
  }): Promise<void> {
    if (!this.engine?.reports) return;
    this.setState({ isGeneratingReport: true });
    try {
      const res = await this.engine.reports.generateReport(options);
      if (res.success) {
        this.setAlert(`Generated report: ${res.data.title}`, "success");
        await this.loadReports();
        this.selectReportById(res.data.id);
      } else {
        this.setAlert(`Report generation failed: ${res.error.message}`, "error");
      }
    } finally {
      this.setState({ isGeneratingReport: false });
    }
  }

  /**
   * Runs customer persona research simulation.
   */
  public async simulateCustomerResearch(options: {
    concept: string;
    scenario?: string;
  }): Promise<void> {
    if (!this.engine?.reports) return;
    this.setState({ isSimulatingCustomer: true });
    try {
      const res = await this.engine.reports.simulateCustomerResearch(options);
      if (res.success) {
        this.setAlert(`Simulated customer research completed for ${res.data.title}`, "success");
        await this.loadReports();
        this.selectReportById(res.data.id);
      } else {
        this.setAlert(`Simulation failed: ${res.error.message}`, "error");
      }
    } finally {
      this.setState({ isSimulatingCustomer: false });
    }
  }

  /**
   * Exports the selected or specified report to disk within the workspace root.
   */
  public async exportReport(reportId?: string, outputFilePath?: string): Promise<void> {
    if (!this.engine?.reports) return;
    const targetId = reportId || this.state.selectedReportId;
    if (!targetId) {
      this.setAlert("No report selected for export", "warning");
      return;
    }

    const defaultPath = `reports/${targetId}.md`;
    const targetPath = outputFilePath || defaultPath;

    this.setState({ isExportingReport: true });
    try {
      const res = await this.engine.reports.exportReport(targetId, {
        outputFilePath: targetPath,
      });
      if (res.success) {
        this.setState({ exportedReportPath: res.data.exportedPath });
        this.setAlert(`Exported report to: ${res.data.exportedPath}`, "success");
      } else {
        this.setAlert(`Export failed: ${res.error.message}`, "error");
      }
    } finally {
      this.setState({ isExportingReport: false });
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
