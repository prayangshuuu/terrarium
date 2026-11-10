/**
 * apps/cli/src/ui/state/ui-state-controller.ts
 *
 * Decoupled UI State Controller and Core Engine boundary adapter.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 * Strictly maintains UI/Core separation: UI observes events and calls engine commands,
 * but never mutates database rows or internal core structures directly.
 */

import { WORKSPACE_AREAS, type WorkspaceId } from "@terrarium/contracts";
import type { CoreEngine } from "@terrarium/core";
import type {
  CommandPaletteItem,
  FocusedRegion,
  UiAlert,
  UiState,
  ViewMode,
} from "./ui-state-types.js";

export interface UiStateControllerOptions {
  readonly engine?: CoreEngine;
  readonly initialWorkspace?: WorkspaceId;
  readonly projectName?: string;
  readonly environment?: "development" | "production" | "test";
}

export class UiStateController {
  private state: UiState;
  private readonly listeners = new Set<(state: UiState) => void>();
  private readonly engineUnsubscribers: (() => void)[] = [];
  private readonly engine?: CoreEngine;

  constructor(options: UiStateControllerOptions = {}) {
    this.engine = options.engine;

    const initialWorkspace = options.initialWorkspace ?? "overview";
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
      engineStatus: this.engine ? "ready" : "disconnected",
      activeAgentCount: 0,
      registeredAgentCount: 0,
      activeTaskCount: 0,
      totalTokensUsed: 0,
      totalSpendUsd: 0.0,
      maxSpendUsd: 10.0,
      projectName: options.projectName ?? "terrarium-workspace",
      environment: options.environment ?? "development",
    };

    if (this.engine) {
      this.bindEngineEvents();
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
      // Already on this workspace; ensure palette/help are closed
      if (this.state.isCommandPaletteOpen || this.state.isHelpModalOpen) {
        this.setState({
          isCommandPaletteOpen: false,
          isHelpModalOpen: false,
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
      focusedRegion: "content",
      paletteQuery: "",
      selectedPaletteIndex: 0,
    });
  }

  /**
   * Navigates back in history, or dismisses an open overlay (palette or help).
   * Returns true if a back action occurred, false if history is at root.
   */
  public goBack(): boolean {
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
      const db = this.engine.db;
      if (db) {
        // Seed initial agent count
        db.agentProfiles.list().then((res: any) => {
          if (res && res.success && Array.isArray(res.data)) {
            this.setState({ registeredAgentCount: res.data.length });
          }
        }).catch(() => {});

        // Seed initial task count
        db.tasks.list().then((res: any) => {
          if (res && res.success && Array.isArray(res.data)) {
            const active = res.data.filter((t: any) => t.status === "running" || t.status === "queued");
            this.setState({ activeTaskCount: active.length });
          }
        }).catch(() => {});
      }

      // Event listener for real-time domain events via telemetry
      if (this.engine.telemetry && typeof this.engine.telemetry.subscribeEvents === "function") {
        const sub = this.engine.telemetry.subscribeEvents((event: any) => {
          if (!event || !event.eventType) return;

          switch (event.eventType) {
            case "task:started":
            case "task:created":
              this.setState({ activeTaskCount: this.state.activeTaskCount + 1 });
              break;
            case "task:completed":
            case "task:failed":
            case "task:cancelled":
              this.setState({ activeTaskCount: Math.max(0, this.state.activeTaskCount - 1) });
              break;
            case "execution:started":
              this.setState({
                activeAgentCount: this.state.activeAgentCount + 1,
                engineStatus: "running",
              });
              break;
            case "execution:completed":
            case "execution:failed":
            case "execution:cancelled":
              this.setState({
                activeAgentCount: Math.max(0, this.state.activeAgentCount - 1),
                engineStatus: "ready",
              });
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
              break;
            case "approval:requested":
              this.setAlert(`Consequential action requires human approval`, "warning");
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
