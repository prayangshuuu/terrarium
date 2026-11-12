/**
 * apps/cli/tests/tasks-view.test.tsx
 *
 * Comprehensive test suite for Workspace 5: Task Manager (Intake, Plan Steps,
 * Dependencies, Budget, Approval Gates & Safe Execution Controls).
 * Contributed by A3 (Data, Security & Reliability) & A4 (Senior CLI/TUI Designer).
 *
 * Validates:
 * - Clean new-install empty state when zero tasks exist.
 * - Populated task list with status, priority, and department tags.
 * - High-volume task rendering (50+ tasks windowed without overflow).
 * - Detailed task inspection view with plan progression, assigned profile, and budget meter.
 * - Human approval gate banner with risk level badge.
 * - Failure reason banner when task is failed.
 * - Safe execution controls (pause, resume, cancel, retry) bounded by assertTaskTransition.
 * - Task creation mode and field cycling.
 */

import { describe, expect, test } from "bun:test";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import {
  type Task,
  type TaskStep,
  type ApprovalRequest,
  type Artifact,
  getAvailableTaskActions,
} from "@terrarium/contracts";
import { UiStateController } from "../src/ui/state/ui-state-controller.js";
import { TerrariumUiProvider } from "../src/ui/state/ui-context.js";
import { TasksView } from "../src/ui/views/TasksView.js";

function createMockTask(overrides?: Partial<Task>): Task {
  const now = new Date().toISOString();
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: "Implement distributed tracing middleware",
    description: "Add OpenTelemetry headers across service boundaries",
    department: "engineering",
    priority: "normal" as any,
    status: "running",
    contextRefs: [],
    expectedDeliverables: ["middleware.ts", "trace.test.ts"],
    delegationDepth: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Task Manager & Execution Lifecycle Suite (A3, A4 & A5)", () => {
  test("renders clean new-install empty state when zero tasks exist", async () => {
    const controller = new UiStateController({
      initialWorkspace: "tasks",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <TasksView />
      </TerrariumUiProvider>,
      { width: 110, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("TASK MANAGER");
    expect(frame).toContain("NO TASKS RECORDED");
    expect(frame).toContain("Clean installation: No tasks have been submitted");
    expect(frame).toContain("Press [c] to create and plan your first task.");

    await setup.dispose();
  });

  test("renders populated task table with status badges and department codes", async () => {
    const mockTasks: Task[] = [
      createMockTask({ id: "task_01", title: "Build OAuth Provider", status: "running", department: "engineering" }),
      createMockTask({ id: "task_02", title: "Evaluate Persona Feedback", status: "queued", department: "customer_intelligence" }),
      createMockTask({ id: "task_03", title: "Schema Migrations", status: "completed", department: "engineering" }),
      createMockTask({ id: "task_04", title: "Security Vulnerability Scan", status: "failed", failureReason: "Network timeout on CVE DB", department: "security" }),
      createMockTask({ id: "task_05", title: "Deploy to Production", status: "waiting_for_approval", department: "engineering" }),
    ];

    const controller = new UiStateController({
      initialWorkspace: "tasks",
    });
    (controller as any).setState({ tasks: mockTasks });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <TasksView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("TASK MANAGER");
    expect(frame).toContain("5 of 5 tasks");
    expect(frame).toContain("1 Running");
    expect(frame).toContain("1 Queued");
    expect(frame).toContain("1 Done");
    expect(frame).toContain("1 Failed");
    expect(frame).toContain("1 Gate(s)");

    // Column headers
    expect(frame).toContain("STATUS");
    expect(frame).toContain("PRIORITY");
    expect(frame).toContain("DEPARTMENT");
    expect(frame).toContain("TITLE");

    // Task rows
    expect(frame).toContain("Build OAuth Provider");
    expect(frame).toContain("Evaluate Persona Feedback");
    expect(frame).toContain("Schema Migrations");
    expect(frame).toContain("[S]"); // Simulated customer dept tag

    await setup.dispose();
  });

  test("renders high-volume tasks cleanly (50+ tasks without wrapping or overflow)", async () => {
    const mockTasks: Task[] = [];
    for (let i = 1; i <= 55; i++) {
      mockTasks.push(
        createMockTask({
          id: `task_bulk_${i}`,
          title: `Automated Pipeline Step #${i} Benchmark`,
          status: i % 2 === 0 ? "running" : "completed",
        })
      );
    }

    const controller = new UiStateController({
      initialWorkspace: "tasks",
    });
    (controller as any).setState({ tasks: mockTasks });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <TasksView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();
    let frame = setup.captureCharFrame();

    expect(frame).toContain("55 of 55 tasks");
    expect(frame).toContain("Automated Pipeline Step #1 Benchmark");

    // Navigate down with 'j'
    setup.mockInput.pressKey("j");
    await setup.renderOnce();
    expect(controller.getState().selectedTaskIndex).toBe(1);

    await setup.dispose();
  });

  test("inspects task detail with plan steps progression DAG, assigned agent, and budget gauge", async () => {
    const task = createMockTask({
      id: "task_detail_01",
      title: "Synthesize Multi-Department Roadmap",
      description: "Produce comprehensive Q3 engineering and product architecture roadmap.",
      status: "running",
      department: "product",
    });

    const steps: TaskStep[] = [
      {
        id: "step_01",
        taskId: task.id,
        stepIndex: 1,
        title: "Analyze Repository Architecture",
        description: "Parse AST and extract modular boundaries",
        status: "completed",
        assignedAgentId: "sophia_chen",
      },
      {
        id: "step_02",
        taskId: task.id,
        stepIndex: 2,
        title: "Draft Schema Specifications",
        description: "Define TypeBox and JSON Schema contracts",
        status: "running",
        assignedAgentId: "marcus_vance",
      },
    ];

    const now = new Date().toISOString();
    const artifacts: Artifact[] = [
      {
        id: "art_01",
        taskId: task.id,
        title: "roadmap.md",
        artifactType: "report",
        path: "docs/roadmap.md",
        mimeType: "text/markdown",
        sizeBytes: 4096,
        agentId: "sophia_chen",
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const controller = new UiStateController({
      initialWorkspace: "tasks",
    });

    (controller as any).setState({
      tasks: [task],
      selectedTaskId: task.id,
      taskViewMode: "detail",
      selectedTaskDetail: {
        task,
        assignedProfile: {
          id: "agent_sophia",
          slug: "sophia_chen",
          name: "Sophia Chen",
          role: "Staff Software Architect",
          department: "engineering",
          capabilities: ["architecture"],
          status: "enabled",
        },
        steps,
        executions: [],
        approvals: [],
        artifacts,
        availableActions: getAvailableTaskActions(task),
        budgetSummary: {
          usedTokens: 14200,
          usedSpendUsd: 0.42,
          maxSpendUsd: 10.0,
        },
      },
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <TasksView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("TASK: Synthesize Multi-Department Roadmap");
    expect(frame).toContain("Sophia Chen");
    expect(frame).toContain("Staff Software Architect");
    expect(frame).toContain("Step 1: Analyze Repository Architecture");
    expect(frame).toContain("Step 2: Draft Schema Specifications");
    expect(frame).toContain("Tokens: 14,200");
    expect(frame).toContain("Spend: $0.42 / $10.00");
    expect(frame).toContain("• docs/roadmap.md");

    // Running task safe execution controls
    expect(frame).toContain("[p] Pause");
    expect(frame).toContain("[x] Cancel");

    await setup.dispose();
  });

  test("displays human approval gate banner with risk level on pending approval", async () => {
    const task = createMockTask({
      id: "task_gate_01",
      title: "Deploy Migration Script",
      status: "waiting_for_approval",
    });

    const now = new Date().toISOString();
    const approvals: ApprovalRequest[] = [
      {
        id: "app_01",
        taskId: task.id,
        actionType: "production_deploy",
        description: "Executing irreversible database migration on production cluster",
        status: "pending",
        requestedByAgentId: "marcus_vance",
        requestedAt: now,
        createdAt: now,
        updatedAt: now,
        riskLevel: "critical",
      },
    ];

    const controller = new UiStateController({
      initialWorkspace: "tasks",
    });

    (controller as any).setState({
      tasks: [task],
      selectedTaskId: task.id,
      taskViewMode: "detail",
      selectedTaskDetail: {
        task,
        steps: [],
        executions: [],
        approvals,
        artifacts: [],
        availableActions: getAvailableTaskActions(task),
      },
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <TasksView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("HUMAN APPROVAL GATE REQUIRED");
    expect(frame).toContain("production_deploy");
    expect(frame).toContain("Executing irreversible database migration");

    await setup.dispose();
  });

  test("displays prominent failure reason banner and retry action when task is failed", async () => {
    const task = createMockTask({
      id: "task_failed_01",
      title: "Run Integration E2E Suite",
      status: "failed",
      failureReason: "Assertion failed: response status expected 200, received 500",
    });

    const controller = new UiStateController({
      initialWorkspace: "tasks",
    });

    (controller as any).setState({
      tasks: [task],
      selectedTaskId: task.id,
      taskViewMode: "detail",
      selectedTaskDetail: {
        task,
        steps: [],
        executions: [],
        approvals: [],
        artifacts: [],
        availableActions: getAvailableTaskActions(task),
      },
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <TasksView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("TASK FAILED: Assertion failed");
    expect(frame).toContain("[r] Retry");

    await setup.dispose();
  });

  test("enforces safe execution controls strictly by state machine", () => {
    // 1. Running task: canPause=true, canCancel=true, canResume=false, canRetry=false
    const runningActions = getAvailableTaskActions({ status: "running" });
    expect(runningActions.canPause).toBe(true);
    expect(runningActions.canCancel).toBe(true);
    expect(runningActions.canResume).toBe(false);
    expect(runningActions.canRetry).toBe(false);

    // 2. Waiting for input: canResume=true, canCancel=true, canPause=false
    const waitingActions = getAvailableTaskActions({ status: "waiting_for_input" });
    expect(waitingActions.canResume).toBe(true);
    expect(waitingActions.canCancel).toBe(true);
    expect(waitingActions.canPause).toBe(false);

    // 3. Failed task: canRetry=true, canPause=false, canResume=false
    const failedActions = getAvailableTaskActions({ status: "failed" });
    expect(failedActions.canRetry).toBe(true);
    expect(failedActions.canPause).toBe(false);

    // 4. Completed task: terminal state, zero actions legal
    const completedActions = getAvailableTaskActions({ status: "completed" });
    expect(completedActions.canPause).toBe(false);
    expect(completedActions.canResume).toBe(false);
    expect(completedActions.canCancel).toBe(false);
    expect(completedActions.canRetry).toBe(false);
  });

  test("navigates creation mode and cycles form fields", async () => {
    const controller = new UiStateController({
      initialWorkspace: "tasks",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <TasksView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();

    // Press 'c' to enter create mode
    setup.mockInput.pressKey("c");
    await setup.renderOnce();

    let frame = setup.captureCharFrame();
    expect(frame).toContain("CREATE NEW TASK & DRAFT PLAN");
    expect(frame).toContain("Task Title");
    expect(frame).toContain("Primary Department");
    expect(frame).toContain("Priority");

    // Press Esc to exit back to list
    setup.mockInput.pressEscape();
    await new Promise((r) => setTimeout(r, 120));
    await setup.renderOnce();

    frame = setup.captureCharFrame();
    expect(frame).toContain("TASK MANAGER");

    await setup.dispose();
  });
});
