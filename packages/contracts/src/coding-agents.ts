/**
 * @terrarium/contracts - coding-agents.ts
 *
 * Domain contracts, interfaces, and types for Universal Coding Agent Integrations.
 * Provides a provider-neutral abstraction layer for external coding agent CLIs,
 * IDE-integrated tools, protocol runtimes (ACP/MCP), and local autonomous coding runners.
 * Contributed by A1 (Platform & Architecture).
 */

import { type Result, ok, fail } from "./base.ts";
import { type TerrariumError, DomainValidationError, type ValidationIssue } from "./errors.ts";
import { isRecord, validateString, validateEnum, validateArray, validateBoolean, ValidationCollector } from "./validation-helpers.ts";

/**
 * Supported coding agent tool identifiers.
 */
export const CODING_AGENT_TYPES = [
  "claude_code",
  "codex_cli",
  "opencode",
  "gemini_cli",
  "cursor",
  "aider",
  "custom_subprocess",
] as const;

export type CodingAgentType = (typeof CODING_AGENT_TYPES)[number];

/**
 * Architectural category of the coding agent integration.
 */
export const CODING_AGENT_CATEGORIES = [
  "cli_process",       // Standalone CLI invoked via safe subprocess (e.g. claude, codex, opencode, gemini)
  "ide_agent",         // Embedded or extension agent running inside an IDE editor (e.g. Cursor, Continue)
  "protocol_runtime",  // Protocol-based agent communicating over ACP or MCP (e.g. OpenCode ACP)
  "local_daemon",      // Local long-lived background service (e.g. Codex app-server)
] as const;

export type CodingAgentCategory = (typeof CODING_AGENT_CATEGORIES)[number];

/**
 * Operational compatibility tier for a coding agent tool.
 */
export const CODING_AGENT_COMPATIBILITY_TIERS = [
  "supported",          // Fully tested with official headless/non-interactive interface
  "partially_supported",// Supported for specific sub-commands or with environmental constraints
  "experimental",       // Early integration, subject to CLI argument changes or beta stability
  "unavailable",        // Tool is not installed on host system
  "not_tested",         // Discovered on host but compatibility not yet verified
] as const;

export type CodingAgentCompatibility = (typeof CODING_AGENT_COMPATIBILITY_TIERS)[number];

/**
 * Supported execution and invocation modes for a coding agent.
 */
export const CODING_AGENT_INVOCATION_MODES = [
  "headless_batch",      // Non-interactive batch execution (e.g. claude -p, codex exec, gemini -p)
  "interactive_session", // PTY or interactive terminal session
  "acp_protocol",        // Agent Client Protocol server/client
  "mcp_protocol",        // Model Context Protocol tools/resources
  "daemon_rpc",          // Local daemon JSON-RPC or HTTP API
] as const;

export type CodingAgentInvocationMode = (typeof CODING_AGENT_INVOCATION_MODES)[number];

/**
 * Execution policy for Claude Code launcher (Prompt 24).
 * standard: default mode, Claude Code's normal permission prompts are strictly preserved.
 * isolated_bypass: dangerous-permissions flag (--dangerously-skip-permissions) enabled ONLY inside verified isolation.
 */
export const CLAUDE_CODE_EXECUTION_POLICIES = [
  "standard",
  "isolated_bypass",
] as const;

export type ClaudeCodeExecutionPolicy = (typeof CLAUDE_CODE_EXECUTION_POLICIES)[number];

/**
 * Isolation verification status for dangerous execution modes.
 */
export const ISOLATION_STATUSES = [
  "verified",        // Verified isolated directory/worktree with credentials shielded
  "unsupported",     // Host/path cannot satisfy isolation
  "failed",          // Verification check failed (e.g. root or home dir, or sensitive files exposed)
  "not_requested",   // Standard mode does not mandate isolated bypass
] as const;

export type IsolationStatus = (typeof ISOLATION_STATUSES)[number];

/**
 * Detailed report of an isolation boundary verification.
 */
export interface IsolationVerificationReport {
  readonly isIsolated: boolean;
  readonly status: IsolationStatus;
  readonly workspaceRoot: string;
  readonly isWorktree: boolean;
  readonly isHomeDirOrRoot: boolean;
  readonly shieldedPaths: readonly string[];
  readonly exposedSensitivePaths: readonly string[];
  readonly networkPolicy: "unrestricted" | "host_only" | "disabled" | "unknown";
  readonly containerOrOsSandboxActive: boolean;
  readonly failureReason?: string;
  readonly honestLimitations: readonly string[];
}

/**
 * Lifecycle states of an interactive or subprocess coding agent session.
 */
export const CODING_AGENT_SESSION_STATES = [
  "discovered",
  "validated",
  "awaiting_approval",
  "preparing_isolation",
  "launching",
  "running",
  "stopping",
  "completed",
  "failed",
  "cancelled",
] as const;

export type CodingAgentSessionState = (typeof CODING_AGENT_SESSION_STATES)[number];

/**
 * Standardized session metadata tracked across the coding agent lifecycle.
 */
export interface CodingAgentSessionMetadata {
  readonly sessionId: string;
  readonly tool: CodingAgentType;
  readonly executablePath: string;
  readonly detectedVersion: string;
  readonly executionPolicy: ClaudeCodeExecutionPolicy;
  readonly isolationStatus: IsolationStatus;
  readonly isolationReport?: IsolationVerificationReport;
  readonly workspaceRoot: string;
  readonly argv: readonly string[];
  readonly state: CodingAgentSessionState;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly exitCode?: number;
  readonly terminationReason?: string;
  readonly durationMs?: number;
}

/**
 * Launch configuration for the first-class Claude Code command.
 */
export interface ClaudeCodeLaunchOptions {
  readonly rawArgs: readonly string[];
  readonly passthroughArgs: readonly string[];
  readonly executionPolicy: ClaudeCodeExecutionPolicy;
  readonly explicitOptIn: boolean;
  readonly confirmed: boolean;
  readonly workspaceRoot: string;
  readonly customExecutablePath?: string;
  readonly dryRun?: boolean;
  readonly interactive?: boolean;
  readonly allowNetwork?: boolean;
  readonly envOverrides?: Readonly<Record<string, string>>;
}

/**
 * Capabilities declared by a coding agent adapter.
 */
export interface CodingAgentCapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsDiffOutput: boolean;
  readonly supportsSessionContinuity: boolean;
  readonly supportsWorktreeIsolation: boolean;
  readonly supportsCancellation: boolean;
  readonly supportsStructuredJson: boolean;
  readonly requiresWorkspaceTrust: boolean;
}

/**
 * Metadata and specification for a coding agent adapter.
 */
export interface CodingAgentMetadata {
  readonly id: CodingAgentType;
  readonly name: string;
  readonly category: CodingAgentCategory;
  readonly executableName: string;
  readonly testedVersions: readonly string[];
  readonly detectedVersion?: string;
  readonly isInstalled: boolean;
  readonly executablePath?: string;
  readonly compatibility: CodingAgentCompatibility;
  readonly supportedModes: readonly CodingAgentInvocationMode[];
  readonly capabilities: CodingAgentCapabilities;
  readonly defaultTimeoutMs: number;
  readonly securityNotes: readonly string[];
  readonly limitations: readonly string[];
}

/**
 * Execution request payload delivered to a coding agent adapter.
 */
export interface CodingAgentExecutionRequest {
  readonly taskId: string;
  readonly prompt: string;
  readonly workingDirectory: string;
  readonly contextFiles?: readonly string[];
  readonly timeoutMs?: number;
  readonly maxTokens?: number;
  readonly readOnly?: boolean;
  readonly allowNetwork?: boolean;
  readonly allowWorktree?: boolean;
  readonly envOverrides?: Readonly<Record<string, string>>;
}

/**
 * Standardized execution result returned by a coding agent adapter.
 */
export interface CodingAgentExecutionResult {
  readonly success: boolean;
  readonly agentId: CodingAgentType;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly diff?: string;
  readonly artifactsProduced: readonly string[];
  readonly tokenUsage?: {
    readonly promptTokens?: number;
    readonly completionTokens?: number;
    readonly totalTokens?: number;
  };
  readonly error?: string;
  readonly timedOut?: boolean;
  readonly cancelled?: boolean;
}

/**
 * Context preview metadata presented to the user before dispatching to an external agent.
 */
export interface CodingAgentContextPreview {
  readonly agentId: CodingAgentType;
  readonly agentName: string;
  readonly category: CodingAgentCategory;
  readonly isRemoteService: boolean;
  readonly destinationEndpoint?: string;
  readonly workingDirectory: string;
  readonly promptPreview: string;
  readonly includedFiles: readonly string[];
  readonly readOnly: boolean;
  readonly requiresApproval: boolean;
  readonly estimatedRisk: "low" | "medium" | "high";
}

/**
 * Project-level allowlist/denylist policy for coding agents.
 */
export interface CodingAgentRoutingPolicy {
  readonly defaultAgentId?: CodingAgentType;
  readonly allowedAgentIds?: readonly CodingAgentType[];
  readonly blockedAgentIds?: readonly CodingAgentType[];
  readonly forceApprovalForMutation: boolean;
  readonly maxTimeoutMs: number;
  readonly worktreeIsolationDefault: boolean;
}

/**
 * Provider-neutral Coding Agent Adapter contract.
 */
export interface CodingAgentAdapter {
  readonly metadata: CodingAgentMetadata;
  detect(): Promise<boolean>;
  execute(
    request: CodingAgentExecutionRequest,
    onChunk?: (chunk: string) => void
  ): Promise<CodingAgentExecutionResult>;
  cancel(taskId: string): Promise<boolean>;
}

/**
 * Validates a CodingAgentExecutionRequest.
 */
export function validateCodingAgentExecutionRequest(
  value: unknown,
  path = "request"
): Result<CodingAgentExecutionRequest, ValidationIssue[]> {
  if (!isRecord(value)) {
    return fail([{ path, message: "Expected object for CodingAgentExecutionRequest", received: value }]);
  }

  const collector = new ValidationCollector();
  const taskId = collector.check(validateString(value.taskId, `${path}.taskId`, { minLength: 1 }));
  const prompt = collector.check(validateString(value.prompt, `${path}.prompt`, { minLength: 1 }));
  const workingDirectory = collector.check(validateString(value.workingDirectory, `${path}.workingDirectory`, { minLength: 1 }));

  let contextFiles: readonly string[] | undefined;
  if (value.contextFiles !== undefined) {
    contextFiles = collector.check(
      validateArray(value.contextFiles, `${path}.contextFiles`, (f, fPath) =>
        validateString(f, fPath, { minLength: 1 })
      )
    );
  }

  if (collector.hasIssues() || taskId === undefined || prompt === undefined || workingDirectory === undefined) {
    return fail(collector.issues);
  }

  return ok({
    taskId,
    prompt,
    workingDirectory,
    contextFiles,
    timeoutMs: typeof value.timeoutMs === "number" ? value.timeoutMs : undefined,
    maxTokens: typeof value.maxTokens === "number" ? value.maxTokens : undefined,
    readOnly: typeof value.readOnly === "boolean" ? value.readOnly : undefined,
    allowNetwork: typeof value.allowNetwork === "boolean" ? value.allowNetwork : undefined,
    allowWorktree: typeof value.allowWorktree === "boolean" ? value.allowWorktree : undefined,
    envOverrides: isRecord(value.envOverrides) ? (value.envOverrides as Record<string, string>) : undefined,
  });
}
