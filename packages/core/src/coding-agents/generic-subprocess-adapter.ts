/**
 * @terrarium/core - coding-agents/generic-subprocess-adapter.ts
 *
 * Configurable generic subprocess adapter for user-defined coding agent executables.
 * Strictly uses argument arrays (NO shell string interpolation).
 * Contributed by A2 (Orchestration & AI Runtime).
 */

import {
  type CodingAgentExecutionRequest,
  type CodingAgentExecutionResult,
  type CodingAgentMetadata,
} from "@terrarium/contracts";
import { BaseCodingAgentAdapter } from "./base-coding-agent-adapter.ts";

export interface GenericSubprocessOptions {
  readonly executableName: string;
  readonly argumentTemplate?: readonly string[];
  readonly defaultTimeoutMs?: number;
}

export class GenericSubprocessAdapter extends BaseCodingAgentAdapter {
  readonly metadata: CodingAgentMetadata;
  private readonly argumentTemplate: readonly string[];

  constructor(options: GenericSubprocessOptions) {
    super();
    this.argumentTemplate = options.argumentTemplate ?? ["{prompt}"];
    this.metadata = {
      id: "custom_subprocess",
      name: `Custom Coding Subprocess (${options.executableName})`,
      category: "cli_process",
      executableName: options.executableName,
      testedVersions: ["custom"],
      isInstalled: false,
      compatibility: "experimental",
      supportedModes: ["headless_batch"],
      capabilities: {
        supportsStreaming: true,
        supportsDiffOutput: true,
        supportsSessionContinuity: false,
        supportsWorktreeIsolation: true,
        supportsCancellation: true,
        supportsStructuredJson: false,
        requiresWorkspaceTrust: true,
      },
      defaultTimeoutMs: options.defaultTimeoutMs ?? 60000,
      securityNotes: [
        "Invokes custom executable using safe argument arrays.",
        "Child process constrained to designated working directory.",
      ],
      limitations: [
        "Relies on custom executable adhering to exit code 0 on success.",
      ],
    };
  }

  async execute(
    request: CodingAgentExecutionRequest,
    onChunk?: (chunk: string) => void
  ): Promise<CodingAgentExecutionResult> {
    const args: string[] = [
      this.metadata.executableName,
      ...this.argumentTemplate.map((arg) => (arg === "{prompt}" ? request.prompt : arg)),
    ];

    return this.runSubprocess(request.taskId, {
      command: args,
      cwd: request.workingDirectory,
      env: request.envOverrides as Record<string, string>,
      timeoutMs: request.timeoutMs,
      onChunk,
    });
  }
}
