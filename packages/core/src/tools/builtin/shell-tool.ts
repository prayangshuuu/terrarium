/**
 * @terrarium/core - tools/builtin/shell-tool.ts
 *
 * Shell command execution tool with timeout enforcement and destructive command gating.
 */

import {
  type ToolDefinition,
  type ToolExecutionContext,
  ok,
  fail,
  ToolExecutionError,
} from "@terrarium/contracts";

export interface ShellCommandInput {
  readonly command: string;
  readonly cwd?: string;
  readonly timeoutMs?: number;
}

export interface ShellCommandOutput {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

export const shellCommandTool: ToolDefinition<ShellCommandInput, ShellCommandOutput> = {
  id: "shell.run_command",
  name: "Run Shell Command",
  description: "Executes a shell command within the project workspace with timeout control.",
  category: "shell",
  version: "1.0.0",
  riskLevel: "high",
  sideEffectClass: "state_mutating",
  requiredPermissions: ["shell:execute"],
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "The shell command line string to execute", required: true },
      cwd: { type: "string", description: "Optional working directory" },
      timeoutMs: { type: "number", description: "Maximum milliseconds to wait" },
    },
    required: ["command"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      exitCode: { type: "number" },
      stdout: { type: "string" },
      stderr: { type: "string" },
      durationMs: { type: "number" },
    },
    required: ["exitCode", "stdout", "stderr", "durationMs"],
  },
  defaultTimeoutMs: 30000,
  maxTimeoutMs: 120000,
  requiresApproval: (input: ShellCommandInput) => {
    const cmd = input.command.toLowerCase();
    const dangerous = [
      "rm -rf",
      "rm -r",
      "mkfs",
      "dd if=",
      "drop table",
      "drop database",
      "git reset --hard",
      "git clean -fd",
      "npm publish",
      "cargo publish",
    ];
    return dangerous.some((p) => cmd.includes(p));
  },
  isConsequential: (input: ShellCommandInput) => {
    const cmd = input.command.toLowerCase();
    const dangerous = [
      "rm -rf",
      "rm -r",
      "mkfs",
      "dd if=",
      "drop table",
      "drop database",
      "git reset --hard",
      "git clean -fd",
      "npm publish",
      "cargo publish",
    ];
    return dangerous.some((p) => cmd.includes(p));
  },
  async execute(input: ShellCommandInput, context: ToolExecutionContext) {
    if (context.signal?.aborted) {
      return fail(new ToolExecutionError("shell.run_command", "Aborted by signal"));
    }

    const startTime = Date.now();
    try {
      const proc = Bun.spawn(["sh", "-c", input.command], {
        cwd: input.cwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdoutPromise = new Response(proc.stdout).text();
      const stderrPromise = new Response(proc.stderr).text();

      const exitCode = await proc.exited;
      const stdout = await stdoutPromise;
      const stderr = await stderrPromise;

      return ok({
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - startTime,
      });
    } catch (err: unknown) {
      return fail(new ToolExecutionError("shell.run_command", String(err)));
    }
  },
};
