/**
 * apps/cli/src/ui/views/TasksView.tsx
 *
 * Workspace 5: Task Manager (Intake, Plan Steps, Dependencies, Budget, Approval Gates & Execution Controls).
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer),
 * with execution controls bounded by A2 (assertTaskTransition) and state guarantees by A3.
 *
 * PLAN.md Section 5 & Section 16; PROMPT 16:
 * - Task list with status, priority, department, budget, and pagination/scrolling.
 * - Inspects lifecycle states: draft, planned, queued, running, waiting_for_input,
 *   waiting_for_approval, completed, failed, cancelled, blocked.
 * - Shows plan steps progression DAG, dependencies, budget gauges, artifacts, and failure reasons.
 * - Displays human approval gate banners with risk level.
 * - Exposes safe execution controls (pause, cancel, retry, resume) strictly when supported.
 * - Clean new-install empty state when unpopulated.
 */

import React, { useState, useCallback } from "react";
import { TextAttributes, type KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import {
  TASK_STATUSES,
  type TaskStatus,
  TASK_PRIORITIES,
  type TaskPriority,
  AGENT_DEPARTMENTS,
  type AgentDepartment,
  TASK_STATUS_UI,
  TASK_PRIORITY_UI,
  DEPARTMENT_UI,
  TOOL_RISK_UI,
  type Task,
  type TaskStep,
  type ApprovalRequest,
  type Artifact,
  type TaskAvailableActions,
} from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";
import { ActivityFeed } from "../components/ActivityFeed.js";

const STATUS_CYCLE: readonly ("all" | TaskStatus)[] = ["all", ...TASK_STATUSES];
const PRIORITY_CYCLE: readonly ("all" | TaskPriority)[] = ["all", ...TASK_PRIORITIES];
const DEPT_CYCLE: readonly ("all" | AgentDepartment)[] = ["all", ...AGENT_DEPARTMENTS];

export function TasksView() {
  const { state, controller } = useTerrariumUi();
  const [showActivitySplit, setShowActivitySplit] = useState(false);

  // Creation form local state
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createDept, setCreateDept] = useState<AgentDepartment>("engineering");
  const [createPriority, setCreatePriority] = useState<TaskPriority>("medium");
  const [createField, setCreateField] = useState<"title" | "desc" | "dept" | "priority">("title");

  const filteredTasks = controller.getFilteredTasks();
  const selectedTask: Task | null = filteredTasks[state.selectedTaskIndex] ?? null;
  const detail = state.selectedTaskDetail;

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      // Overlays take precedence
      if (state.isCommandPaletteOpen || state.isHelpModalOpen) return;

      const keyName = event.name.toLowerCase();

      // =======================================================================
      // Mode 1: Create Form
      // =======================================================================
      if (state.taskViewMode === "create") {
        if (keyName === "escape" || keyName === "esc" || event.sequence === "\u001b") {
          controller.setTaskViewMode("list");
          return;
        }

        // Tab switches field
        if (keyName === "tab") {
          const order: ("title" | "desc" | "dept" | "priority")[] = ["title", "desc", "dept", "priority"];
          const curIdx = order.indexOf(createField);
          const nextIdx = (curIdx + 1) % order.length;
          setCreateField(order[nextIdx] ?? "title");
          return;
        }

        // Enter submits form
        if (keyName === "return" || keyName === "enter") {
          if (createTitle.trim().length > 0) {
            void controller.createTask({
              title: createTitle.trim(),
              description: createDesc.trim() || createTitle.trim(),
              department: createDept,
              priority: createPriority,
            });
            setCreateTitle("");
            setCreateDesc("");
          }
          return;
        }

        // Department / Priority Cycling
        if (createField === "dept" && (keyName === "space" || keyName === "right" || keyName === "left")) {
          const idx = AGENT_DEPARTMENTS.indexOf(createDept);
          const nextIdx = (idx + 1) % AGENT_DEPARTMENTS.length;
          setCreateDept(AGENT_DEPARTMENTS[nextIdx] ?? "engineering");
          return;
        }

        if (createField === "priority" && (keyName === "space" || keyName === "right" || keyName === "left")) {
          const idx = TASK_PRIORITIES.indexOf(createPriority);
          const nextIdx = (idx + 1) % TASK_PRIORITIES.length;
          setCreatePriority(TASK_PRIORITIES[nextIdx] ?? "medium");
          return;
        }

        // Text typing in title / desc
        if (createField === "title") {
          if (keyName === "backspace") {
            setCreateTitle((prev) => prev.slice(0, -1));
          } else if (event.sequence && event.sequence.length === 1 && !event.ctrl && !event.meta) {
            setCreateTitle((prev) => prev + event.sequence);
          }
          return;
        }

        if (createField === "desc") {
          if (keyName === "backspace") {
            setCreateDesc((prev) => prev.slice(0, -1));
          } else if (event.sequence && event.sequence.length === 1 && !event.ctrl && !event.meta) {
            setCreateDesc((prev) => prev + event.sequence);
          }
          return;
        }

        return;
      }

      // =======================================================================
      // Mode 2: Task Detail View
      // =======================================================================
      if (state.taskViewMode === "detail") {
        if (
          keyName === "escape" ||
          keyName === "esc" ||
          event.sequence === "\u001b" ||
          (!event.ctrl && !event.meta && keyName === "b")
        ) {
          controller.setTaskViewMode("list");
          return;
        }

        // Safe execution controls (A2)
        if (detail) {
          const actions = detail.availableActions;

          // 'p' -> Pause
          if (!event.ctrl && !event.meta && keyName === "p" && actions.canPause) {
            void controller.pauseTask(detail.task.id);
            return;
          }

          // 's' -> Resume
          if (!event.ctrl && !event.meta && keyName === "s" && actions.canResume) {
            void controller.resumeTask(detail.task.id);
            return;
          }

          // 'x' -> Cancel
          if (!event.ctrl && !event.meta && keyName === "x" && actions.canCancel) {
            void controller.cancelTask(detail.task.id);
            return;
          }

          // 'r' -> Retry
          if (!event.ctrl && !event.meta && keyName === "r" && actions.canRetry) {
            void controller.retryTask(detail.task.id);
            return;
          }
        }

        return;
      }

      // =======================================================================
      // Mode 3: Task List View
      // =======================================================================

      // 1. Navigation: Up / Down, j / k
      if (keyName === "up" || (!event.ctrl && !event.meta && keyName === "k")) {
        const nextIdx = Math.max(0, state.selectedTaskIndex - 1);
        controller.setTaskIndex(nextIdx);
        return;
      }

      if (keyName === "down" || (!event.ctrl && !event.meta && keyName === "j")) {
        const nextIdx = Math.min(filteredTasks.length - 1, state.selectedTaskIndex + 1);
        controller.setTaskIndex(nextIdx);
        return;
      }

      // 2. Inspect Task Detail: Enter / Space / 'i'
      if (
        keyName === "return" ||
        keyName === "enter" ||
        keyName === "space" ||
        (!event.ctrl && !event.meta && keyName === "i")
      ) {
        if (selectedTask) {
          void controller.selectTask(selectedTask.id);
        }
        return;
      }

      // 3. Create Task: 'c'
      if (!event.ctrl && !event.meta && keyName === "c") {
        controller.setTaskViewMode("create");
        return;
      }

      // 4. Toggle Activity Feed Split: 'a'
      if (!event.ctrl && !event.meta && keyName === "a") {
        setShowActivitySplit((prev) => !prev);
        return;
      }

      // 5. Filter cycles: Status ('s'), Priority ('p'), Department ('d'), Reset ('x')
      if (!event.ctrl && !event.meta && keyName === "s") {
        const curStatus = state.taskFilter.status;
        const curIdx = STATUS_CYCLE.indexOf(curStatus);
        const nextIdx = (curIdx + 1) % STATUS_CYCLE.length;
        controller.setTaskFilter({ status: STATUS_CYCLE[nextIdx] ?? "all" });
        return;
      }

      if (!event.ctrl && !event.meta && keyName === "p") {
        const curPri = state.taskFilter.priority;
        const curIdx = PRIORITY_CYCLE.indexOf(curPri);
        const nextIdx = (curIdx + 1) % PRIORITY_CYCLE.length;
        controller.setTaskFilter({ priority: PRIORITY_CYCLE[nextIdx] ?? "all" });
        return;
      }

      if (!event.ctrl && !event.meta && keyName === "d") {
        const curDept = state.taskFilter.department;
        const curIdx = DEPT_CYCLE.indexOf(curDept);
        const nextIdx = (curIdx + 1) % DEPT_CYCLE.length;
        controller.setTaskFilter({ department: DEPT_CYCLE[nextIdx] ?? "all" });
        return;
      }

      if (!event.ctrl && !event.meta && keyName === "x") {
        controller.resetTaskFilter();
        return;
      }

      // 6. Quick Execution controls on selected task (A2)
      if (selectedTask) {
        const actions = controller.getState().selectedTaskDetail?.availableActions ?? {
          canPause: selectedTask.status === "running",
          canResume: selectedTask.status === "waiting_for_input" || selectedTask.status === "blocked",
          canCancel: selectedTask.status !== "completed" && selectedTask.status !== "cancelled",
          canRetry: selectedTask.status === "failed" || selectedTask.status === "cancelled",
        };

        if (!event.ctrl && !event.meta && keyName === "p" && actions.canPause) {
          void controller.pauseTask(selectedTask.id);
          return;
        }

        if (!event.ctrl && !event.meta && keyName === "r" && actions.canRetry) {
          void controller.retryTask(selectedTask.id);
          return;
        }
      }
    },
    [
      state,
      controller,
      filteredTasks,
      selectedTask,
      detail,
      createField,
      createTitle,
      createDesc,
      createDept,
      createPriority,
    ]
  );

  useKeyboard(handleKeyboard);

  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case "completed":
        return THEME_COLORS.statusSuccess;
      case "running":
        return THEME_COLORS.statusInfo;
      case "failed":
        return THEME_COLORS.statusDanger;
      case "waiting_for_approval":
        return THEME_COLORS.statusApproval;
      case "waiting_for_input":
      case "blocked":
      case "queued":
        return THEME_COLORS.statusWarning;
      case "cancelled":
      case "draft":
      case "planned":
      default:
        return THEME_COLORS.fgMuted;
    }
  };

  const getPriorityColor = (priority: TaskPriority): string => {
    switch (priority) {
      case "urgent":
        return THEME_COLORS.statusDanger;
      case "high":
        return THEME_COLORS.statusWarning;
      case "medium":
        return THEME_COLORS.statusInfo;
      case "low":
      default:
        return THEME_COLORS.fgDim;
    }
  };

  // =========================================================================
  // VIEW RENDER: Detail Mode
  // =========================================================================
  if (state.taskViewMode === "detail" && detail) {
    const task = detail.task;
    const actions = detail.availableActions;
    const statusMeta = TASK_STATUS_UI[task.status];
    const priorityMeta = TASK_PRIORITY_UI[task.priority];
    const deptMeta = DEPARTMENT_UI[task.department];
    const statusColor = getStatusColor(task.status);
    const priorityColor = getPriorityColor(task.priority);

    const spendUsd = detail.budgetSummary?.usedSpendUsd ?? 0;
    const maxSpend = detail.budgetSummary?.maxSpendUsd ?? 10.0;
    const pct = Math.min(100, Math.round((spendUsd / maxSpend) * 100));

    return (
      <box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
        {/* Detail Header & Action Controls */}
        <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
          <box flexDirection="row" alignItems="center">
            <text fg={THEME_COLORS.fgMuted}>[Esc/b] Back </text>
            <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
              TASK: {task.title}
            </text>
            <text fg={THEME_COLORS.fgDim}> ({task.id})</text>
          </box>

          {/* Safe Execution Controls (A2) */}
          <box flexDirection="row" alignItems="center">
            {actions.canPause && (
              <text fg={THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD}>
                {" "}[p] Pause
              </text>
            )}
            {actions.canResume && (
              <text fg={THEME_COLORS.statusSuccess} attributes={TextAttributes.BOLD}>
                {" "}[s] Resume
              </text>
            )}
            {actions.canCancel && (
              <text fg={THEME_COLORS.statusDanger} attributes={TextAttributes.BOLD}>
                {" "}[x] Cancel
              </text>
            )}
            {actions.canRetry && (
              <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
                {" "}[r] Retry
              </text>
            )}
          </box>
        </box>

        {/* Status / Priority / Department Badges */}
        <box flexDirection="row" alignItems="center" marginBottom={1}>
          <text fg={statusColor} attributes={TextAttributes.BOLD}>
            [{statusMeta?.shortLabel ?? task.status.toUpperCase()}]{" "}
          </text>
          <text fg={priorityColor}>
            [{priorityMeta?.shortLabel ?? task.priority.toUpperCase()}]{" "}
          </text>
          <text fg={deptMeta?.color ?? THEME_COLORS.fgDim}>
            [{deptMeta?.label ?? task.department}]{" "}
          </text>
          {deptMeta?.isSimulated && (
            <text fg={THEME_COLORS.statusSimulated} attributes={TextAttributes.BOLD}>
              {GLYPHS.simulatedTag}{" "}
            </text>
          )}
          <text fg={THEME_COLORS.fgDim}>
            Created: {new Date(task.createdAt).toLocaleString()}
          </text>
        </box>

        {/* Description Banner */}
        <box
          flexDirection="column"
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={1}
          paddingY={0}
          marginBottom={1}
        >
          <text fg={THEME_COLORS.fgSecondary}>{task.description}</text>
        </box>

        {/* Urgent Alert Banner: Failure Reason (if failed) */}
        {(task.status === "failed" || task.failureReason) && (
          <box
            flexDirection="column"
            border={true}
            borderStyle="single"
            borderColor={THEME_COLORS.statusDanger}
            backgroundColor={THEME_COLORS.bgCardElevated}
            paddingX={1}
            marginBottom={1}
          >
            <text fg={THEME_COLORS.statusDanger} attributes={TextAttributes.BOLD}>
              {GLYPHS.statusError} TASK FAILED: {task.failureReason ?? "Execution aborted due to step failure"}
            </text>
            <text fg={THEME_COLORS.fgMuted}>
              You can retry this task with safe execution control [r] Retry once blockers are addressed.
            </text>
          </box>
        )}

        {/* Consequential Action Approval Gate Banner */}
        {(task.status === "waiting_for_approval" || detail.approvals.length > 0) && (
          <box
            flexDirection="column"
            border={true}
            borderStyle="single"
            borderColor={THEME_COLORS.statusApproval}
            backgroundColor={THEME_COLORS.bgCardElevated}
            paddingX={1}
            marginBottom={1}
          >
            <text fg={THEME_COLORS.statusApproval} attributes={TextAttributes.BOLD}>
              {GLYPHS.lock} HUMAN APPROVAL GATE REQUIRED ({detail.approvals.length} pending)
            </text>
            {detail.approvals.map((app) => (
              <box key={app.id} flexDirection="row" marginTop={0}>
                <text fg={THEME_COLORS.fgMuted}>• Action: </text>
                <text fg={THEME_COLORS.statusApproval} attributes={TextAttributes.BOLD}>
                  {app.toolId ?? app.actionType}{" "}
                </text>
                <text fg={THEME_COLORS.statusDanger}>
                  {app.riskLevel && app.riskLevel in TOOL_RISK_UI
                    ? TOOL_RISK_UI[app.riskLevel as keyof typeof TOOL_RISK_UI]?.badge
                    : "[HIGH]"}{" "}
                </text>
                <text fg={THEME_COLORS.fgPrimary}>
                  {app.description ?? "Consequential side effect"}
                </text>
              </box>
            ))}
          </box>
        )}

        {/* Assigned Profile & Plan Progression */}
        <box flexDirection="row" flexGrow={1} marginBottom={1}>
          {/* Left Sub-column: Assigned Profile & Budget Gauge */}
          <box
            flexDirection="column"
            width="35%"
            border={true}
            borderStyle="single"
            borderColor={THEME_COLORS.borderDefault}
            backgroundColor={THEME_COLORS.bgCard}
            paddingX={1}
            marginRight={1}
          >
            <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD} marginBottom={1}>
              {GLYPHS.wsEcosystem} ASSIGNED AGENT
            </text>
            {detail.assignedProfile ? (
              <box flexDirection="column">
                <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
                  {detail.assignedProfile.name}
                </text>
                <text fg={THEME_COLORS.fgMuted}>{detail.assignedProfile.role}</text>
                <text fg={THEME_COLORS.fgDim}>Slug: {detail.assignedProfile.slug}</text>
              </box>
            ) : (
              <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.ITALIC}>
                No specific agent assigned yet (intake scheduled).
              </text>
            )}

            {/* Budget Meter */}
            <box flexDirection="column" marginTop={1}>
              <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
                {GLYPHS.budget} BUDGET & TOKENS
              </text>
              <text fg={THEME_COLORS.fgSecondary}>
                Tokens: {detail.budgetSummary?.usedTokens.toLocaleString() ?? "0"}
              </text>
              <text fg={spendUsd > maxSpend * 0.8 ? THEME_COLORS.statusWarning : THEME_COLORS.statusSuccess}>
                Spend: ${spendUsd.toFixed(2)} / ${maxSpend.toFixed(2)} ({pct}%)
              </text>
            </box>

            {/* Artifacts Produced */}
            <box flexDirection="column" marginTop={1}>
              <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
                {GLYPHS.file} ARTIFACTS ({detail.artifacts.length})
              </text>
              {detail.artifacts.length === 0 ? (
                <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.ITALIC}>
                  No artifacts generated yet.
                </text>
              ) : (
                detail.artifacts.slice(0, 3).map((art) => (
                  <text key={art.id} fg={THEME_COLORS.fgSecondary}>
                    • {art.path}
                  </text>
                ))
              )}
            </box>
          </box>

          {/* Right Sub-column: Plan Steps Progression DAG */}
          <box
            flexDirection="column"
            flexGrow={1}
            border={true}
            borderStyle="single"
            borderColor={THEME_COLORS.borderDefault}
            backgroundColor={THEME_COLORS.bgCard}
            paddingX={1}
          >
            <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD} marginBottom={1}>
              {GLYPHS.wsTasks} PLAN EXECUTION STEPS ({detail.steps.length})
            </text>

            {detail.steps.length === 0 ? (
              <box flexDirection="column" paddingY={1}>
                <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.ITALIC}>
                  No granular plan steps recorded for this task.
                </text>
              </box>
            ) : (
              <box flexDirection="column">
                {detail.steps.map((step) => {
                  const stepStatusColor =
                    step.status === "completed"
                      ? THEME_COLORS.statusSuccess
                      : step.status === "running"
                      ? THEME_COLORS.statusInfo
                      : step.status === "failed"
                      ? THEME_COLORS.statusDanger
                      : THEME_COLORS.fgDim;

                  return (
                    <box key={step.id} flexDirection="column" marginBottom={1}>
                      <box flexDirection="row" alignItems="center">
                        <text fg={stepStatusColor} attributes={TextAttributes.BOLD}>
                          Step {step.stepIndex}: {step.title}{" "}
                        </text>
                        <text fg={stepStatusColor}>[{step.status.toUpperCase()}]</text>
                      </box>
                      <text fg={THEME_COLORS.fgDim}>{step.description}</text>
                      {step.assignedAgentId && (
                        <text fg={THEME_COLORS.fgMuted}>
                          Assigned: {step.assignedAgentId}
                        </text>
                      )}
                    </box>
                  );
                })}
              </box>
            )}
          </box>
        </box>
      </box>
    );
  }

  // =========================================================================
  // VIEW RENDER: Create Mode
  // =========================================================================
  if (state.taskViewMode === "create") {
    return (
      <box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
        <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            {GLYPHS.wsTasks} CREATE NEW TASK & DRAFT PLAN
          </text>
          <text fg={THEME_COLORS.fgDim}>[Esc] Cancel • [Tab] Next Field • [Enter] Submit</text>
        </box>

        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          borderColor={THEME_COLORS.borderFocused}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={2}
          paddingY={1}
        >
          {/* Field 1: Title */}
          <box flexDirection="column" marginBottom={1}>
            <text
              fg={createField === "title" ? THEME_COLORS.statusInfo : THEME_COLORS.fgMuted}
              attributes={TextAttributes.BOLD}
            >
              Task Title {createField === "title" ? "◀ (Typing)" : ""}
            </text>
            <box backgroundColor={THEME_COLORS.bgInput} paddingX={1}>
              <text fg={createTitle ? THEME_COLORS.fgPrimary : THEME_COLORS.fgDim}>
                {createTitle || "e.g. Implement user authentication endpoint with rate limiting"}
              </text>
            </box>
          </box>

          {/* Field 2: Description */}
          <box flexDirection="column" marginBottom={1}>
            <text
              fg={createField === "desc" ? THEME_COLORS.statusInfo : THEME_COLORS.fgMuted}
              attributes={TextAttributes.BOLD}
            >
              Task Description & Constraints {createField === "desc" ? "◀ (Typing)" : ""}
            </text>
            <box backgroundColor={THEME_COLORS.bgInput} paddingX={1}>
              <text fg={createDesc ? THEME_COLORS.fgPrimary : THEME_COLORS.fgDim}>
                {createDesc || "Provide detailed task requirements and deliverables"}
              </text>
            </box>
          </box>

          {/* Field 3: Department */}
          <box flexDirection="column" marginBottom={1}>
            <text
              fg={createField === "dept" ? THEME_COLORS.statusInfo : THEME_COLORS.fgMuted}
              attributes={TextAttributes.BOLD}
            >
              Primary Department {createField === "dept" ? "◀ (Press Space to cycle)" : ""}
            </text>
            <box flexDirection="row">
              <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
                [{DEPARTMENT_UI[createDept]?.label ?? createDept}]{" "}
              </text>
              {DEPARTMENT_UI[createDept]?.isSimulated && (
                <text fg={THEME_COLORS.statusSimulated}>
                  {GLYPHS.simulatedTag}
                </text>
              )}
            </box>
          </box>

          {/* Field 4: Priority */}
          <box flexDirection="column" marginBottom={1}>
            <text
              fg={createField === "priority" ? THEME_COLORS.statusInfo : THEME_COLORS.fgMuted}
              attributes={TextAttributes.BOLD}
            >
              Priority {createField === "priority" ? "◀ (Press Space to cycle)" : ""}
            </text>
            <text fg={getPriorityColor(createPriority)} attributes={TextAttributes.BOLD}>
              [{createPriority.toUpperCase()}]
            </text>
          </box>

          {/* Intake Note */}
          <box flexDirection="column" marginTop={1}>
            <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.ITALIC}>
              Note: Terrarium planning decomposes requests into verified steps without executing tools
              or calling external model APIs prematurely.
            </text>
          </box>
        </box>
      </box>
    );
  }

  // =========================================================================
  // VIEW RENDER: List Mode
  // =========================================================================
  const isCleanInstall = state.tasks.length === 0;

  // Breakdowns
  const runningCount = state.tasks.filter((t) => t.status === "running").length;
  const queuedCount = state.tasks.filter((t) => t.status === "queued").length;
  const approvalCount = state.tasks.filter((t) => t.status === "waiting_for_approval").length;
  const completedCount = state.tasks.filter((t) => t.status === "completed").length;
  const failedCount = state.tasks.filter((t) => t.status === "failed").length;

  return (
    <box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* 1. Header Banner */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            {GLYPHS.wsTasks} TASK MANAGER
          </text>
          <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
            {" "}({filteredTasks.length} of {state.tasks.length} tasks)
          </text>
        </box>

        {/* Status Counters */}
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            {runningCount} Running{" "}
          </text>
          <text fg={THEME_COLORS.statusWarning}>
            {queuedCount} Queued{" "}
          </text>
          {approvalCount > 0 && (
            <text fg={THEME_COLORS.statusApproval} attributes={TextAttributes.BOLD}>
              {approvalCount} Gate(s){" "}
            </text>
          )}
          <text fg={THEME_COLORS.statusSuccess}>
            {completedCount} Done{" "}
          </text>
          {failedCount > 0 && (
            <text fg={THEME_COLORS.statusDanger} attributes={TextAttributes.BOLD}>
              {failedCount} Failed
            </text>
          )}
        </box>
      </box>

      {/* 2. Filter Bar */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        backgroundColor={THEME_COLORS.bgCard}
        paddingX={1}
        paddingY={0}
        marginBottom={1}
      >
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.fgMuted}>Filter: </text>
          <text fg={THEME_COLORS.statusInfo}>
            Status [{state.taskFilter.status.toUpperCase()}][s]{" "}
          </text>
          <text fg={THEME_COLORS.statusWarning}>
            Priority [{state.taskFilter.priority.toUpperCase()}][p]{" "}
          </text>
          <text fg={THEME_COLORS.statusAccent}>
            Dept [{state.taskFilter.department}][d]{" "}
          </text>
          {(state.taskFilter.status !== "all" ||
            state.taskFilter.priority !== "all" ||
            state.taskFilter.department !== "all") && (
            <text fg={THEME_COLORS.fgDim}>[x] Reset</text>
          )}
        </box>

        <box flexDirection="row" alignItems="center">
          <text fg={showActivitySplit ? THEME_COLORS.statusInfo : THEME_COLORS.fgDim}>
            [a] {showActivitySplit ? "Hide Activity" : "Activity Stream"}
          </text>
        </box>
      </box>

      {/* 3. Main Content: Empty State vs Task Table */}
      {isCleanInstall ? (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          borderColor={THEME_COLORS.borderDefault}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={2}
          paddingY={2}
          alignItems="center"
          justifyContent="center"
          flexGrow={1}
        >
          <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
            {GLYPHS.wsTasks} NO TASKS RECORDED
          </text>
          <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.ITALIC} marginTop={1}>
            Clean installation: No tasks have been submitted or scheduled yet.
          </text>
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD} marginTop={1}>
            Press [c] to create and plan your first task.
          </text>
        </box>
      ) : filteredTasks.length === 0 ? (
        <box
          flexDirection="column"
          paddingY={2}
          alignItems="center"
          justifyContent="center"
          flexGrow={1}
        >
          <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.ITALIC}>
            No tasks match the active filters.
          </text>
          <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.DIM}>
            Press [x] to reset all filters.
          </text>
        </box>
      ) : (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          borderColor={THEME_COLORS.borderDefault}
          backgroundColor={THEME_COLORS.bgCard}
          flexGrow={1}
        >
          {/* Table Header Row */}
          <box
            flexDirection="row"
            border={true}
            borderStyle="single"
            borderColor={THEME_COLORS.borderSubtle}
            backgroundColor={THEME_COLORS.bgCardElevated}
            paddingX={1}
          >
            <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD} width={3}>
              {" "}
            </text>
            <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD} width={12}>
              STATUS
            </text>
            <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD} width={10}>
              PRIORITY
            </text>
            <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD} width={16}>
              DEPARTMENT
            </text>
            <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD} flexGrow={1}>
              TITLE
            </text>
            <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD} width={12}>
              CREATED
            </text>
          </box>

          {/* Task Rows (High volume support with page windowing) */}
          {filteredTasks.slice(0, 15).map((task, idx) => {
            const isSelected = idx === state.selectedTaskIndex;
            const statusMeta = TASK_STATUS_UI[task.status];
            const priorityMeta = TASK_PRIORITY_UI[task.priority];
            const deptMeta = DEPARTMENT_UI[task.department];
            const statusColor = getStatusColor(task.status);
            const priorityColor = getPriorityColor(task.priority);

            return (
              <box
                key={task.id}
                flexDirection="row"
                alignItems="center"
                backgroundColor={isSelected ? THEME_COLORS.bgActive : undefined}
                paddingX={1}
              >
                <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD} width={3}>
                  {isSelected ? "▶" : " "}
                </text>
                <text fg={statusColor} attributes={TextAttributes.BOLD} width={12}>
                  [{statusMeta?.shortLabel ?? task.status.slice(0, 4).toUpperCase()}]
                </text>
                <text fg={priorityColor} width={10}>
                  [{priorityMeta?.shortLabel ?? task.priority.slice(0, 4).toUpperCase()}]
                </text>
                <text fg={deptMeta?.color ?? THEME_COLORS.fgDim} width={16}>
                  {deptMeta?.shortCode ?? task.department.slice(0, 10)}
                  {deptMeta?.isSimulated ? " [S]" : ""}
                </text>
                <text
                  fg={isSelected ? THEME_COLORS.fgPrimary : THEME_COLORS.fgSecondary}
                  attributes={isSelected ? TextAttributes.BOLD : undefined}
                  flexGrow={1}
                >
                  {task.title.length > 40 ? `${task.title.slice(0, 38)}...` : task.title}
                </text>
                <text fg={THEME_COLORS.fgDim} width={12}>
                  {new Date(task.createdAt).toLocaleTimeString()}
                </text>
              </box>
            );
          })}
        </box>
      )}

      {/* 4. Optional Activity Stream Split View */}
      {showActivitySplit && (
        <box marginTop={1}>
          <ActivityFeed title="TASK ACTIVITY STREAM" maxItems={5} compact={true} />
        </box>
      )}

      {/* 5. Bottom Shortcut Legend */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={1}>
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.fgDim}>
            [↑/↓ j/k] Navigate • [Enter] Inspect • [c] New Task • [s/p/d] Filters • [a] Activity
          </text>
        </box>
        {selectedTask && (
          <box flexDirection="row" alignItems="center">
            {selectedTask.status === "running" && (
              <text fg={THEME_COLORS.statusWarning}>[p] Pause </text>
            )}
            {(selectedTask.status === "failed" || selectedTask.status === "cancelled") && (
              <text fg={THEME_COLORS.statusInfo}>[r] Retry </text>
            )}
          </box>
        )}
      </box>
    </box>
  );
}
