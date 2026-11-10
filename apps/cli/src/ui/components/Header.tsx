/**
 * apps/cli/src/ui/components/Header.tsx
 *
 * Terminal application header bar, product identity, and status badge.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import React from "react";
import { TextAttributes } from "@opentui/core";
import { CONTRACTS_VERSION } from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";

export interface HeaderProps {
  readonly version?: string;
  readonly isNarrow?: boolean;
}

export function Header({ version = "0.1.0", isNarrow = false }: HeaderProps) {
  const { state } = useTerrariumUi();

  const isConnected = state.engineStatus !== "disconnected";
  const connectionColor = isConnected
    ? state.engineStatus === "running"
      ? THEME_COLORS.statusInfo
      : THEME_COLORS.statusSuccess
    : THEME_COLORS.statusDanger;

  const connectionGlyph = isConnected
    ? state.engineStatus === "running"
      ? GLYPHS.statusRunning
      : GLYPHS.brandDot
    : GLYPHS.statusBlocked;

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      height={3}
      border={["bottom"]}
      borderStyle="single"
      borderColor={THEME_COLORS.borderHeader}
      paddingX={1}
      backgroundColor={THEME_COLORS.bgHeader}
    >
      {/* Brand & Identity */}
      <box flexDirection="row" alignItems="center">
        <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
          {GLYPHS.brandLogo} TERRARIUM
        </text>
        {!isNarrow && (
          <text fg={THEME_COLORS.fgMuted}>
            {" "}v{version} (contracts v{CONTRACTS_VERSION})
          </text>
        )}
      </box>

      {/* Center Subtitle or Active Project */}
      {!isNarrow && (
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.fgSecondary}>Project: </text>
          <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
            {state.projectName}
          </text>
        </box>
      )}

      {/* Right Environment & Connection Badges */}
      <box flexDirection="row" alignItems="center">
        <text fg={THEME_COLORS.fgDim}>
          [{state.environment.toUpperCase()}]
        </text>
        <text fg={connectionColor} attributes={TextAttributes.BOLD}>
          {" "}{connectionGlyph} {state.engineStatus.toUpperCase()}
        </text>
      </box>
    </box>
  );
}
