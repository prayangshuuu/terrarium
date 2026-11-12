/**
 * @terrarium/core - coding-agents/gemini-cli-adapter.ts
 *
 * Coding Agent Adapter for Google Gemini CLI.
 * Uses official non-interactive mode (`gemini -p "<prompt>"`).
 * Contributed by A2 (Orchestration & AI Runtime).
 */

import {
  type CodingAgentExecutionRequest,
  type CodingAgentExecutionResult,
  type CodingAgentMetadata,
} from "@terrarium/contracts";
import { BaseCodingAgentAdapter } from "./base-coding-agent-adapter.ts";

export class GeminiCliAdapter extends BaseCodingAgentAdapter {
  readonly metadata: CodingAgentMetadata = {
    id: "gemini_cli",
    name: "Google Gemini CLI",
    category: "cli_process",
    executableName: "gemini",
    testedVersions: ["0.53.1", "0.5x"],
    detectedVersion: "0.53.1",
    isInstalled: true,
    compatibility: "supported",
    supportedModes: ["headless_batch", "acp_protocol", "interactive_session"],
    capabilities: {
      supportsStreaming: true,
      supportsDiffOutput: true,
      supportsSessionContinuity: false,
      supportsWorktreeIsolation: true,
      supportsCancellation: true,
      supportsStructuredJson: false,
      requiresWorkspaceTrust: true,
    },
    defaultTimeoutMs: 60000,
    securityNotes: [
      "Executes non-interactively via 'gemini -p'.",
      "Requires GEMINI_API_KEY environment variable.",
      "Worktree isolation supported via -w flag.",
    ],
    limitations: [
      "Headless mode outputs response directly to stdout.",
      "Approval mode defaults to interactive unless configured.",
    ],
  };

  async execute(
    request: CodingAgentExecutionRequest,
    onChunk?: (chunk: string) => void
  ): Promise<CodingAgentExecutionResult> {
    const args: string[] = ["gemini", "-p", request.prompt];

    return this.runSubprocess(request.taskId, {
      command: args,
      cwd: request.workingDirectory,
      env: request.envOverrides as Record<string, string>,
      timeoutMs: request.timeoutMs,
      onChunk,
    });
  }
}
