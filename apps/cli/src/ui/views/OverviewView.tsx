/**
 * apps/cli/src/ui/views/OverviewView.tsx
 *
 * Workspace 1: Real-state system overview, pulse gauges, and active workload summary.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer),
 * with strict metric correctness and real-state guarantees from A3.
 *
 * PLAN.md Section 16 & PROMPT 15:
 * - Real state from CoreEngine (DB, registry, intake, coordinator, budget, approvals).
 * - Distinguishes registered profiles, active executions, queued/running tasks, approvals, budget.
 * - Shows freshness and unavailable states.
 * - Never invents live metrics; provides clean new-install empty state when unpopulated.
 */

import React from "react";
import { TextAttributes } from "@opentui/core";
import { TASK_STATUS_UI, EXECUTION_STATUS_UI, TOOL_RISK_UI } from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";

export function OverviewView() {
  const { state, controller } = useTerrariumUi();
  const summary = state.overviewSummary;

  // Format freshness display
  const lastUpdatedDisplay = summary.lastUpdatedAt
    ? new Date(summary.lastUpdatedAt).toLocaleTimeString()
    : "Never";

  const isCleanInstall = summary.registeredProfileCount === 0;

  return (
    <box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* 1. Header Banner: Title, Freshness, and Engine Status */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            {GLYPHS.wsOverview} SYSTEM OVERVIEW
          </text>
          <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
            {" "}[Updated: {lastUpdatedDisplay} • {summary.isFresh ? "Fresh" : "Stale"}]
          </text>
        </box>

        <text
          fg={
            summary.engineStatus === "running"
              ? THEME_COLORS.statusInfo
              : summary.engineStatus === "ready"
              ? THEME_COLORS.statusSuccess
              : summary.engineStatus === "paused"
              ? THEME_COLORS.statusWarning
              : THEME_COLORS.fgDim
          }
          attributes={TextAttributes.BOLD}
        >
          {summary.engineStatus === "running"
            ? "● RUNNING"
            : summary.engineStatus === "ready"
            ? "● READY"
            : summary.engineStatus === "paused"
            ? "⏸ PAUSED"
            : "○ DISCONNECTED"}
        </text>
      </box>

      {/* 2. Urgent Attention Banner: Pending Approvals (Consequential Gates) */}
      {summary.pendingApprovalCount > 0 && (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          title=" ACTION REQUIRED: HUMAN APPROVAL GATE "
          titleColor={THEME_COLORS.statusApproval}
          borderColor={THEME_COLORS.statusApproval}
          backgroundColor={THEME_COLORS.bgCardElevated}
          paddingX={1}
          paddingY={0}
          marginBottom={1}
        >
          <box flexDirection="row" alignItems="center">
            <text fg={THEME_COLORS.statusApproval} attributes={TextAttributes.BOLD}>
              {GLYPHS.statusWarning} {summary.pendingApprovalCount} consequential action(s) awaiting approval.
            </text>
            <text fg={THEME_COLORS.fgSecondary}>
              {" "}Execution is held safely at permission boundaries.
            </text>
          </box>
          {summary.pendingApprovals.slice(0, 2).map((app) => (
            <box key={app.id} flexDirection="row" marginTop={0}>
              <text fg={THEME_COLORS.fgMuted}>• Task </text>
              <text fg={THEME_COLORS.fgPrimary}>{app.taskId}: </text>
              <text fg={THEME_COLORS.statusApproval}>{app.toolName} </text>
              <text fg={THEME_COLORS.statusDanger}>{TOOL_RISK_UI[app.riskLevel]?.badge ?? "[HIGH]"} </text>
              <text fg={THEME_COLORS.fgDim}>
                ({app.consequenceSummary ? app.consequenceSummary.slice(0, 40) : "Requires authorization"})
              </text>
            </box>
          ))}
        </box>
      )}

      {/* 3. New-Install Empty State Notice (Clean Baseline) */}
      {isCleanInstall && (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          title=" CLEAN INSTALLATION: EMPTY CATALOG "
          titleColor={THEME_COLORS.statusInfo}
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={1}
          paddingY={0}
          marginBottom={1}
        >
          <text fg={THEME_COLORS.fgSecondary}>
            Virtual organization catalog is unpopulated (0 agent profiles registered).
          </text>
          <text fg={THEME_COLORS.statusInfo}>
            Seed the standard catalog with 'terrarium agent seed' or register custom agents in the Agent Ecosystem [2].
          </text>
        </box>
      )}

      {/* 4. Real-State 2x2 Pulse Gauges */}
      <box flexDirection="column" marginBottom={1}>
        {/* Row 1: Org + Workload */}
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
            <box flexDirection="row" marginTop={0}>
              <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
                {summary.registeredProfileCount}{" "}
              </text>
              <text fg={THEME_COLORS.fgSecondary}>profiles registered</text>
            </box>
            <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
              {summary.simulatedPersonaCount > 0
                ? `[SIMULATED: ${summary.simulatedPersonaCount}] personas`
                : "0 simulated personas"}
            </text>
          </box>

          {/* Card 2: Tasks & Workload */}
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
          >
            <box flexDirection="row" marginTop={0}>
              <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
                {summary.activeExecutionCount}{" "}
              </text>
              <text fg={THEME_COLORS.fgSecondary}>active executions</text>
            </box>
            <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
              {summary.runningTaskCount} running • {summary.queuedTaskCount} queued tasks
            </text>
          </box>
        </box>

        {/* Row 2: Approvals + Budget */}
        <box flexDirection="row" justifyContent="space-between">
          {/* Card 3: Approvals & Gates */}
          <box
            flexDirection="column"
            flexGrow={1}
            border={true}
            borderStyle="single"
            title=" APPROVAL GATES "
            titleColor={summary.pendingApprovalCount > 0 ? THEME_COLORS.statusApproval : THEME_COLORS.statusSuccess}
            borderColor={THEME_COLORS.borderSubtle}
            backgroundColor={THEME_COLORS.bgCard}
            paddingX={1}
            paddingY={0}
            marginRight={1}
          >
            <box flexDirection="row" marginTop={0}>
              <text
                fg={summary.pendingApprovalCount > 0 ? THEME_COLORS.statusApproval : THEME_COLORS.fgPrimary}
                attributes={TextAttributes.BOLD}
              >
                {summary.pendingApprovalCount}{" "}
              </text>
              <text fg={THEME_COLORS.fgSecondary}>pending gates</text>
            </box>
            <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
              {summary.pendingApprovalCount > 0 ? "Human review required" : "All gates cleared"}
            </text>
          </box>

          {/* Card 4: Budget & Resource Usage */}
          <box
            flexDirection="column"
            flexGrow={1}
            border={true}
            borderStyle="single"
            title=" BUDGET & TOKENS "
            titleColor={THEME_COLORS.statusSuccess}
            borderColor={THEME_COLORS.borderSubtle}
            backgroundColor={THEME_COLORS.bgCard}
            paddingX={1}
            paddingY={0}
          >
            <box flexDirection="row" marginTop={0}>
              <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
                ${summary.totalSpendUsd.toFixed(2)}{" "}
              </text>
              <text fg={THEME_COLORS.fgSecondary}>
                {summary.maxSpendUsd !== undefined ? `/ $${summary.maxSpendUsd.toFixed(2)}` : ""}
              </text>
            </box>
            <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
              {(summary.totalTokensUsed / 1000).toFixed(1)}k tokens (Dynamic routing)
            </text>
          </box>
        </box>
      </box>

      {/* 5. Department Population Breakdown (Real state, no fabricated counts) */}
      {summary.registeredProfileCount > 0 && (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          title=" VIRTUAL ORG DEPARTMENT BREAKDOWN "
          titleColor={THEME_COLORS.fgMuted}
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={1}
          paddingY={0}
          marginBottom={1}
        >
          <box flexDirection="row" flexWrap="wrap">
            {Object.entries(summary.departmentCounts).map(([dept, count]) => {
              const isSim = dept === "customer_intelligence";
              return (
                <box key={dept} flexDirection="row" marginRight={2}>
                  <text fg={isSim ? THEME_COLORS.statusSimulated : THEME_COLORS.statusInfo}>
                    {dept}:{" "}
                  </text>
                  <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
                    {count}{" "}
                  </text>
                  {isSim && (
                    <text fg={THEME_COLORS.statusSimulated} attributes={TextAttributes.DIM}>
                      [SIMULATED]
                    </text>
                  )}
                </box>
              );
            })}
          </box>
        </box>
      )}

      {/* 6. Active Executions / Recent Activity Section */}
      <box
        flexDirection="column"
        border={true}
        borderStyle="single"
        title=" PIPELINE WORKLOAD & ACTIVITY "
        titleColor={THEME_COLORS.statusInfo}
        borderColor={THEME_COLORS.borderSubtle}
        backgroundColor={THEME_COLORS.bgCard}
        paddingX={1}
        paddingY={0}
        flexGrow={1}
        marginBottom={1}
      >
        {summary.recentExecutions.length > 0 ? (
          <box flexDirection="column">
            <text fg={THEME_COLORS.fgSecondary} attributes={TextAttributes.BOLD}>
              Active Model Executions:
            </text>
            {summary.recentExecutions.map((exec) => (
              <box key={exec.id} flexDirection="row" justifyContent="space-between">
                <box flexDirection="row">
                  <text fg={THEME_COLORS.statusSuccess}>{EXECUTION_STATUS_UI[exec.status]?.glyph ?? "▶"} </text>
                  <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
                    {exec.agentSlug}{" "}
                  </text>
                  <text fg={THEME_COLORS.fgMuted}>({exec.provider}/{exec.model}) </text>
                </box>
                <text fg={THEME_COLORS.fgDim}>
                  Task: {exec.taskId.slice(0, 12)}
                </text>
              </box>
            ))}
          </box>
        ) : summary.recentTasks.length > 0 ? (
          <box flexDirection="column">
            <text fg={THEME_COLORS.fgSecondary} attributes={TextAttributes.BOLD}>
              Recent Pipeline Tasks:
            </text>
            {summary.recentTasks.map((task) => (
              <box key={task.id} flexDirection="row" justifyContent="space-between">
                <box flexDirection="row">
                  <text fg={THEME_COLORS.statusInfo}>{TASK_STATUS_UI[task.status]?.glyph ?? "○"} </text>
                  <text fg={THEME_COLORS.fgPrimary}>{task.title} </text>
                  <text fg={THEME_COLORS.fgDim}>[{task.priority}]</text>
                </box>
                <text fg={THEME_COLORS.fgMuted}>{TASK_STATUS_UI[task.status]?.label ?? task.status}</text>
              </box>
            ))}
          </box>
        ) : (
          <box flexDirection="column">
            <text fg={THEME_COLORS.fgSecondary}>
              Demand-Based Orchestration is currently idle. Zero active executions.
            </text>
            <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
              Agents are activated strictly on-demand when a task is dispatched, preserving token budget.
            </text>
          </box>
        )}
      </box>

      {/* 7. Quick Navigation & Interaction Hints */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center">
        <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
          [1-9,0] Switch workspaces  •  [2] Agent Ecosystem  •  [Ctrl+K] Command Palette  •  [?] Help
        </text>
        <text fg={THEME_COLORS.statusAccent} attributes={TextAttributes.DIM}>
          Virtual Org Model • PLAN.md Section 4
        </text>
      </box>
    </box>
  );
}
