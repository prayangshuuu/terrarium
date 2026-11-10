/**
 * apps/cli/src/ui/components/NavigationBar.tsx
 *
 * Workspace navigation sidebar / tab bar with keyboard shortcuts and active state.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import React from "react";
import { TextAttributes } from "@opentui/core";
import { WORKSPACE_AREAS, type WorkspaceId } from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";

export interface NavigationBarProps {
  readonly isCollapsed?: boolean;
  readonly isNarrow?: boolean;
}

export function NavigationBar({ isCollapsed = false, isNarrow = false }: NavigationBarProps) {
  const { state, controller } = useTerrariumUi();
  const workspaces = Object.values(WORKSPACE_AREAS);

  // In ultra-compact mode, render minimal shortcut icons
  const sidebarWidth = isCollapsed || isNarrow ? 8 : 28;

  return (
    <box
      flexDirection="column"
      width={sidebarWidth}
      border={["right"]}
      borderStyle="single"
      borderColor={THEME_COLORS.borderSubtle}
      backgroundColor={THEME_COLORS.bgSidebar}
      paddingY={1}
    >
      {/* Sidebar Header */}
      {!isCollapsed && !isNarrow ? (
        <box paddingX={1} marginBottom={1}>
          <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.DIM}>
            WORKSPACES [1-9,0]
          </text>
        </box>
      ) : null}

      {/* Workspace List */}
      {workspaces.map((ws) => {
        const isActive = state.activeWorkspace === ws.id;
        const fgColor = isActive ? THEME_COLORS.fgPrimary : THEME_COLORS.fgSecondary;
        const itemBg = isActive ? THEME_COLORS.bgActive : "transparent";
        const borderColor = isActive ? THEME_COLORS.borderActive : "transparent";

        return (
          <box
            key={ws.id}
            flexDirection="row"
            alignItems="center"
            paddingX={1}
            paddingY={0}
            backgroundColor={itemBg}
            border={isActive ? ["left"] : undefined}
            borderStyle="single"
            borderColor={borderColor}
          >
            {/* Active Marker & Shortcut */}
            <text fg={isActive ? THEME_COLORS.statusInfo : THEME_COLORS.fgDim} attributes={TextAttributes.BOLD}>
              {isActive ? `${GLYPHS.navArrow}[${ws.shortcut}] ` : ` [${ws.shortcut}] `}
            </text>

            {/* Label and Icon (hidden if collapsed/narrow) */}
            {!isCollapsed && !isNarrow ? (
              <text fg={fgColor} attributes={isActive ? TextAttributes.BOLD : TextAttributes.NONE}>
                {ws.label}
              </text>
            ) : null}
          </box>
        );
      })}

      {/* Footer shortcut hints in sidebar */}
      {!isCollapsed && !isNarrow ? (
        <box marginTop={2} paddingX={1}>
          <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
            [Ctrl+K] Palette
          </text>
          <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
            [?] Help / Shortcuts
          </text>
        </box>
      ) : null}
    </box>
  );
}
