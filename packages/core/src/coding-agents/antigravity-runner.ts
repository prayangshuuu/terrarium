/**
 * @terrarium/core - coding-agents/antigravity-runner.ts
 *
 * Antigravity CLI Launcher & Lifecycle Manager (Prompt 25).
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 *
 * Provides:
 * 1. Cross-platform executable discovery for 'agy' and 'antigravity'.
 * 2. Version detection and capability probing (verified on host v1.5.7).
 * 3. Safe array-based process invocation (zero shell interpolation).
 * 4. Stdio passthrough for interactive or print sessions.
 * 5. Signal handling (SIGINT/SIGTERM), process termination, and orphan prevention.
 * 6. Environment sanitization via allowlist.
 */

import path from "node:path";
import os from "node:os";
import { existsSync, accessSync, constants } from "node:fs";
import { sanitizeEnvironment } from "./isolation-verifier.ts";

export interface AntigravityDiscoveryResult {
  readonly found: boolean;
  readonly executablePath?: string;
  readonly version?: string;
  readonly error?: string;
  readonly searchLocations: readonly string[];
}

export interface AntigravityLaunchOptions {
  readonly passthroughArgs: readonly string[];
  readonly workspaceRoot?: string;
  readonly customExecutablePath?: string;
  readonly dryRun?: boolean;
}

export interface AntigravityLaunchResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly command: readonly string[];
  readonly cwd: string;
  readonly error?: string;
}

export class AntigravityRunner {
  private activeProcess: any = null;

  /**
   * Discovers the Antigravity CLI executable.
   */
  async discoverExecutable(customPath?: string): Promise<AntigravityDiscoveryResult> {
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
        error: `Custom Antigravity executable path '${customPath}' does not exist or is not executable.`,
        searchLocations,
      };
    }

    // 2. Environment variable overrides
    const envOverrides = [
      process.env.AGY_EXECUTABLE_PATH,
      process.env.ANTIGRAVITY_ENTRYPOINT,
      process.env.AGY_PATH,
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

    // 3. PATH search via which / where for 'agy' then 'antigravity'
    for (const binName of ["agy", "antigravity"]) {
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
      path.join(home, ".local", "bin", "agy"),
      path.join(home, ".local", "bin", "antigravity"),
      path.join(home, ".npm-global", "bin", "agy"),
      "/usr/local/bin/agy",
      "/usr/local/bin/antigravity",
      "/opt/homebrew/bin/agy",
      "/opt/homebrew/bin/antigravity",
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
      error: "Antigravity CLI ('agy') executable not found. Ensure it is installed in PATH or ~/.local/bin.",
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
   * Launches Antigravity CLI as a subprocess.
   */
  async launch(options: AntigravityLaunchOptions): Promise<AntigravityLaunchResult> {
    const discovery = await this.discoverExecutable(options.customExecutablePath);
    if (!discovery.found || !discovery.executablePath) {
      return {
        success: false,
        exitCode: 1,
        command: [],
        cwd: options.workspaceRoot ?? process.cwd(),
        error: discovery.error ?? "Antigravity CLI ('agy') executable was not found.",
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
        error: err.message ?? "Failed to spawn Antigravity process",
      };
    }
  }
}
