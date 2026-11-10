/**
 * apps/cli/src/ui/components/StatusBar.tsx
 *
 * Terminal application bottom status area, telemetry counters, and keybinding hints.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import React from "react";
import { TextAttributes } from "@opentui/core";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";

export interface StatusBarProps {
  readonly isNarrow?: boolean;
}

export function StatusBar({ isNarrow = false }: StatusBarProps) {
  const { state } = useTerrariumUi();

  const alertColor = state.alert
    ? state.alert.level === "error"
      ? THEME_COLORS.statusDanger
      : state.alert.level === "warning"
      ? THEME_COLORS.statusWarning
      : THEME_COLORS.statusInfo
    : THEME_COLORS.fgSecondary;

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      height={2}
      border={["top"]}
      borderStyle="single"
      borderColor={THEME_COLORS.borderSubtle}
      paddingX={1}
      backgroundColor={THEME_COLORS.bgFooter}
    >
      {/* Left: Engine pulse & active workload */}
      <box flexDirection="row" alignItems="center">
        <text fg={THEME_COLORS.statusInfo}>
          {GLYPHS.brandPulse} Active:{" "}
        </text>
        <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
          {state.activeAgentCount}
        </text>
        {!isNarrow && (
          <box flexDirection="row" alignItems="center">
            <text fg={THEME_COLORS.fgMuted}> • Tasks: </text>
            <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
              {state.activeTaskCount}
            </text>
          </box>
        )}
      </box>

      {/* Center: Live Alert or Budget meter */}
      <box flexDirection="row" alignItems="center">
        {state.alert ? (
          <text fg={alertColor} attributes={TextAttributes.BOLD}>
            {GLYPHS.statusWarning} {state.alert.message}
          </text>
        ) : !isNarrow ? (
          <text fg={THEME_COLORS.fgSecondary}>
            ${state.totalSpendUsd.toFixed(2)}
            {state.maxSpendUsd !== undefined ? `/$${state.maxSpendUsd.toFixed(0)}` : ""}
            {" • "}{(state.totalTokensUsed / 1000).toFixed(1)}k tok
          </text>
        ) : null}
      </box>

      {/* Right: Keybinding legend */}
      <box flexDirection="row" alignItems="center">
        {!isNarrow ? (
          <text fg={THEME_COLORS.fgDim}>
            [1-9,0] Nav  [Ctrl+K]  [B] Back  [?] Help  [Q] Quit
          </text>
        ) : (
          <text fg={THEME_COLORS.fgDim}>
            [1-9] [Ctrl+K] [?] [Q]
          </text>
        )}
      </box>
    </box>
  );
}
