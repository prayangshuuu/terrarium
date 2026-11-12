/**
 * apps/cli/src/ui/state/ui-state-types.ts
 *
 * UI State interfaces, actions, and workspace navigation definitions.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 */

import {
  type WorkspaceId,
  WORKSPACE_AREAS,
  type AgentProfile,
  type AgentDepartment,
  type AgentLifecycleStatus,
  type OverviewSummary,
  type AgentEcosystemFilter,
  type AgentSelectionRationale,
  type OverviewExecutionItem,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskStep,
  type TaskFilterState,
  type TaskAvailableActions,
  getAvailableTaskActions,
  type TaskPlan,
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
  type CodeAnalysisSummary,
  type CodeFilePatch,
  type BoundedTestRunResult,
  type PatchApplicationResult,
  type PatchRollbackResult,
} from "@terrarium/contracts";

export {
  type WorkspaceId,
  WORKSPACE_AREAS,
  type AgentProfile,
  type AgentDepartment,
  type AgentLifecycleStatus,
  type OverviewSummary,
  type AgentEcosystemFilter,
  type AgentSelectionRationale,
  type OverviewExecutionItem,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskStep,
  type TaskFilterState,
  type TaskAvailableActions,
  getAvailableTaskActions,
  type TaskPlan,
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
  type CodeAnalysisSummary,
  type CodeFilePatch,
  type BoundedTestRunResult,
  type PatchApplicationResult,
  type PatchRollbackResult,
};

export type FocusedRegion = "nav" | "content" | "palette" | "help";

export type ViewMode = "ready" | "loading" | "empty" | "error" | "disconnected";

export interface UiAlert {
  readonly id: string;
  readonly level: "info" | "success" | "warning" | "error";
  readonly message: string;
  readonly timestamp: number;
}

export interface CommandPaletteItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly shortcut?: string;
  readonly category: "navigation" | "action" | "view" | "system";
  readonly action: () => void;
}

/**
 * Creates an empty default OverviewSummary with zero fabricated metrics (A3).
 */
export function createDefaultOverviewSummary(
  engineStatus: "ready" | "running" | "paused" | "error" | "disconnected" = "disconnected",
  now = new Date().toISOString()
): OverviewSummary {
  return {
    engineStatus,
    lastUpdatedAt: now,
    isFresh: false,
    registeredProfileCount: 0,
    activeExecutionCount: 0,
    activeTaskCount: 0,
    queuedTaskCount: 0,
    runningTaskCount: 0,
    completedTaskCount: 0,
    failedTaskCount: 0,
    pendingApprovalCount: 0,
    totalSpendUsd: 0.0,
    maxSpendUsd: 10.0,
    totalTokensUsed: 0,
    departmentCounts: {},
    simulatedPersonaCount: 0,
    recentExecutions: [],
    recentTasks: [],
    pendingApprovals: [],
  };
}

/**
 * Detailed task inspection data package.
 */
export interface TaskDetailData {
  readonly task: Task;
  readonly assignedProfile?: AgentProfile;
  readonly plan?: TaskPlan;
  readonly steps: readonly TaskStep[];
  readonly executions: readonly Execution[];
  readonly approvals: readonly ApprovalRequest[];
  readonly artifacts: readonly Artifact[];
  readonly availableActions: TaskAvailableActions;
  readonly budgetSummary?: {
    readonly usedTokens: number;
    readonly usedSpendUsd: number;
    readonly maxSpendUsd?: number;
  };
}

/**
 * Task creation form input.
 */
export interface TaskCreateFormInput {
  readonly title: string;
  readonly description: string;
  readonly department: AgentDepartment;
  readonly priority: TaskPriority;
  readonly budgetLimitUsd?: number;
}

export function createDefaultTaskFilter(): TaskFilterState {
  return {
    searchQuery: "",
    status: "all",
    priority: "all",
    department: "all",
  };
}

export function createDefaultActivityFeedState(): ActivityFeedState {
  return {
    items: [],
    isConnected: true,
    lastSeenTimestamp: undefined,
    lastSeenSequenceNumber: undefined,
    replayedMissedEventsCount: 0,
  };
}

export interface UiState {
  readonly activeWorkspace: WorkspaceId;
  readonly history: readonly WorkspaceId[];
  readonly isSidebarCollapsed: boolean;
  readonly isCommandPaletteOpen: boolean;
  readonly isHelpModalOpen: boolean;
  readonly focusedRegion: FocusedRegion;
  readonly viewMode: ViewMode;
  readonly errorMessage?: string;
  readonly alert?: UiAlert;
  readonly paletteQuery: string;
  readonly selectedPaletteIndex: number;

  // Engine telemetry & live status indicators
  readonly engineStatus: "ready" | "running" | "paused" | "error" | "disconnected";
  readonly activeAgentCount: number;
  readonly registeredAgentCount: number;
  readonly activeTaskCount: number;
  readonly totalTokensUsed: number;
  readonly totalSpendUsd: number;
  readonly maxSpendUsd?: number;
  readonly projectName: string;
  readonly environment: "development" | "production" | "test";

  // Prompt 15: Real-state Overview summary
  readonly overviewSummary: OverviewSummary;

  // Prompt 15: Agent Ecosystem Directory & Detail inspection
  readonly ecosystemProfiles: readonly AgentProfile[];
  readonly ecosystemFilter: AgentEcosystemFilter;
  readonly selectedAgentIndex: number;
  readonly selectedAgentId: string | null;
  readonly isAgentDetailOpen: boolean;
  readonly selectionRationales: Readonly<Record<string, AgentSelectionRationale>>;
  readonly activeExecutions: readonly OverviewExecutionItem[];
  readonly selectedAgentIds: readonly string[];
  readonly pausedAgentIds: readonly string[];

  // Prompt 16: Task Manager (list, detail, create, plan)
  readonly tasks: readonly Task[];
  readonly taskFilter: TaskFilterState;
  readonly selectedTaskId: string | null;
  readonly selectedTaskIndex: number;
  readonly selectedTaskDetail: TaskDetailData | null;
  readonly taskViewMode: "list" | "detail" | "create";
  readonly isPlanningTask: boolean;

  // Prompt 16: Conversations & Multi-Agent Debates
  readonly sessions: readonly Session[];
  readonly selectedSessionId: string | null;
  readonly selectedSessionIndex: number;
  readonly sessionMessages: readonly ConversationMessageUI[];
  readonly chatDraftText: string;
  readonly isSendingMessage: boolean;

  // Prompt 16: Activity Feed & Missed-Event Replay
  readonly activityFeed: ActivityFeedState;

  // Prompt 17: Engineering Studio (Workspace 6)
  readonly studioPatches: readonly CodeFilePatch[];
  readonly selectedStudioPatchIndex: number;
  readonly selectedStudioPatchId: string | null;
  readonly studioAnalysis: CodeAnalysisSummary | null;
  readonly latestStudioTestRun: BoundedTestRunResult | null;
  readonly isAnalyzingStudio: boolean;
  readonly isApplyingStudioPatch: boolean;
  readonly isRunningStudioTests: boolean;
  readonly studioActiveTab: "analysis" | "patches" | "diff" | "tests" | "sandbox";
}
