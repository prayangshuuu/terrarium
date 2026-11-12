/**
 * @terrarium/core - coding-agents/codex-cli-adapter.ts
 *
 * Coding Agent Adapter for OpenAI Codex CLI.
 * Uses official non-interactive command (`codex exec "<prompt>"`).
 * Contributed by A2 (Orchestration & AI Runtime).
 */

import {
  type CodingAgentExecutionRequest,
  type CodingAgentExecutionResult,
  type CodingAgentMetadata,
} from "@terrarium/contracts";
import { BaseCodingAgentAdapter } from "./base-coding-agent-adapter.ts";

export class CodexCliAdapter extends BaseCodingAgentAdapter {
  readonly metadata: CodingAgentMetadata = {
    id: "codex_cli",
    name: "OpenAI Codex CLI",
    category: "cli_process",
    executableName: "codex",
    testedVersions: ["0.162.1", "0.16x"],
    detectedVersion: "0.162.1",
    isInstalled: true,
    compatibility: "supported",
    supportedModes: ["headless_batch", "interactive_session", "daemon_rpc"],
    capabilities: {
      supportsStreaming: true,
      supportsDiffOutput: true,
      supportsSessionContinuity: false,
      supportsWorktreeIsolation: true,
      supportsCancellation: true,
      supportsStructuredJson: true,
      requiresWorkspaceTrust: true,
    },
    defaultTimeoutMs: 60000,
    securityNotes: [
      "Executes non-interactively via 'codex exec'.",
      "Requires OPENAI_API_KEY environment variable or active session.",
      "Isolated to specified working directory.",
    ],
    limitations: [
      "Non-interactive exec command terminates on task completion.",
      "App-server daemon mode is experimental.",
    ],
  };

  async execute(
    request: CodingAgentExecutionRequest,
    onChunk?: (chunk: string) => void
  ): Promise<CodingAgentExecutionResult> {
    const args: string[] = ["codex", "exec", request.prompt];

    return this.runSubprocess(request.taskId, {
      command: args,
      cwd: request.workingDirectory,
      env: request.envOverrides as Record<string, string>,
      timeoutMs: request.timeoutMs,
      onChunk,
    });
  }
}
