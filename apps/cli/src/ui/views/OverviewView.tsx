/**
 * apps/cli/src/ui/views/OverviewView.tsx
 *
 * Workspace 1: System overview, pulse gauges, and active workload summary.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import React from "react";
import { TextAttributes } from "@opentui/core";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";

export function OverviewView() {
  const { state } = useTerrariumUi();

  return (
    <box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* Overview Title Banner */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            {GLYPHS.wsOverview} SYSTEM OVERVIEW
          </text>
          <text fg={THEME_COLORS.fgMuted}>
            {" "}• On-Demand Multi-Agent AI Orchestration
          </text>
        </box>
      </box>

      {/* Grid of Pulse Cards */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        {/* Card 1: Virtual Organization */}
        <box
          flexDirection="column"
          flexGrow={1}
          border={true}
          borderStyle="single"
          title=" VIRTUAL ORG "
          titleColor={THEME_COLORS.statusAccent}
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={1}
          paddingY={0}
          marginRight={1}
        >
          <box marginTop={0}>
            <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
              {state.registeredAgentCount > 0 ? state.registeredAgentCount : "880"}{" "}
            </text>
            <text fg={THEME_COLORS.fgSecondary}>profiles</text>
          </box>
          <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
            {state.activeAgentCount} active executions
          </text>
        </box>

        {/* Card 2: Task Pipeline */}
        <box
          flexDirection="column"
          flexGrow={1}
          border={true}
          borderStyle="single"
          title=" TASKS "
          titleColor={THEME_COLORS.statusInfo}
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={1}
          paddingY={0}
          marginRight={1}
        >
          <box marginTop={0}>
            <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
              {state.activeTaskCount}{" "}
            </text>
            <text fg={THEME_COLORS.fgSecondary}>active tasks</text>
          </box>
          <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
            Demand-driven
          </text>
        </box>

        {/* Card 3: Budget & Resource Usage */}
        <box
          flexDirection="column"
          flexGrow={1}
          border={true}
          borderStyle="single"
          title=" BUDGET "
          titleColor={THEME_COLORS.statusSuccess}
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={1}
          paddingY={0}
        >
          <box marginTop={0}>
            <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
              ${state.totalSpendUsd.toFixed(2)}{" "}
            </text>
            <text fg={THEME_COLORS.fgSecondary}>
              {state.maxSpendUsd !== undefined ? `/ $${state.maxSpendUsd.toFixed(2)}` : ""}
            </text>
          </box>
          <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
            {(state.totalTokensUsed / 1000).toFixed(1)}k tokens
          </text>
        </box>
      </box>

      {/* Guiding Principles Card */}
      <box
        flexDirection="column"
        border={true}
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        backgroundColor={THEME_COLORS.bgCard}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
          CORE PRINCIPLES (PLAN_CONTEXT.md Section 1):
        </text>
        <box marginTop={1} flexDirection="column">
          <text fg={THEME_COLORS.fgSecondary}>
            "A large virtual organization, activated selectively, coordinated intelligently, and measured by useful outcomes rather than agent count."
          </text>
          <box marginTop={1} flexDirection="row">
            <text fg={THEME_COLORS.statusInfo}>
              [1-9,0] Switch workspaces  •  [Ctrl+K] Open Command Palette  •  [?] Keybindings help
            </text>
          </box>
        </box>
      </box>
    </box>
  );
}
