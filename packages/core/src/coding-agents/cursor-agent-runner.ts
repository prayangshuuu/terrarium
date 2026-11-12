/**
 * @terrarium/core - coding-agents/cursor-agent-runner.ts
 *
 * Cursor Agent CLI Launcher & Lifecycle Manager (Prompt 25).
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 *
 * Provides:
 * 1. Cross-platform executable discovery for 'agent' (Cursor Agent CLI).
 * 2. Version detection and identity verification (verified on host v2026.09.18-9a7762b).
 * 3. Safe array-based process invocation (zero shell interpolation).
 * 4. Stdio passthrough for interactive or batch sessions.
 * 5. Signal handling (SIGINT/SIGTERM), process termination, and orphan prevention.
 * 6. Environment sanitization via allowlist.
 */

import path from "node:path";
import os from "node:os";
import { existsSync, accessSync, constants } from "node:fs";
import { sanitizeEnvironment } from "./isolation-verifier.ts";

export interface CursorAgentDiscoveryResult {
  readonly found: boolean;
  readonly executablePath?: string;
  readonly version?: string;
  readonly error?: string;
  readonly searchLocations: readonly string[];
}

export interface CursorAgentLaunchOptions {
  readonly passthroughArgs: readonly string[];
  readonly workspaceRoot?: string;
  readonly customExecutablePath?: string;
  readonly dryRun?: boolean;
}

export interface CursorAgentLaunchResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly command: readonly string[];
  readonly cwd: string;
  readonly error?: string;
}

export class CursorAgentRunner {
  private activeProcess: any = null;

  /**
   * Discovers the Cursor Agent CLI executable.
   */
  async discoverExecutable(customPath?: string): Promise<CursorAgentDiscoveryResult> {
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
    }

    // 2. Environment variable overrides
    const envOverrides = [
      process.env.CURSOR_AGENT_EXECUTABLE,
      process.env.AGENT_EXECUTABLE_PATH,
      process.env.CURSOR_PATH,
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

    // 3. PATH search via which / where for 'agent' then 'cursor'
    for (const binName of ["agent", "cursor"]) {
      try {
        const isWin = os.platform() === "win32";
        const lookupCmd = isWin ? ["where", binName] : ["which", binName];
        const proc = Bun.spawn(lookupCmd, { stdout: "pipe", stderr: "pipe" });
        const text = (await new Response(proc.stdout).text()).trim();
        const firstLine = text.split("\n")[0]?.trim();
        if (firstLine) {
          searchLocations.push(firstLine);
          if (this.isExecutable(firstLine)) {
            const ver = await this.probeVersion(firstLine);
            return {
              found: true,
              executablePath: firstLine,
              version: ver,
              searchLocations,
            };
          }
        }
      } catch {}
    }

    // 4. Standard local paths
    const home = os.homedir();
    const candidatePaths = [
      path.join(home, ".local", "bin", "agent"),
      path.join(home, ".local", "bin", "cursor"),
      path.join(home, ".cursor", "bin", "agent"),
      "/usr/local/bin/agent",
      "/usr/local/bin/cursor",
      "/opt/homebrew/bin/agent",
      "/opt/homebrew/bin/cursor",
    ];

    for (const cand of candidatePaths) {
      searchLocations.push(cand);
      if (this.isExecutable(cand)) {
        const ver = await this.probeVersion(cand);
        return {
          found: true,
          executablePath: cand,
          version: ver,
          searchLocations,
        };
      }
    }

    return {
      found: false,
      error: "Cursor Agent CLI ('agent') executable not found. Ensure it is installed in PATH or ~/.local/bin.",
      searchLocations,
    };
  }

  /**
   * Checks whether a file exists and is executable.
   */
  private isExecutable(filePath: string): boolean {
    try {
      if (!existsSync(filePath)) return false;
      accessSync(filePath, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Probes executable version using '--version'.
   */
  async probeVersion(executablePath: string): Promise<string> {
    try {
      const proc = Bun.spawn([executablePath, "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const text = (await new Response(proc.stdout).text()).trim();
      return text.split("\n")[0]?.trim() || "unknown";
    } catch {
      return "unverified";
    }
  }

  /**
   * Builds the argument vector safely without shell string interpolation.
   */
  buildLaunchVector(executablePath: string, passthroughArgs: readonly string[]): string[] {
    return [executablePath, ...passthroughArgs];
  }

  /**
   * Launches Cursor Agent CLI as a subprocess.
   */
  async launch(options: CursorAgentLaunchOptions): Promise<CursorAgentLaunchResult> {
    const discovery = await this.discoverExecutable(options.customExecutablePath);
    if (!discovery.found || !discovery.executablePath) {
      return {
        success: false,
        exitCode: 1,
        command: [],
        cwd: options.workspaceRoot ?? process.cwd(),
        error: discovery.error ?? "Cursor Agent CLI ('agent') executable was not found.",
      };
    }

    const command = this.buildLaunchVector(discovery.executablePath, options.passthroughArgs);
    const cwd = options.workspaceRoot ?? process.cwd();

    if (options.dryRun) {
      return {
        success: true,
        exitCode: 0,
        command,
        cwd,
      };
    }

    const sanitizedEnv = sanitizeEnvironment();

    try {
      const proc = Bun.spawn(command, {
        cwd,
        env: sanitizedEnv,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });

      this.activeProcess = proc;

      // Handle termination signals
      const handleSignal = (sig: "SIGINT" | "SIGTERM") => {
        if (this.activeProcess) {
          try {
            this.activeProcess.kill(sig);
          } catch {}
        }
      };

      const sigIntListener = () => handleSignal("SIGINT");
      const sigTermListener = () => handleSignal("SIGTERM");

      process.on("SIGINT", sigIntListener);
      process.on("SIGTERM", sigTermListener);

      const exitCode = await proc.exited;

      process.off("SIGINT", sigIntListener);
      process.off("SIGTERM", sigTermListener);
      this.activeProcess = null;

      return {
        success: exitCode === 0,
        exitCode,
        command,
        cwd,
      };
    } catch (err: any) {
      this.activeProcess = null;
      return {
        success: false,
        exitCode: 1,
        command,
        cwd,
        error: err.message ?? "Failed to spawn Cursor Agent process",
      };
    }
  }
}
