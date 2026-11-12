/**
 * @terrarium/contracts - ui.ts
 *
 * User-facing terminology, presentation metadata, status badges, and terminal styling constants.
 * Contributed by A4 (CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns with PLAN.md Section 16 (CLI & Terminal UX) and Section 2 (Product Identity & Principles).
 */

import { type TaskStatus, type TaskPriority } from "./tasks.ts";
import { type ExecutionStatus } from "./execution.ts";
import { type ApprovalStatus } from "./approvals.ts";
import { type AgentDepartment } from "./departments.ts";
import { type ToolRiskLevel } from "./tools.ts";
import { type AgentLifecycleStatus } from "./agent.ts";
import { type EventType, type EventSource } from "./events.ts";
import { type MessageRole, type MessageSenderType } from "./session.ts";
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
 * Standard UI metadata for TaskPriority.
 */
export const TASK_PRIORITY_UI: Readonly<Record<TaskPriority, StatusUIMetadata>> = {
  low: {
    label: "Low",
    shortLabel: "LOW",
    glyph: "▽",
    color: "gray",
    description: "Low priority execution",
  },
  medium: {
    label: "Medium",
    shortLabel: "MED",
    glyph: "○",
    color: "cyan",
    description: "Standard operational priority",
  },
  high: {
    label: "High",
    shortLabel: "HIGH",
    glyph: "▲",
    color: "yellow",
    description: "Elevated execution priority",
  },
  urgent: {
    label: "Urgent",
    shortLabel: "URGT",
    glyph: "⚡",
    color: "red",
    description: "Immediate critical execution",
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
  TOKEN_BUDGET: "Token Budget",
  ESTIMATED_SPEND: "Estimated Cost (Simulated)",
  ESTIMATE_DISCLAIMER: "Estimates are operational approximations, not exact provider invoices (PLAN.md Section 13.3).",
  MODEL_ROUTING: "Model Tier Routing",
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

/**
 * Canonical 10 interactive workspace areas defined in PLAN.md Section 16.2.
 */
export const WORKSPACE_IDS = [
  "overview",
  "ecosystem",
  "departments",
  "conversations",
  "tasks",
  "studio",
  "memory",
  "reports",
  "analytics",
  "settings",
] as const;

export type WorkspaceId = (typeof WORKSPACE_IDS)[number];

export interface WorkspaceMetadata {
  readonly id: WorkspaceId;
  readonly label: string;
  readonly shortLabel: string;
  readonly shortcut: string;
  readonly index: number;
  readonly icon: string;
  readonly description: string;
  readonly plannedPrompt: number;
}

export const WORKSPACE_AREAS: Readonly<Record<WorkspaceId, WorkspaceMetadata>> = {
  overview: {
    id: "overview",
    label: "Overview",
    shortLabel: "OVERVIEW",
    shortcut: "1",
    index: 1,
    icon: "◈",
    description: "System pulse, active agents, queue summary, and recent activity",
    plannedPrompt: 15,
  },
  ecosystem: {
    id: "ecosystem",
    label: "Agent Ecosystem",
    shortLabel: "AGENTS",
    shortcut: "2",
    index: 2,
    icon: "👥",
    description: "Virtual organization directory, specialist profiles, and simulated personas",
    plannedPrompt: 15,
  },
  departments: {
    id: "departments",
    label: "Departments",
    shortLabel: "DEPTS",
    shortcut: "3",
    index: 3,
    icon: "🏛",
    description: "Department hierarchy, leadership teams, and organizational taxonomies",
    plannedPrompt: 15,
  },
  conversations: {
    id: "conversations",
    label: "Conversations",
    shortLabel: "CHATS",
    shortcut: "4",
    index: 4,
    icon: "💬",
    description: "Interactive agent chats, multi-agent debates, and interview sessions",
    plannedPrompt: 16,
  },
  tasks: {
    id: "tasks",
    label: "Task Manager",
    shortLabel: "TASKS",
    shortcut: "5",
    index: 5,
    icon: "📋",
    description: "Task intake, step progression, approval gates, and execution timelines",
    plannedPrompt: 16,
  },
  studio: {
    id: "studio",
    label: "Engineering Studio",
    shortLabel: "STUDIO",
    shortcut: "6",
    index: 6,
    icon: "⚡",
    description: "Safe code workflows, diff reviews, patches, and verification sandboxes",
    plannedPrompt: 17,
  },
  memory: {
    id: "memory",
    label: "Project Memory",
    shortLabel: "MEMORY",
    shortcut: "7",
    index: 7,
    icon: "🧠",
    description: "Durable decisions, rationale, knowledge graph, and conflict detection",
    plannedPrompt: 11,
  },
  reports: {
    id: "reports",
    label: "Reports & Evidence",
    shortLabel: "REPORTS",
    shortcut: "8",
    index: 8,
    icon: "📊",
    description: "Traceable findings, preserved disagreements, and simulated research",
    plannedPrompt: 18,
  },
  analytics: {
    id: "analytics",
    label: "Analytics & Budget",
    shortLabel: "METRICS",
    shortcut: "9",
    index: 9,
    icon: "📈",
    description: "Token meter, spend approximations, latency metrics, and audit logs",
    plannedPrompt: 12,
  },
  settings: {
    id: "settings",
    label: "Settings",
    shortLabel: "CONFIG",
    shortcut: "0",
    index: 10,
    icon: "⚙",
    description: "Provider API keys, models, fallback routing, and safety permissions",
    plannedPrompt: 4,
  },
};

/**
 * Standard UI status indicators for AgentLifecycleStatus (A1, A4 & A5).
 * Distinguishes registered, enabled, selected, executing, paused, and disabled.
 * Aligns with PLAN.md Section 4.1 and PROMPT 15.
 */
export const AGENT_LIFECYCLE_UI: Readonly<Record<AgentLifecycleStatus, StatusUIMetadata>> = {
  registered: {
    label: "Registered",
    shortLabel: "REG",
    glyph: "○",
    color: "gray",
    description: "Catalog identity registered in virtual organization",
  },
  enabled: {
    label: "Enabled",
    shortLabel: "ENB",
    glyph: "●",
    color: "cyan",
    description: "Active and available for demand-based selection",
  },
  selected: {
    label: "Selected",
    shortLabel: "SEL",
    glyph: "◉",
    color: "yellow",
    description: "Chosen by orchestrator to satisfy an upcoming task plan step",
  },
  executing: {
    label: "Executing",
    shortLabel: "RUN",
    glyph: "▶",
    color: "green",
    description: "Actively running an execution instance with model generation",
  },
  paused: {
    label: "Paused",
    shortLabel: "PAUS",
    glyph: "⏸",
    color: "yellow",
    description: "Temporarily held awaiting human approval, input, or resume",
  },
  disabled: {
    label: "Disabled",
    shortLabel: "OFF",
    glyph: "⊘",
    color: "dim",
    description: "Deactivated or deprecated; excluded from candidate matching",
  },
};

/**
 * Overview active execution item contract.
 */
export interface OverviewExecutionItem {
  readonly id: string;
  readonly taskId: string;
  readonly agentProfileId: string;
  readonly agentSlug: string;
  readonly status: ExecutionStatus;
  readonly provider: string;
  readonly model: string;
  readonly startedAt?: string;
}

/**
 * Overview task summary item contract.
 */
export interface OverviewTaskItem {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly priority: string;
  readonly createdAt: string;
}

/**
 * Overview pending approval item contract.
 */
export interface OverviewApprovalItem {
  readonly id: string;
  readonly taskId: string;
  readonly toolName: string;
  readonly riskLevel: ToolRiskLevel;
  readonly requestedAt: string;
  readonly consequenceSummary?: string;
}

/**
 * Real-state Overview dashboard summary contract (Prompt 15).
 * Strictly forbids fabricated numbers or placeholders.
 */
export interface OverviewSummary {
  readonly engineStatus: "ready" | "running" | "paused" | "error" | "disconnected";
  readonly lastUpdatedAt: string;
  readonly isFresh: boolean;
  readonly registeredProfileCount: number;
  readonly activeExecutionCount: number;
  readonly activeTaskCount: number;
  readonly queuedTaskCount: number;
  readonly runningTaskCount: number;
  readonly completedTaskCount: number;
  readonly failedTaskCount: number;
  readonly pendingApprovalCount: number;
  readonly totalSpendUsd: number;
  readonly maxSpendUsd?: number;
  readonly totalTokensUsed: number;
  readonly departmentCounts: Readonly<Record<string, number>>;
  readonly simulatedPersonaCount: number;
  readonly recentExecutions: readonly OverviewExecutionItem[];
  readonly recentTasks: readonly OverviewTaskItem[];
  readonly pendingApprovals: readonly OverviewApprovalItem[];
}

/**
 * Selection rationale recorded during demand-based candidate selection.
 */
export interface AgentSelectionRationale {
  readonly profileId: string;
  readonly profileSlug: string;
  readonly taskId: string;
  readonly stepId?: string;
  readonly rationale: string;
  readonly score: number;
  readonly matchedCapabilities: readonly string[];
  readonly matchedTasks: readonly string[];
  readonly reasons: readonly string[];
  readonly recordedAt: string;
}

/**
 * Filter criteria for the Agent Ecosystem view.
 */
export interface AgentEcosystemFilter {
  readonly searchQuery: string;
  readonly department: AgentDepartment | "all";
  readonly lifecycleStatus: AgentLifecycleStatus | "all";
}

/**
 * Available safe execution actions for a task given its current lifecycle state (Prompt 16).
 * Aligns with assertTaskTransition and PLAN.md Section 5.4.
 */
export interface TaskAvailableActions {
  readonly canPause: boolean;
  readonly canResume: boolean;
  readonly canCancel: boolean;
  readonly canRetry: boolean;
}

/**
 * Returns which execution control operations are legal for a given task status.
 */
export function getAvailableTaskActions(task: { status: TaskStatus }): TaskAvailableActions {
  return {
    canPause: task.status === "running",
    canResume: task.status === "waiting_for_input" || task.status === "blocked",
    canCancel: task.status !== "completed" && task.status !== "cancelled",
    canRetry: task.status === "failed" || task.status === "cancelled",
  };
}

/**
 * Filter criteria for the Task Manager workspace.
 */
export interface TaskFilterState {
  readonly searchQuery: string;
  readonly status: TaskStatus | "all";
  readonly priority: TaskPriority | "all";
  readonly department: AgentDepartment | "all";
}

/**
 * Activity feed item contract for event-backed observable activity stream (Prompt 16).
 */
export interface ActivityFeedEventUI {
  readonly id: string;
  readonly eventType: EventType;
  readonly timestamp: string;
  readonly sequenceNumber?: number;
  readonly source: EventSource;
  readonly entityType: string;
  readonly entityId: string;
  readonly summary: string;
  readonly level: "info" | "warn" | "error" | "debug";
  readonly glyph: string;
  readonly color: TerminalColorName;
}

/**
 * Activity feed connection and replay state contract (Prompt 16).
 */
export interface ActivityFeedState {
  readonly items: readonly ActivityFeedEventUI[];
  readonly isConnected: boolean;
  readonly lastSeenTimestamp?: string;
  readonly lastSeenSequenceNumber?: number;
  readonly replayedMissedEventsCount: number;
}

/**
 * Enhanced UI conversation message representation separating user, agent, tool, and system messages.
 * Includes preserved disagreements, uncertainty level, and simulated customer feedback labels (Prompt 16).
 */
export interface ConversationMessageUI {
  readonly id: string;
  readonly sessionId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly senderRole?: string;
  readonly senderDepartment?: AgentDepartment;
  readonly senderType: MessageSenderType;
  readonly role: MessageRole | "tool";
  readonly content: string;
  readonly timestamp: string;
  readonly isSimulatedPersona: boolean;
  readonly disagreements?: readonly { readonly specialist: string; readonly argument: string }[];
  readonly uncertaintyLevel?: "low" | "medium" | "high" | "critical";
  readonly uncertaintyExplanation?: string;
  readonly citations?: readonly { readonly title: string; readonly pathOrUri: string }[];
  readonly toolCalls?: readonly { readonly name: string; readonly riskLevel: ToolRiskLevel; readonly isConsequential: boolean }[];
}




