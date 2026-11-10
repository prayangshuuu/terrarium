/**
 * apps/cli/src/ui/state/ui-state-types.ts
 *
 * UI State interfaces, actions, and workspace navigation definitions.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 */

import { type WorkspaceId, WORKSPACE_AREAS } from "@terrarium/contracts";

export { type WorkspaceId, WORKSPACE_AREAS };

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
}
