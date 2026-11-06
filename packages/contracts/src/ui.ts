/**
 * @terrarium/contracts - ui.ts
 *
 * User-facing terminology, presentation metadata, status badges, and terminal styling constants.
 * Contributed by A4 (CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns with PLAN.md Section 16 (CLI & Terminal UX) and Section 2 (Product Identity & Principles).
 */

import { type TaskStatus } from "./tasks.ts";
import { type ExecutionStatus } from "./execution.ts";
import { type ApprovalStatus } from "./approvals.ts";
import { type AgentDepartment } from "./departments.ts";

export type TerminalColorName =
  | "default"
  | "dim"
  | "blue"
  | "cyan"
  | "green"
  | "yellow"
  | "red"
  | "magenta"
  | "gray";

export interface StatusUIMetadata {
  readonly label: string;
  readonly shortLabel: string;
  readonly glyph: string;
  readonly color: TerminalColorName;
  readonly description: string;
}

export interface DepartmentUIMetadata {
  readonly label: string;
  readonly shortCode: string;
  readonly color: TerminalColorName;
  readonly isSimulated: boolean;
}

/**
 * Standard UI status indicators for TaskStatus.
 */
export const TASK_STATUS_UI: Readonly<Record<TaskStatus, StatusUIMetadata>> = {
  draft: {
    label: "Draft",
    shortLabel: "DFT",
    glyph: "○",
    color: "gray",
    description: "Task is being formulated and not yet planned",
  },
  planned: {
    label: "Planned",
    shortLabel: "PLN",
    glyph: "◌",
    color: "cyan",
    description: "Task steps and dependencies defined",
  },
  queued: {
    label: "Queued",
    shortLabel: "QUE",
    glyph: "⏳",
    color: "yellow",
    description: "Awaiting execution slot or agent allocation",
  },
  running: {
    label: "Running",
    shortLabel: "RUN",
    glyph: "▶",
    color: "blue",
    description: "Actively being executed by assigned agent",
  },
  waiting_for_input: {
    label: "Waiting for Input",
    shortLabel: "INP",
    glyph: "💬",
    color: "yellow",
    description: "Awaiting clarification or answers from user",
  },
  waiting_for_approval: {
    label: "Waiting for Approval",
    shortLabel: "APP",
    glyph: "🔒",
    color: "magenta",
    description: "Awaiting human authorization for consequential action",
  },
  completed: {
    label: "Completed",
    shortLabel: "DONE",
    glyph: "✓",
    color: "green",
    description: "Deliverables produced and verified against criteria",
  },
  failed: {
    label: "Failed",
    shortLabel: "FAIL",
    glyph: "✗",
    color: "red",
    description: "Task execution encountered an error",
  },
  cancelled: {
    label: "Cancelled",
    shortLabel: "CANC",
    glyph: "⊘",
    color: "gray",
    description: "Task was aborted by user or orchestrator",
  },
  blocked: {
    label: "Blocked",
    shortLabel: "BLCK",
    glyph: "▲",
    color: "red",
    description: "Dependency, permission, or budget threshold blocked execution",
  },
};

/**
 * Standard UI status indicators for ExecutionStatus.
 */
export const EXECUTION_STATUS_UI: Readonly<Record<ExecutionStatus, StatusUIMetadata>> = {
  idle: {
    label: "Idle",
    shortLabel: "IDL",
    glyph: "·",
    color: "dim",
    description: "Registered identity; zero active model execution",
  },
  queued: {
    label: "Queued",
    shortLabel: "QUE",
    glyph: "⏳",
    color: "yellow",
    description: "Awaiting provider dispatch",
  },
  running: {
    label: "Running",
    shortLabel: "RUN",
    glyph: "▶",
    color: "blue",
    description: "Active model token generation or tool invocation",
  },
  completed: {
    label: "Completed",
    shortLabel: "DONE",
    glyph: "✓",
    color: "green",
    description: "Execution finished successfully",
  },
  failed: {
    label: "Failed",
    shortLabel: "FAIL",
    glyph: "✗",
    color: "red",
    description: "Execution failed due to error or provider issue",
  },
  cancelled: {
    label: "Cancelled",
    shortLabel: "CANC",
    glyph: "⊘",
    color: "gray",
    description: "Execution was terminated before completion",
  },
  blocked: {
    label: "Blocked",
    shortLabel: "BLCK",
    glyph: "▲",
    color: "red",
    description: "Execution blocked by permissions or limits",
  },
};

/**
 * Standard UI status indicators for ApprovalStatus.
 */
export const APPROVAL_STATUS_UI: Readonly<Record<ApprovalStatus, StatusUIMetadata>> = {
  pending: {
    label: "Pending Review",
    shortLabel: "PEND",
    glyph: "⏳",
    color: "yellow",
    description: "Requires explicit user decision before proceeding",
  },
  approved: {
    label: "Approved",
    shortLabel: "APPR",
    glyph: "✓",
    color: "green",
    description: "Authorized by user; action permitted to proceed",
  },
  rejected: {
    label: "Rejected",
    shortLabel: "REJ",
    glyph: "✗",
    color: "red",
    description: "Declined by user; action aborted",
  },
  expired: {
    label: "Expired",
    shortLabel: "EXP",
    glyph: "⊘",
    color: "gray",
    description: "Decision timed out without action",
  },
};

/**
 * Standard UI display metadata for AgentDepartment.
 */
export const DEPARTMENT_UI: Readonly<Record<AgentDepartment, DepartmentUIMetadata>> = {
  executive: {
    label: "Executive Leadership",
    shortCode: "EXEC",
    color: "magenta",
    isSimulated: false,
  },
  engineering: {
    label: "Engineering",
    shortCode: "ENG",
    color: "cyan",
    isSimulated: false,
  },
  customer_intelligence: {
    label: "Customer Intelligence (Simulated)",
    shortCode: "CUST",
    color: "yellow",
    isSimulated: true,
  },
  product: {
    label: "Product Management",
    shortCode: "PROD",
    color: "blue",
    isSimulated: false,
  },
  design: {
    label: "Design & UX",
    shortCode: "DSGN",
    color: "magenta",
    isSimulated: false,
  },
  marketing: {
    label: "Marketing & Growth",
    shortCode: "MKTG",
    color: "green",
    isSimulated: false,
  },
  security: {
    label: "Security & Compliance",
    shortCode: "SEC",
    color: "red",
    isSimulated: false,
  },
  research: {
    label: "Research & Intelligence",
    shortCode: "RSCH",
    color: "blue",
    isSimulated: false,
  },
  documentation: {
    label: "Documentation",
    shortCode: "DOCS",
    color: "gray",
    isSimulated: false,
  },
  legal: {
    label: "Legal & Risk",
    shortCode: "LEGL",
    color: "yellow",
    isSimulated: false,
  },
};

/**
 * Canonical user-facing terminology constants.
 * Enforces PLAN.md principles (e.g. simulated personas must never be called real customers).
 */
export const USER_FACING_TERMS = {
  PRODUCT_NAME: "TERRARIUM",
  VIRTUAL_ORGANIZATION: "Virtual Organization",
  DEMAND_BASED_ORCHESTRATION: "Demand-Based Orchestration",
  SIMULATED_PERSONA: "Customer Persona (Simulated)",
  SIMULATED_FEEDBACK: "Simulated Customer Feedback",
  PROJECT_MEMORY: "Project Memory",
  APPROVAL_GATE: "Human Approval Gate",
  ENGINEERING_STUDIO: "Engineering Studio",
  AGENT_DEBATE: "Agent-to-Agent Debate",
  PRESERVED_DISAGREEMENT: "Preserved Specialist Disagreement",
} as const;
