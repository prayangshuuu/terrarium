/**
 * @terrarium/core - coding-agents/claude-code-adapter.ts
 *
 * Coding Agent Adapter for Anthropic's Claude Code CLI.
 * Uses official non-interactive print mode (`claude -p "<prompt>"`).
 * Contributed by A2 (Orchestration & AI Runtime).
 */

import {
  type CodingAgentExecutionRequest,
  type CodingAgentExecutionResult,
  type CodingAgentMetadata,
} from "@terrarium/contracts";
import { BaseCodingAgentAdapter } from "./base-coding-agent-adapter.ts";

export class ClaudeCodeAdapter extends BaseCodingAgentAdapter {
  readonly metadata: CodingAgentMetadata = {
    id: "claude_code",
    name: "Anthropic Claude Code CLI",
    category: "cli_process",
    executableName: "claude",
    testedVersions: ["2.1.319", "2.1.x"],
    detectedVersion: "2.1.319",
    isInstalled: true,
    compatibility: "supported",
    supportedModes: ["headless_batch", "interactive_session"],
    capabilities: {
      supportsStreaming: true,
      supportsDiffOutput: true,
      supportsSessionContinuity: true,
      supportsWorktreeIsolation: true,
      supportsCancellation: true,
      supportsStructuredJson: false,
      requiresWorkspaceTrust: true,
    },
    defaultTimeoutMs: 60000,
    securityNotes: [
      "Executes in headless batch mode (-p) with constrained cwd.",
      "Requires ANTHROPIC_API_KEY environment variable or active oauth token.",
      "Prompts and outputs are scrubbed for sensitive tokens.",
    ],
    limitations: [
      "Headless batch mode requires specific prompt phrasing for structured output.",
      "Cannot self-elevate permissions beyond the invoking process.",
    ],
  };

  async execute(
    request: CodingAgentExecutionRequest,
    onChunk?: (chunk: string) => void
  ): Promise<CodingAgentExecutionResult> {
    const args: string[] = ["claude", "-p", request.prompt];

    return this.runSubprocess(request.taskId, {
      command: args,
      cwd: request.workingDirectory,
      env: request.envOverrides as Record<string, string>,
      timeoutMs: request.timeoutMs,
      onChunk,
    });
  }
}
