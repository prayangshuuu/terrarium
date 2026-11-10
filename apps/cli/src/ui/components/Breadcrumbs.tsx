/**
 * apps/cli/src/ui/components/Breadcrumbs.tsx
 *
 * Hierarchical navigation breadcrumb bar with back behavior indicator.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import React from "react";
import { TextAttributes } from "@opentui/core";
import { WORKSPACE_AREAS } from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";

export function Breadcrumbs() {
  const { state } = useTerrariumUi();
  const currentArea = WORKSPACE_AREAS[state.activeWorkspace];
  const canGoBack = state.history.length > 1;

  const prevWorkspaceId = canGoBack ? state.history[state.history.length - 2] : undefined;
  const previousArea = prevWorkspaceId ? WORKSPACE_AREAS[prevWorkspaceId] : undefined;

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      height={1}
      paddingX={1}
      backgroundColor={THEME_COLORS.bgApp}
    >
      {/* Path Trail */}
      <box flexDirection="row" alignItems="center">
        <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.DIM}>
          TERRARIUM
        </text>
        <text fg={THEME_COLORS.fgDim}>
          {" "}{GLYPHS.navBreadcrumbSeparator}{" "}
        </text>
        <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
          {currentArea?.label ?? state.activeWorkspace}
        </text>
      </box>

      {/* Back Hint */}
      {canGoBack && previousArea ? (
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.statusInfo}>
            [Esc / B] Back to {previousArea.label}
          </text>
        </box>
      ) : null}
    </box>
  );
}
