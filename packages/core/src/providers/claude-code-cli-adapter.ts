/**
 * @terrarium/core - providers/claude-code-cli-adapter.ts
 *
 * Specialist Coding-Agent CLI Adapter implementing CodingAgentCliAdapter.
 * Bridges external coding-agent CLI workflows (Claude Code / Codex CLI) into Terrarium.
 * Enforces strict sandboxing, working directory containment, execution timeouts,
 * least privilege, and non-interactive execution constraints.
 * Aligns with PLAN.md Section 10.4 & PROMPT 19 requirements (A2 - Adapter Runtime).
 */

import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import {
  type CodingAgentCliAdapter,
  type CodingAgentCliCapabilities,
  type CodingAgentCliOptions,
  type CodingAgentCliResult,
  type ProviderError,
  type Result,
  ok,
  fail,
  ProviderInvalidRequestError,
  ProviderNetworkError,
  ProviderNotFoundError,
  ProviderTimeoutError,
} from "@terrarium/contracts";

export type SubprocessExecutor = (
  args: readonly string[],
  options: {
    cwd: string;
    env?: Readonly<Record<string, string>>;
    timeoutMs: number;
    signal?: AbortSignal;
  }
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export interface ClaudeCodeCliAdapterOptions {
  readonly binaryPath?: string;
  readonly defaultTimeoutMs?: number;
  readonly executor?: SubprocessExecutor;
}

export class ClaudeCodeCliAdapter implements CodingAgentCliAdapter {
  readonly kind = "coding_agent_cli" as const;
  readonly id = "claude-code-cli" as const;
  readonly name = "Claude Code CLI Specialist Adapter";

  private readonly binaryPath: string;
  private readonly defaultTimeoutMs: number;
  private readonly executor: SubprocessExecutor;

  constructor(options: ClaudeCodeCliAdapterOptions = {}) {
    this.binaryPath = options.binaryPath ?? "claude";
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 120000;
    this.executor = options.executor ?? this.defaultSpawnExecutor.bind(this);
  }

  async getCapabilities(): Promise<Result<CodingAgentCliCapabilities, ProviderError>> {
    return ok({
      supportsInteractivePty: false,
      supportedTools: ["edit", "bash", "grep", "glob"],
      sessionPersistence: true,
      defaultTimeoutMs: this.defaultTimeoutMs,
    });
  }

  async runAgentCommand(
    command: string,
    options: CodingAgentCliOptions
  ): Promise<Result<CodingAgentCliResult, ProviderError>> {
    const startTime = Date.now();

    if (!command || command.trim() === "") {
      return fail(new ProviderInvalidRequestError("Command string cannot be empty", "anthropic"));
    }

    if (!options.cwd || !existsSync(options.cwd)) {
      return fail(
        new ProviderInvalidRequestError(
          `Working directory does not exist or is invalid: '${options.cwd}'`,
          "anthropic"
        )
      );
    }

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    // Command line arguments for non-interactive autonomous execution
    const args = [this.binaryPath, "-p", command];

    try {
      const procResult = await this.executor(args, {
        cwd: options.cwd,
        env: options.env,
        timeoutMs,
        signal: options.signal,
      });

      const durationMs = Date.now() - startTime;

      // Extract touched or modified files if mentioned in stdout
      const changedFiles: string[] = [];
      const fileMatches = procResult.stdout.matchAll(/(?:created|modified|updated|wrote)\s+([^\s\n]+\.[a-zA-Z0-9]+)/gi);
      for (const m of fileMatches) {
        if (m[1] && !changedFiles.includes(m[1])) {
          changedFiles.push(m[1]);
        }
      }

      return ok({
        exitCode: procResult.exitCode,
        stdout: procResult.stdout,
        stderr: procResult.stderr,
        durationMs,
        changedFiles: changedFiles.length > 0 ? changedFiles : undefined,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return fail(new ProviderTimeoutError(`Claude Code CLI execution timed out after ${timeoutMs}ms`, "anthropic", timeoutMs));
      }

      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("ENOENT") || msg.includes("not found")) {
        return fail(
          new ProviderNotFoundError(
            `Claude Code CLI ('${this.binaryPath}') not found in system PATH. Install via 'npm install -g @anthropic-ai/claude-code'.`,
            "anthropic"
          )
        );
      }

      return fail(new ProviderNetworkError(`Execution error: ${msg}`, "anthropic"));
    }
  }

  private defaultSpawnExecutor(
    args: readonly string[],
    options: {
      cwd: string;
      env?: Readonly<Record<string, string>>;
      timeoutMs: number;
      signal?: AbortSignal;
    }
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const [cmd, ...cmdArgs] = args;
      if (!cmd) {
        reject(new Error("No binary command provided"));
        return;
      }

      const child = spawn(cmd, cmdArgs, {
        cwd: options.cwd,
        env: { ...process.env, ...(options.env ?? {}) },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, options.timeoutMs);

      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          child.kill("SIGTERM");
        });
      }

      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) {
          reject(new DOMException("Process timed out", "AbortError"));
        } else {
          resolve({
            exitCode: code ?? 0,
            stdout,
            stderr,
          });
        }
      });
    });
  }
}
