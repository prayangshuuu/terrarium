/**
 * @terrarium/core - coding-agents/opencode-adapter.ts
 *
 * Coding Agent Adapter for OpenCode CLI / ACP runtime.
 * Uses official non-interactive command (`opencode run "<prompt>"`).
 * Contributed by A2 (Orchestration & AI Runtime).
 */

import {
  type CodingAgentExecutionRequest,
  type CodingAgentExecutionResult,
  type CodingAgentMetadata,
} from "@terrarium/contracts";
import { BaseCodingAgentAdapter } from "./base-coding-agent-adapter.ts";

export class OpenCodeAdapter extends BaseCodingAgentAdapter {
  readonly metadata: CodingAgentMetadata = {
    id: "opencode",
    name: "OpenCode CLI / ACP Runtime",
    category: "protocol_runtime",
    executableName: "opencode",
    testedVersions: ["1.18.15", "1.18.x"],
    detectedVersion: "1.18.15",
    isInstalled: true,
    compatibility: "supported",
    supportedModes: ["headless_batch", "acp_protocol", "interactive_session"],
    capabilities: {
      supportsStreaming: true,
      supportsDiffOutput: true,
      supportsSessionContinuity: true,
      supportsWorktreeIsolation: true,
      supportsCancellation: true,
      supportsStructuredJson: true,
      requiresWorkspaceTrust: false,
    },
    defaultTimeoutMs: 60000,
    securityNotes: [
      "Executes non-interactively via 'opencode run'.",
      "Supports ACP (Agent Client Protocol) server mode.",
      "Workspace execution sandboxed without automatic sudo.",
    ],
    limitations: [
      "Requires model provider selection or active credentials configured in opencode auth.",
    ],
  };

  async execute(
    request: CodingAgentExecutionRequest,
    onChunk?: (chunk: string) => void
  ): Promise<CodingAgentExecutionResult> {
    const args: string[] = ["opencode", "run", request.prompt];

    return this.runSubprocess(request.taskId, {
      command: args,
      cwd: request.workingDirectory,
      env: request.envOverrides as Record<string, string>,
      timeoutMs: request.timeoutMs,
      onChunk,
    });
  }
}
