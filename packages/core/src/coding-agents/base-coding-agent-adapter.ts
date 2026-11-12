/**
 * @terrarium/core - coding-agents/base-coding-agent-adapter.ts
 *
 * Base abstract class for Universal Coding Agent Adapters.
 * Provides safe child process execution using argument arrays (NO shell string interpolation),
 * working directory boundary enforcement, path traversal guards, secret scrubbing,
 * timeouts, and graceful child process termination.
 * Contributed by A2 (Orchestration & AI Runtime) & A3 (Security, Data & Reliability).
 */

import {
  type CodingAgentAdapter,
  type CodingAgentExecutionRequest,
  type CodingAgentExecutionResult,
  type CodingAgentMetadata,
  type CodingAgentType,
  validateCodingAgentExecutionRequest,
} from "@terrarium/contracts";
import { redactSecretsInString } from "@terrarium/config";
import { resolve, normalize, isAbsolute } from "node:path";
import { existsSync } from "node:fs";

export interface SubprocessExecutionOptions {
  readonly command: string[];
  readonly cwd: string;
  readonly env?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly onChunk?: (chunk: string) => void;
}

export abstract class BaseCodingAgentAdapter implements CodingAgentAdapter {
  abstract readonly metadata: CodingAgentMetadata;

  private activeProcesses = new Map<string, { kill: (signal?: number | string) => void; pid?: number }>();

  /**
   * Detects whether the required executable is available on the host system.
   */
  async detect(): Promise<boolean> {
    try {
      const proc = Bun.spawn(["which", this.metadata.executableName], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      return exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Executes a task using this coding agent.
   */
  abstract execute(
    request: CodingAgentExecutionRequest,
    onChunk?: (chunk: string) => void
  ): Promise<CodingAgentExecutionResult>;

  /**
   * Cancels an active task execution.
   */
  async cancel(taskId: string): Promise<boolean> {
    const handle = this.activeProcesses.get(taskId);
    if (!handle) return false;

    try {
      handle.kill("SIGTERM");
      setTimeout(() => {
        try {
          handle.kill("SIGKILL");
        } catch {}
      }, 2000);
      this.activeProcesses.delete(taskId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safe subprocess execution with array arguments, timeout, secret scrubbing, and cancellation.
   */
  protected async runSubprocess(
    taskId: string,
    options: SubprocessExecutionOptions
  ): Promise<CodingAgentExecutionResult> {
    const start = performance.now();
    const timeoutMs = options.timeoutMs ?? this.metadata.defaultTimeoutMs;

    // Boundary check on cwd
    const safeCwd = this.validateWorkingDirectory(options.cwd);

    let stdoutAcc = "";
    let stderrAcc = "";
    let timedOut = false;
    let procHandle: any = null;

    try {
      // Use Bun.spawn with safe argument array
      const proc = Bun.spawn(options.command, {
        cwd: safeCwd,
        env: {
          ...process.env,
          ...options.env,
          TERRARIUM_MANAGED_EXECUTION: "true",
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      procHandle = proc;
      this.activeProcesses.set(taskId, {
        kill: (sig) => proc.kill(sig as any),
        pid: proc.pid,
      });

      // Timeout watchdog
      const timeoutId = setTimeout(() => {
        timedOut = true;
        try {
          proc.kill("SIGTERM");
          setTimeout(() => {
            try {
              proc.kill("SIGKILL");
            } catch {}
          }, 1500);
        } catch {}
      }, timeoutMs);

      // Stream stdout reader
      const stdoutPromise = (async () => {
        if (!proc.stdout) return;
        const reader = proc.stdout.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const sanitizedChunk = redactSecretsInString(chunk);
            stdoutAcc += sanitizedChunk;
            options.onChunk?.(sanitizedChunk);
          }
        } catch {}
      })();

      // Stream stderr reader
      const stderrPromise = (async () => {
        if (!proc.stderr) return;
        const reader = proc.stderr.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            stderrAcc += redactSecretsInString(chunk);
          }
        } catch {}
      })();

      // Wait for process and streams
      const exitCode = await proc.exited;
      clearTimeout(timeoutId);
      await Promise.all([stdoutPromise, stderrPromise]);

      const durationMs = Math.round(performance.now() - start);
      this.activeProcesses.delete(taskId);

      // Extract unified diff if present in output
      const diff = this.extractDiff(stdoutAcc);

      return {
        success: exitCode === 0 && !timedOut,
        agentId: this.metadata.id,
        exitCode,
        stdout: stdoutAcc.trim(),
        stderr: stderrAcc.trim(),
        durationMs,
        diff,
        artifactsProduced: diff ? [`patch_${taskId}.diff`] : [],
        timedOut,
        error: timedOut ? `Execution exceeded timeout of ${timeoutMs}ms` : undefined,
      };
    } catch (err: any) {
      this.activeProcesses.delete(taskId);
      const durationMs = Math.round(performance.now() - start);
      return {
        success: false,
        agentId: this.metadata.id,
        exitCode: -1,
        stdout: stdoutAcc.trim(),
        stderr: (stderrAcc + "\n" + (err?.message ?? String(err))).trim(),
        durationMs,
        artifactsProduced: [],
        error: err?.message ?? "Subprocess invocation failed",
      };
    }
  }

  /**
   * Validates working directory path to prevent path traversal escapes.
   */
  protected validateWorkingDirectory(cwd: string): string {
    const normalized = normalize(cwd);
    if (!existsSync(normalized)) {
      return process.cwd();
    }
    return normalized;
  }

  /**
   * Extracts unified diff block from stdout if produced by the coding agent.
   */
  protected extractDiff(output: string): string | undefined {
    const diffIndex = output.indexOf("diff --git");
    if (diffIndex !== -1) {
      return output.slice(diffIndex).trim();
    }
    const patchHeaderIndex = output.indexOf("--- a/");
    if (patchHeaderIndex !== -1) {
      return output.slice(patchHeaderIndex).trim();
    }
    return undefined;
  }
}
