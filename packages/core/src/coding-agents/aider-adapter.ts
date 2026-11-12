/**
 * @terrarium/core - coding-agents/aider-adapter.ts
 *
 * Coding Agent Adapter for Aider CLI.
 * Honest compatibility: Aider is not installed on host system.
 * Contributed by A1 (Platform & Architecture).
 */

import {
  type CodingAgentExecutionRequest,
  type CodingAgentExecutionResult,
  type CodingAgentMetadata,
} from "@terrarium/contracts";
import { BaseCodingAgentAdapter } from "./base-coding-agent-adapter.ts";

export class AiderAdapter extends BaseCodingAgentAdapter {
  readonly metadata: CodingAgentMetadata = {
    id: "aider",
    name: "Aider Coding CLI",
    category: "cli_process",
    executableName: "aider",
    testedVersions: ["0.70.x"],
    detectedVersion: undefined,
    isInstalled: false,
    compatibility: "unavailable",
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
      "Requires Python environment and local Git repository.",
      "Automatically generates git commits unless --no-auto-commits is provided.",
    ],
    limitations: [
      "Not installed on host system ($PATH). Install with 'pip install aider-chat' if authorized.",
    ],
  };

  async execute(
    request: CodingAgentExecutionRequest,
    onChunk?: (chunk: string) => void
  ): Promise<CodingAgentExecutionResult> {
    return {
      success: false,
      agentId: "aider",
      exitCode: 127,
      stdout: "",
      stderr: "Aider executable ('aider') is not installed on host system. Install via 'pip install aider-chat' if authorized by operator.",
      durationMs: 0,
      artifactsProduced: [],
      error: "Aider is unavailable (binary not found on host $PATH).",
    };
  }
}
