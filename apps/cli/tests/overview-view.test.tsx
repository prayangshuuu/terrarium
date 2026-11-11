/**
 * apps/cli/tests/overview-view.test.tsx
 *
 * Comprehensive test suite for Workspace 1: Real-State Overview Dashboard.
 * Contributed by A3 (Senior Backend Developer, Data, Security & Reliability)
 * and A4 (Senior CLI/TUI Designer & Developer).
 *
 * Validates:
 * - Real-state dashboard rendering from engine state.
 * - Accurate distinction of registered profiles, active executions, queued/running tasks, approvals, and budget.
 * - Clean new-install empty state (0 profiles).
 * - Freshness timestamp and engine connection states.
 * - Consequential action approval banners.
 * - Metric correctness: Zero fabricated numbers (PLAN.md Section 16.3).
 */

import { describe, expect, test } from "bun:test";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import {
  type OverviewSummary,
  type AgentProfile,
  type Task,
  type Execution,
  type ApprovalRequest,
} from "@terrarium/contracts";
import { UiStateController } from "../src/ui/state/ui-state-controller.js";
import { TerrariumUiProvider } from "../src/ui/state/ui-context.js";
import { OverviewView } from "../src/ui/views/OverviewView.js";

describe("Overview Dashboard Real-State Suite (A3 & A4)", () => {
  test("renders clean new-install empty state with zero fabricated metrics", async () => {
    const controller = new UiStateController({
      initialWorkspace: "overview",
      projectName: "terrarium-clean",
      environment: "test",
      initialProfiles: [], // Clean install: 0 profiles
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <OverviewView />
      </TerrariumUiProvider>,
      { width: 100, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    // Verify Title & Empty State Notice
    expect(frame).toContain("SYSTEM OVERVIEW");
    expect(frame).toContain("CLEAN INSTALLATION: EMPTY CATALOG");
    expect(frame).toContain("0 agent profiles registered");
    expect(frame).toContain("terrarium agent seed");

    // Verify exact pulse card values: 0 profiles, 0 active executions, 0 pending gates, $0.00
    expect(frame).toContain("0 profiles registered");
    expect(frame).toContain("0 active executions");
    expect(frame).toContain("0 pending gates");
    expect(frame).toContain("$0.00");

    // Verify Idle pipeline explanation
    expect(frame).toContain("Demand-Based Orchestration is currently idle");
    expect(frame).toContain("Zero active executions");

    // CRITICAL (A3 Metric Correctness): Verify no fabricated numbers (like 880) appear!
    expect(frame).not.toContain("880");
  });

  test("renders populated real state with active executions, tasks, and budget gauge", async () => {
    const customSummary: Partial<OverviewSummary> = {
      engineStatus: "running",
      isFresh: true,
      lastUpdatedAt: "2026-11-11T04:00:00.000Z",
      registeredProfileCount: 15,
      activeExecutionCount: 2,
      activeTaskCount: 3,
      queuedTaskCount: 1,
      runningTaskCount: 2,
      pendingApprovalCount: 1,
      totalSpendUsd: 1.45,
      maxSpendUsd: 10.0,
      totalTokensUsed: 45200,
      departmentCounts: {
        engineering: 5,
        executive: 2,
        customer_intelligence: 3,
        product: 2,
        design: 1,
        security: 2,
      },
      simulatedPersonaCount: 3,
      recentExecutions: [
        {
          id: "exec-01",
          taskId: "task-feat-99",
          agentProfileId: "prof-eng-backend",
          agentSlug: "senior-backend-dev",
          status: "running",
          provider: "anthropic",
          model: "claude-3-5-sonnet",
          startedAt: "2026-11-11T03:59:00.000Z",
        },
      ],
      recentTasks: [
        {
          id: "task-feat-99",
          title: "Implement Model Router Fallback",
          status: "running",
          priority: "high",
          createdAt: "2026-11-11T03:58:00.000Z",
        },
      ],
      pendingApprovals: [
        {
          id: "appr-01",
          taskId: "task-feat-99",
          toolName: "execute_shell_command",
          riskLevel: "critical",
          requestedAt: "2026-11-11T03:59:30.000Z",
          consequenceSummary: "Executes arbitrary build script in workspace sandbox",
        },
      ],
    };

    const controller = new UiStateController({
      initialWorkspace: "overview",
      initialOverviewSummary: customSummary,
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <OverviewView />
      </TerrariumUiProvider>,
      { width: 110, height: 40 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    // Verify Live Engine Status & Freshness
    expect(frame).toContain("● RUNNING");
    expect(frame).toContain("Fresh");

    // Verify Urgent Human Approval Gate Banner
    expect(frame).toContain("ACTION REQUIRED: HUMAN APPROVAL GATE");
    expect(frame).toContain("execute_shell_command");
    expect(frame).toContain("[CRITICAL]");

    // Verify Pulse Gauges
    expect(frame).toContain("15 profiles registered");
    expect(frame).toContain("[SIMULATED: 3] personas");
    expect(frame).toContain("2 active executions");
    expect(frame).toContain("2 running • 1 queued tasks");
    expect(frame).toContain("1 pending gates");
    expect(frame).toContain("$1.45");
    expect(frame).toContain("/ $10.00");
    expect(frame).toContain("45.2k tokens");

    // Verify Active Execution Table Entry
    expect(frame).toContain("senior-backend-dev");
    expect(frame).toContain("anthropic/claude-3-5-sonnet");

    // Verify Department Breakdown
    expect(frame).toContain("engineering: 5");
    expect(frame).toContain("customer_intelligence: 3");
    expect(frame).toContain("[SIMULATED]");
  });

  test("displays offline/disconnected state properly when engine is unreachable", async () => {
    const controller = new UiStateController({
      initialWorkspace: "overview",
      initialOverviewSummary: {
        engineStatus: "disconnected",
        isFresh: false,
        registeredProfileCount: 0,
      },
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <OverviewView />
      </TerrariumUiProvider>,
      { width: 100, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("○ DISCONNECTED");
    expect(frame).toContain("Stale");
  });
});
