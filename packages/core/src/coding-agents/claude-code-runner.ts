/**
 * @terrarium/core - coding-agents/claude-code-runner.ts
 *
 * First-Class Claude Code Launcher & Lifecycle Manager.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 *
 * Provides:
 * 1. Cross-platform executable discovery and version detection.
 * 2. Strict enforcement of execution policies: 'standard' (default) vs 'isolated_bypass'.
 * 3. Mandatory isolation verification before '--dangerously-skip-permissions' can be used.
 * 4. Safe array-based process invocation (zero shell interpolation).
 * 5. Full terminal stdio passthrough for interactive Claude Code sessions.
 * 6. Signal handling (SIGINT/SIGTERM), process termination, and orphan prevention.
 * 7. Session lifecycle tracking and failure diagnostics.
 */

import {
  type ClaudeCodeExecutionPolicy,
  type ClaudeCodeLaunchOptions,
  type CodingAgentSessionMetadata,
  type CodingAgentSessionState,
  type IsolationVerificationReport,
  type Result,
  ok,
  fail,
  TerrariumError,
} from "@terrarium/contracts";
import { verifyIsolation, sanitizeEnvironment } from "./isolation-verifier.ts";
import path from "node:path";
import os from "node:os";
import { existsSync, accessSync, constants } from "node:fs";

export interface ClaudeDiscoveryResult {
  readonly found: boolean;
  readonly executablePath?: string;
  readonly version?: string;
  readonly error?: string;
  readonly searchLocations: readonly string[];
}

export interface ClaudeCodeLaunchResult {
  readonly success: boolean;
  readonly session: CodingAgentSessionMetadata;
  readonly exitCode: number;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly error?: string;
}

export class ClaudeCodeRunner {
  private activeProcess: any = null;
  private currentSession: CodingAgentSessionMetadata | null = null;

  /**
   * Discovers the Claude Code executable across standard paths and environment overrides.
   */
  async discoverExecutable(customPath?: string): Promise<ClaudeDiscoveryResult> {
    const searchLocations: string[] = [];

    // 1. Explicit override via argument
    if (customPath) {
      searchLocations.push(customPath);
      if (this.isExecutable(customPath)) {
        const ver = await this.probeVersion(customPath);
        return {
          found: true,
          executablePath: customPath,
          version: ver,
          searchLocations,
        };
      }
      return {
        found: false,
        error: `Custom Claude Code executable path '${customPath}' does not exist or is not executable.`,
        searchLocations,
      };
    }

    // 2. Environment variable overrides
    const envOverrides = [
      process.env.CLAUDE_CODE_ENTRYPOINT,
      process.env.CLAUDE_EXECUTABLE_PATH,
    ].filter(Boolean) as string[];

    for (const envPath of envOverrides) {
      searchLocations.push(envPath);
      if (this.isExecutable(envPath)) {
        const ver = await this.probeVersion(envPath);
        return {
          found: true,
          executablePath: envPath,
          version: ver,
          searchLocations,
        };
      }
    }

    // 3. PATH search via which / where
    try {
      const isWin = os.platform() === "win32";
      const lookupCmd = isWin ? ["where", "claude"] : ["which", "claude"];
      const proc = Bun.spawn(lookupCmd, {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      if (exitCode === 0) {
        const out = (await new Response(proc.stdout).text()).trim().split("\n")[0]?.trim();
        if (out && this.isExecutable(out)) {
          searchLocations.push(out);
          const ver = await this.probeVersion(out);
          return {
            found: true,
            executablePath: out,
            version: ver,
            searchLocations,
          };
        }
      }
    } catch {}

    // 4. Standard platform directories
    const home = os.homedir();
    const candidatePaths: string[] = [
      path.join(home, ".local", "bin", "claude"),
      path.join(home, ".npm-global", "bin", "claude"),
      path.join(home, ".bun", "bin", "claude"),
      "/opt/homebrew/bin/claude",
      "/usr/local/bin/claude",
      "/usr/bin/claude",
    ];

    for (const candidate of candidatePaths) {
      searchLocations.push(candidate);
      if (this.isExecutable(candidate)) {
        const ver = await this.probeVersion(candidate);
        return {
          found: true,
          executablePath: candidate,
          version: ver,
          searchLocations,
        };
      }
    }

    return {
      found: false,
      error: "Claude Code CLI ('claude') not found in PATH or standard installation locations.",
      searchLocations,
    };
  }

  /**
   * Launches Claude Code with strict execution policy and isolation enforcement.
   */
  async launch(options: ClaudeCodeLaunchOptions): Promise<ClaudeCodeLaunchResult> {
    const startedAt = new Date().toISOString();
    const sessionId = `claude-sess-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

    // 1. Discover executable
    const discovery = await this.discoverExecutable(options.customExecutablePath);
    if (!discovery.found || !discovery.executablePath) {
      const failedSession: CodingAgentSessionMetadata = {
        sessionId,
        tool: "claude_code",
        executablePath: options.customExecutablePath ?? "claude",
        detectedVersion: "unknown",
        executionPolicy: options.executionPolicy,
        isolationStatus: "failed",
        workspaceRoot: options.workspaceRoot,
        argv: [],
        state: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: 1,
        terminationReason: discovery.error ?? "Executable not found",
        durationMs: 0,
      };

      return {
        success: false,
        session: failedSession,
        exitCode: 1,
        error: discovery.error ?? "Claude Code executable not found on host system.",
      };
    }

    const executablePath = discovery.executablePath;
    const detectedVersion = discovery.version ?? "unknown";

    // 2. Validate dangerous-permissions mode
    let isolationReport: IsolationVerificationReport | undefined;

    if (options.executionPolicy === "isolated_bypass") {
      // Require explicit opt-in
      if (!options.explicitOptIn) {
        const failedSession: CodingAgentSessionMetadata = {
          sessionId,
          tool: "claude_code",
          executablePath,
          detectedVersion,
          executionPolicy: "isolated_bypass",
          isolationStatus: "failed",
          workspaceRoot: options.workspaceRoot,
          argv: [],
          state: "failed",
          startedAt,
          finishedAt: new Date().toISOString(),
          exitCode: 1,
          terminationReason: "Dangerous-permissions mode requires explicit user opt-in.",
          durationMs: 0,
        };

        return {
          success: false,
          session: failedSession,
          exitCode: 1,
          error: "Explicit opt-in required: dangerous-permissions mode cannot be enabled implicitly or by default.",
        };
      }

      // Require explicit confirmation
      if (!options.confirmed) {
        const failedSession: CodingAgentSessionMetadata = {
          sessionId,
          tool: "claude_code",
          executablePath,
          detectedVersion,
          executionPolicy: "isolated_bypass",
          isolationStatus: "failed",
          workspaceRoot: options.workspaceRoot,
          argv: [],
          state: "cancelled",
          startedAt,
          finishedAt: new Date().toISOString(),
          exitCode: 1,
          terminationReason: "Operator cancelled dangerous-permissions launch.",
          durationMs: 0,
        };

        return {
          success: false,
          session: failedSession,
          exitCode: 1,
          error: "Operator confirmation required before launching in dangerous-permissions mode.",
        };
      }

      // Mandatory isolation verification
      isolationReport = await verifyIsolation(options.workspaceRoot);

      if (!isolationReport.isIsolated) {
        // FAIL CLOSED
        const failedSession: CodingAgentSessionMetadata = {
          sessionId,
          tool: "claude_code",
          executablePath,
          detectedVersion,
          executionPolicy: "isolated_bypass",
          isolationStatus: isolationReport.status,
          isolationReport,
          workspaceRoot: options.workspaceRoot,
          argv: [],
          state: "failed",
          startedAt,
          finishedAt: new Date().toISOString(),
          exitCode: 1,
          terminationReason: `Isolation verification failed: ${isolationReport.failureReason}`,
          durationMs: 0,
        };

        return {
          success: false,
          session: failedSession,
          exitCode: 1,
          error: `Isolation gate rejected launch: ${isolationReport.failureReason}. Terrarium fails closed and refuses unrestricted execution.`,
        };
      }
    } else {
      // Standard mode
      isolationReport = {
        isIsolated: false,
        status: "not_requested",
        workspaceRoot: path.resolve(options.workspaceRoot),
        isWorktree: false,
        isHomeDirOrRoot: false,
        shieldedPaths: [],
        exposedSensitivePaths: [],
        networkPolicy: "unrestricted",
        containerOrOsSandboxActive: false,
        honestLimitations: ["Standard execution mode preserves Claude Code's normal interactive permission checks."],
      };
    }

    // 3. Construct argument vector safely (no shell string concatenation)
    const argv: string[] = [executablePath];

    if (options.executionPolicy === "isolated_bypass") {
      argv.push("--dangerously-skip-permissions");
    }

    // Append user passthrough arguments
    for (const arg of options.passthroughArgs) {
      // Do not duplicate --dangerously-skip-permissions if already handled
      if (arg === "--dangerously-skip-permissions") continue;
      argv.push(arg);
    }

    // 4. Dry run check
    if (options.dryRun) {
      const drySession: CodingAgentSessionMetadata = {
        sessionId,
        tool: "claude_code",
        executablePath,
        detectedVersion,
        executionPolicy: options.executionPolicy,
        isolationStatus: isolationReport.status,
        isolationReport,
        workspaceRoot: options.workspaceRoot,
        argv,
        state: "completed",
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: 0,
        durationMs: 0,
      };

      return {
        success: true,
        session: drySession,
        exitCode: 0,
      };
    }

    // 5. Spawn subprocess with sanitized environment and stdio
    const safeEnv = sanitizeEnvironment(process.env, options.envOverrides);
    const safeCwd = path.resolve(options.workspaceRoot);

    const sessionMeta: CodingAgentSessionMetadata = {
      sessionId,
      tool: "claude_code",
      executablePath,
      detectedVersion,
      executionPolicy: options.executionPolicy,
      isolationStatus: isolationReport.status,
      isolationReport,
      workspaceRoot: safeCwd,
      argv,
      state: "running",
      startedAt,
    };
    this.currentSession = sessionMeta;

    const startTime = performance.now();
    let exitCode = 0;
    let proc: any = null;
    let stdoutText = "";
    let stderrText = "";

    try {
      const isInteractive = options.interactive ?? true;

      proc = Bun.spawn(argv, {
        cwd: safeCwd,
        env: safeEnv,
        stdin: isInteractive ? "inherit" : "pipe",
        stdout: isInteractive ? "inherit" : "pipe",
        stderr: isInteractive ? "inherit" : "pipe",
      });
      this.activeProcess = proc;

      // Setup signal forwarding so Ctrl+C / SIGTERM gracefully stops Claude Code
      const sigHandler = (sig: string) => {
        try {
          if (this.activeProcess) {
            this.activeProcess.kill(sig);
          }
        } catch {}
      };

      const onSigint = () => sigHandler("SIGINT");
      const onSigterm = () => sigHandler("SIGTERM");

      process.on("SIGINT", onSigint);
      process.on("SIGTERM", onSigterm);

      try {
        exitCode = await proc.exited;
        if (!isInteractive && proc.stdout) {
          stdoutText = await new Response(proc.stdout).text();
        }
        if (!isInteractive && proc.stderr) {
          stderrText = await new Response(proc.stderr).text();
        }
      } finally {
        process.off("SIGINT", onSigint);
        process.off("SIGTERM", onSigterm);
        this.activeProcess = null;
      }
    } catch (spawnErr: any) {
      exitCode = 1;
      const durationMs = Math.round(performance.now() - startTime);
      const finishedSession: CodingAgentSessionMetadata = {
        ...sessionMeta,
        state: "failed",
        finishedAt: new Date().toISOString(),
        exitCode: 1,
        terminationReason: `Spawn failure: ${spawnErr?.message ?? "unknown"}`,
        durationMs,
      };
      this.currentSession = finishedSession;

      return {
        success: false,
        session: finishedSession,
        exitCode: 1,
        error: `Failed to spawn Claude Code process: ${spawnErr?.message ?? "unknown"}`,
      };
    }

    const durationMs = Math.round(performance.now() - startTime);
    const finalState: CodingAgentSessionState = exitCode === 0 ? "completed" : "failed";

    const completedSession: CodingAgentSessionMetadata = {
      ...sessionMeta,
      state: finalState,
      finishedAt: new Date().toISOString(),
      exitCode,
      durationMs,
      terminationReason: exitCode !== 0 ? `Process exited with status code ${exitCode}` : undefined,
    };
    this.currentSession = completedSession;

    return {
      success: exitCode === 0,
      session: completedSession,
      exitCode,
      stdout: stdoutText || undefined,
      stderr: stderrText || undefined,
    };
  }

  /**
   * Cancels any active Claude Code subprocess immediately.
   */
  async cancel(): Promise<boolean> {
    if (!this.activeProcess) return false;

    try {
      this.activeProcess.kill("SIGTERM");
      setTimeout(() => {
        try {
          if (this.activeProcess) {
            this.activeProcess.kill("SIGKILL");
          }
        } catch {}
      }, 1500);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the current or most recent session metadata.
   */
  getCurrentSession(): CodingAgentSessionMetadata | null {
    return this.currentSession;
  }

  private isExecutable(filePath: string): boolean {
    try {
      if (!existsSync(filePath)) return false;
      accessSync(filePath, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async probeVersion(executablePath: string): Promise<string> {
    try {
      const proc = Bun.spawn([executablePath, "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      if (exitCode === 0) {
        const text = (await new Response(proc.stdout).text()).trim();
        return text || "unknown";
      }
      return "unknown";
    } catch {
      return "unknown";
    }
  }
}
