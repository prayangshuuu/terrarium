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
import { type ToolRiskLevel } from "./tools.ts";
import {
  type MemoryCategory,
  type MemoryConfidence,
  type MemoryFreshnessStatus,
} from "./memory.ts";

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
  cancelled: {
    label: "Cancelled",
    shortLabel: "CANC",
    glyph: "⊖",
    color: "gray",
    description: "Revoked or cancelled by user or orchestrator",
  },
};

export interface ToolRiskUIMetadata {
  readonly label: string;
  readonly shortLabel: string;
  readonly badge: string;
  readonly color: "green" | "cyan" | "yellow" | "red" | "magenta";
  readonly severity: number;
}

/**
 * Standard UI indicators for ToolRiskLevel.
 */
export const TOOL_RISK_UI: Readonly<Record<ToolRiskLevel, ToolRiskUIMetadata>> = {
  read_only: {
    label: "Read Only",
    shortLabel: "RO",
    badge: "[READ_ONLY]",
    color: "green",
    severity: 0,
  },
  low: {
    label: "Low Risk",
    shortLabel: "LOW",
    badge: "[LOW]",
    color: "cyan",
    severity: 1,
  },
  medium: {
    label: "Medium Risk",
    shortLabel: "MED",
    badge: "[MEDIUM]",
    color: "yellow",
    severity: 2,
  },
  high: {
    label: "High Risk",
    shortLabel: "HIGH",
    badge: "[HIGH]",
    color: "red",
    severity: 3,
  },
  critical: {
    label: "Critical Risk",
    shortLabel: "CRIT",
    badge: "[CRITICAL]",
    color: "magenta",
    severity: 4,
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

/**
 * UI visual indicators for memory freshness status (A4 & A5).
 */
export const MEMORY_FRESHNESS_UI: Readonly<Record<MemoryFreshnessStatus, StatusUIMetadata>> = {
  fresh: {
    label: "Fresh",
    shortLabel: "FRSH",
    glyph: "🟢",
    color: "green",
    description: "Memory is up-to-date and validated for active use",
  },
  stale: {
    label: "Stale",
    shortLabel: "STAL",
    glyph: "🟡",
    color: "yellow",
    description: "Memory has exceeded freshness window and needs revalidation before reliance",
  },
  expired: {
    label: "Expired",
    shortLabel: "EXPD",
    glyph: "🔴",
    color: "red",
    description: "Memory is obsolete and should not be relied upon without verification",
  },
  superseded: {
    label: "Superseded",
    shortLabel: "SPRS",
    glyph: "⚪",
    color: "gray",
    description: "Memory has been replaced by a newer decision or finding",
  },
};

/**
 * UI visual indicators for memory confidence levels (A4 & A5).
 */
export const MEMORY_CONFIDENCE_UI: Readonly<
  Record<MemoryConfidence, { readonly label: string; readonly badge: string; readonly color: TerminalColorName }>
> = {
  confirmed: {
    label: "Confirmed Fact",
    badge: "[CONFIRMED]",
    color: "green",
  },
  hypothesis: {
    label: "Hypothesis (Unverified)",
    badge: "[HYPOTHESIS]",
    color: "yellow",
  },
  inferred: {
    label: "Inferred Finding",
    badge: "[INFERRED]",
    color: "cyan",
  },
  simulated: {
    label: "Simulated Persona",
    badge: "[SIMULATED]",
    color: "magenta",
  },
};

/**
 * UI visual metadata for memory categories (A4 & A5).
 */
export const MEMORY_CATEGORY_UI: Readonly<
  Record<MemoryCategory, { readonly label: string; readonly icon: string; readonly color: TerminalColorName }>
> = {
  project_overview: {
    label: "Project Overview",
    icon: "📋",
    color: "blue",
  },
  confirmed_requirement: {
    label: "Requirement",
    icon: "✅",
    color: "green",
  },
  decision_rationale: {
    label: "Decision Record",
    icon: "⚖️",
    color: "cyan",
  },
  architecture_knowledge: {
    label: "Architecture",
    icon: "🏛️",
    color: "blue",
  },
  research_finding: {
    label: "Research Finding",
    icon: "🔍",
    color: "magenta",
  },
  open_question: {
    label: "Open Question",
    icon: "❓",
    color: "yellow",
  },
  known_risk: {
    label: "Known Risk",
    icon: "⚠️",
    color: "red",
  },
  agent_summary: {
    label: "Agent Task Summary",
    icon: "📝",
    color: "gray",
  },
  user_preference: {
    label: "User Preference",
    icon: "⭐",
    color: "yellow",
  },
};

