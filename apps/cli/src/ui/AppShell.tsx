/**
 * apps/cli/src/ui/AppShell.tsx
 *
 * Primary OpenTUI application shell, keyboard navigation router, and layout composer.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer),
 * with safety boundaries from A3 and architecture separation from A1 & A2.
 */

import React, { useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { type KeyEvent } from "@opentui/core";
import { WORKSPACE_IDS, type WorkspaceId } from "@terrarium/contracts";
import { THEME_COLORS } from "./tokens/colors.js";
import { useTerrariumUi } from "./state/ui-context.js";
import { Header } from "./components/Header.js";
import { NavigationBar } from "./components/NavigationBar.js";
import { StatusBar } from "./components/StatusBar.js";
import { Breadcrumbs } from "./components/Breadcrumbs.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { HelpModal } from "./components/HelpModal.js";
import { ResponsiveContainer } from "./components/ResponsiveContainer.js";
import { LoadingState, ErrorState, DisconnectedState } from "./components/ViewStates.js";
import { OverviewView } from "./views/OverviewView.js";
import { EcosystemView } from "./views/EcosystemView.js";
import { TasksView } from "./views/TasksView.js";
import { ConversationsView } from "./views/ConversationsView.js";
import { StudioView } from "./views/StudioView.js";
import { ReportsView } from "./views/ReportsView.js";
import { SettingsView } from "./views/SettingsView.js";
import { PlaceholderView } from "./views/PlaceholderView.js";

export interface AppShellProps {
  readonly version?: string;
  readonly forcedWidth?: number;
  readonly forcedHeight?: number;
  readonly onQuit?: () => void;
}

export function AppShell({
  version = "0.1.0",
  forcedWidth,
  forcedHeight,
  onQuit,
}: AppShellProps) {
  const { state, controller } = useTerrariumUi();

  // Keyboard Navigation Router
  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      // If focused on composer, let PromptComposer handle its own keyboard events
      if (state.focusedRegion === "composer") {
        return;
      }

      const keyName = event.name.toLowerCase();

      // 1. Command Palette handling
      if (state.isCommandPaletteOpen) {
        if (keyName === "escape") {
          controller.closeCommandPalette();
          return;
        }

        const items = controller.getCommandPaletteItems();
        if (keyName === "up") {
          const nextIdx = Math.max(0, state.selectedPaletteIndex - 1);
          controller.setPaletteIndex(nextIdx);
          return;
        }

        if (keyName === "down") {
          const nextIdx = Math.min(items.length - 1, state.selectedPaletteIndex + 1);
          controller.setPaletteIndex(nextIdx);
          return;
        }

        if (keyName === "return" || keyName === "enter") {
          const selectedItem = items[state.selectedPaletteIndex];
          if (selectedItem) {
            controller.closeCommandPalette();
            selectedItem.action();
          }
          return;
        }

        if (keyName === "backspace") {
          controller.setPaletteQuery(state.paletteQuery.slice(0, -1));
          return;
        }

        // Printable single characters for filtering
        if (
          !event.ctrl &&
          !event.meta &&
          event.sequence &&
          event.sequence.length === 1 &&
          event.sequence >= " " &&
          event.sequence <= "~"
        ) {
          controller.setPaletteQuery(state.paletteQuery + event.sequence);
          return;
        }

        return;
      }

      // 2. Help Modal handling
      if (state.isHelpModalOpen) {
        if (keyName === "escape" || keyName === "question" || event.sequence === "?") {
          controller.closeHelp();
        }
        return;
      }

      // 3. Global Shortcuts
      // Command Palette toggle: Ctrl+K or '/'
      if ((event.ctrl && keyName === "k") || (!event.ctrl && !event.meta && event.sequence === "/")) {
        controller.openCommandPalette();
        return;
      }

      // Help toggle: '?' or F1
      if ((!event.ctrl && !event.meta && event.sequence === "?") || keyName === "f1") {
        controller.openHelp();
        return;
      }

      // Sidebar toggle: Ctrl+B
      if (event.ctrl && keyName === "b") {
        controller.toggleSidebar();
        return;
      }

      // Back navigation: Esc, 'b', or Backspace
      if (keyName === "escape" || (!event.ctrl && !event.meta && (keyName === "b" || keyName === "backspace"))) {
        const didGoBack = controller.goBack();
        if (didGoBack) {
          return;
        }
      }

      // Direct Workspace Hotkeys: 1 through 9, and 0
      if (!event.ctrl && !event.meta) {
        if (event.sequence >= "1" && event.sequence <= "9") {
          const idx = parseInt(event.sequence, 10) - 1;
          const targetId = WORKSPACE_IDS[idx];
          if (targetId) {
            controller.navigate(targetId);
            return;
          }
        }
        if (event.sequence === "0") {
          const targetId = WORKSPACE_IDS[9]; // 10th item (settings)
          if (targetId) {
            controller.navigate(targetId);
            return;
          }
        }
      }

      // Quit: 'q' or Ctrl+C
      if ((!event.ctrl && !event.meta && keyName === "q") || (event.ctrl && keyName === "c")) {
        if (onQuit) {
          onQuit();
        }
        return;
      }

      // Focus Switching: Tab / Shift+Tab
      if (keyName === "tab") {
        const nextRegion = state.focusedRegion === "nav" ? "content" : "nav";
        controller.setFocusedRegion(nextRegion);
        return;
      }

      // Arrow navigation across workspaces when nav is focused
      if (state.focusedRegion === "nav") {
        const currentIndex = WORKSPACE_IDS.indexOf(state.activeWorkspace);
        if (keyName === "up" || event.sequence === "[") {
          const prevIdx = (currentIndex - 1 + WORKSPACE_IDS.length) % WORKSPACE_IDS.length;
          const target = WORKSPACE_IDS[prevIdx];
          if (target) controller.navigate(target);
          return;
        }
        if (keyName === "down" || event.sequence === "]") {
          const nextIdx = (currentIndex + 1) % WORKSPACE_IDS.length;
          const target = WORKSPACE_IDS[nextIdx];
          if (target) controller.navigate(target);
          return;
        }
      }
    },
    [state, controller, onQuit]
  );

  useKeyboard(handleKeyboard);

  return (
    <ResponsiveContainer
      forcedWidth={forcedWidth}
      forcedHeight={forcedHeight}
      isSidebarCollapsed={state.isSidebarCollapsed}
    >
      {({ width, height, isNarrow, isTooSmall, geometry }) => (
        <box
          flexDirection="column"
          width="100%"
          height="100%"
          backgroundColor={THEME_COLORS.bgApp}
        >
          {/* 1. Header */}
          <Header version={version} isNarrow={isNarrow} />

          {/* 2. Middle Body: Sidebar + Main Content Region */}
          <box flexDirection="row" flexGrow={1}>
            {/* Navigation Sidebar */}
            <NavigationBar
              isCollapsed={state.isSidebarCollapsed}
              isNarrow={isNarrow}
            />

            {/* Content Region */}
            <box flexDirection="column" flexGrow={1} backgroundColor={THEME_COLORS.bgApp}>
              {/* Breadcrumbs */}
              <Breadcrumbs />

              {/* Dynamic View Content */}
              {state.viewMode === "loading" ? (
                <LoadingState />
              ) : state.viewMode === "error" ? (
                <ErrorState
                  error={state.errorMessage ?? "An unexpected error occurred"}
                  onRetry={() => controller.setViewMode("ready")}
                />
              ) : state.viewMode === "disconnected" ? (
                <DisconnectedState engineStatus={state.engineStatus} />
              ) : state.activeWorkspace === "overview" ? (
                <OverviewView />
              ) : state.activeWorkspace === "ecosystem" ? (
                <EcosystemView />
              ) : state.activeWorkspace === "tasks" ? (
                <TasksView />
              ) : state.activeWorkspace === "conversations" ? (
                <ConversationsView />
              ) : state.activeWorkspace === "studio" ? (
                <StudioView />
              ) : state.activeWorkspace === "reports" ? (
                <ReportsView />
              ) : state.activeWorkspace === "settings" ? (
                <SettingsView />
              ) : (
                <PlaceholderView workspaceId={state.activeWorkspace} />
              )}
            </box>
          </box>

          {/* 3. Bottom Status Bar */}
          <StatusBar isNarrow={isNarrow} />

          {/* 4. Overlays */}
          <CommandPalette />
          <HelpModal />
        </box>
      )}
    </ResponsiveContainer>
  );
}
