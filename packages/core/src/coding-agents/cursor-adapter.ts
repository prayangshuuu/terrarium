/**
 * @terrarium/core - coding-agents/cursor-adapter.ts
 *
 * Coding Agent Adapter for Cursor IDE Agent.
 * Honest compatibility: Cursor CLI requires an active Cursor editor installation or `cursor agent` daemon.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 */

import {
  type CodingAgentExecutionRequest,
  type CodingAgentExecutionResult,
  type CodingAgentMetadata,
} from "@terrarium/contracts";
import { BaseCodingAgentAdapter } from "./base-coding-agent-adapter.ts";

export class CursorAdapter extends BaseCodingAgentAdapter {
  readonly metadata: CodingAgentMetadata = {
    id: "cursor",
    name: "Cursor IDE Agent",
    category: "ide_agent",
    executableName: "cursor",
    testedVersions: ["0.45.x"],
    detectedVersion: undefined,
    isInstalled: true, // CLI binary exists at /Users/prayangshuuu/.local/bin/cursor
    compatibility: "partially_supported",
    supportedModes: ["interactive_session"],
    capabilities: {
      supportsStreaming: false,
      supportsDiffOutput: true,
      supportsSessionContinuity: true,
      supportsWorktreeIsolation: false,
      supportsCancellation: false,
      supportsStructuredJson: false,
      requiresWorkspaceTrust: true,
    },
    defaultTimeoutMs: 30000,
    securityNotes: [
      "Cursor CLI operates primarily as an IDE launcher or requires 'cursor agent' command.",
      "Cannot execute fully detached headless tasks without active editor daemon.",
    ],
    limitations: [
      "No official detached headless batch flag equivalent to 'claude -p' or 'codex exec'.",
      "Requires Cursor IDE GUI running or 'cursor agent' daemon configured.",
    ],
  };

  async execute(
    request: CodingAgentExecutionRequest,
    onChunk?: (chunk: string) => void
  ): Promise<CodingAgentExecutionResult> {
    // Attempt cursor agent command or return clear limitation explanation
    return {
      success: false,
      agentId: "cursor",
      exitCode: 1,
      stdout: "",
      stderr: "Cursor CLI requires an active Cursor IDE application instance or 'cursor agent' daemon running. Headless batch execution is partially supported only via active IDE session.",
      durationMs: 0,
      artifactsProduced: [],
      error: "Cursor requires active IDE installation. Use 'claude_code', 'codex_cli', 'opencode', or 'gemini_cli' for standalone headless execution.",
    };
  }
}
