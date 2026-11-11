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
}
