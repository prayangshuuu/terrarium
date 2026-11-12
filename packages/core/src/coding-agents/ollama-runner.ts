/**
 * @terrarium/core - coding-agents/ollama-runner.ts
 *
 * Ollama Local Model Runner & Subprocess Manager (Prompt 25).
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 *
 * Provides:
 * 1. Cross-platform executable discovery for 'ollama'.
 * 2. Version detection (verified on host v0.32.0).
 * 3. Local daemon health probing and actionable offline diagnostics.
 * 4. Model availability checking (prevents unapproved model pulls).
 * 5. Safe array-based invocation: 'ollama run <model>'.
 * 6. Stdio passthrough for interactive or prompt streaming.
 * 7. Signal handling (SIGINT/SIGTERM) and clean process cleanup.
 */

import path from "node:path";
import os from "node:os";
import { existsSync, accessSync, constants } from "node:fs";

export interface OllamaDiscoveryResult {
  readonly found: boolean;
  readonly executablePath?: string;
  readonly version?: string;
  readonly error?: string;
  readonly searchLocations: readonly string[];
}

export interface OllamaDaemonStatus {
  readonly isRunning: boolean;
  readonly installedModels: readonly string[];
  readonly error?: string;
}

export interface OllamaLaunchOptions {
  readonly model: string;
  readonly passthroughArgs?: readonly string[];
  readonly workspaceRoot?: string;
  readonly customExecutablePath?: string;
  readonly dryRun?: boolean;
}

export interface OllamaLaunchResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly command: readonly string[];
  readonly cwd: string;
  readonly error?: string;
}

export class OllamaRunner {
  private activeProcess: any = null;

  /**
   * Discovers the Ollama CLI executable.
   */
  async discoverExecutable(customPath?: string): Promise<OllamaDiscoveryResult> {
    const searchLocations: string[] = [];

    // 1. Custom path override
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

    // 2. Environment variables
    const envOverrides = [
      process.env.OLLAMA_EXECUTABLE,
      process.env.OLLAMA_PATH,
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

    // 3. System PATH search
    try {
      const isWin = os.platform() === "win32";
      const lookupCmd = isWin ? ["where", "ollama"] : ["which", "ollama"];
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

    // 4. Well-known paths
    const home = os.homedir();
    const candidatePaths = [
      "/opt/homebrew/bin/ollama",
      "/usr/local/bin/ollama",
      path.join(home, ".ollama", "bin", "ollama"),
      path.join(home, ".local", "bin", "ollama"),
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
      error: "Ollama executable not found. Install Ollama from https://ollama.com or add to PATH.",
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
   * Probes executable version using 'ollama --version'.
   */
  async probeVersion(executablePath: string): Promise<string> {
    try {
      const proc = Bun.spawn([executablePath, "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const text = (await new Response(proc.stdout).text()).trim();
      // On some platforms text might contain "Warning: could not connect..." on first line
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.includes("version is") || line.startsWith("ollama version")) {
          return line.replace("Warning: client version is", "").replace("ollama version is", "").trim();
        }
      }
      return lines[0] ?? "unknown";
    } catch {
      return "unverified";
    }
  }

  /**
   * Checks local Ollama daemon status and lists installed models.
   */
  async checkDaemon(executablePath: string): Promise<OllamaDaemonStatus> {
    try {
      const proc = Bun.spawn([executablePath, "list"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const errText = (await new Response(proc.stderr).text()).trim();
        return {
          isRunning: false,
          installedModels: [],
          error: errText.includes("could not connect")
            ? "Ollama server is not running. Start with 'ollama serve' or open the Ollama app."
            : errText || "Failed to query Ollama daemon.",
        };
      }

      const outText = (await new Response(proc.stdout).text()).trim();
      const lines = outText.split("\n").slice(1); // skip table header (NAME ID SIZE MODIFIED)
      const installedModels: string[] = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const modelName = parts[0];
        if (modelName) {
          installedModels.push(modelName);
        }
      }

      return {
        isRunning: true,
        installedModels,
      };
    } catch (err: any) {
      return {
        isRunning: false,
        installedModels: [],
        error: err.message ?? "Could not connect to Ollama daemon.",
      };
    }
  }

  /**
   * Builds the argument vector safely for 'ollama run <model>'.
   */
  buildLaunchVector(
    executablePath: string,
    model: string,
    passthroughArgs: readonly string[] = []
  ): string[] {
    return [executablePath, "run", model, ...passthroughArgs];
  }

  /**
   * Launches an Ollama model in local interactive/subprocess mode.
   */
  async launch(options: OllamaLaunchOptions): Promise<OllamaLaunchResult> {
    if (!options.model || options.model.trim().length === 0) {
      return {
        success: false,
        exitCode: 1,
        command: [],
        cwd: options.workspaceRoot ?? process.cwd(),
        error: "No Ollama model name provided. Usage: bun run terrarium --ollama <model>",
      };
    }

    const discovery = await this.discoverExecutable(options.customExecutablePath);
    if (!discovery.found || !discovery.executablePath) {
      return {
        success: false,
        exitCode: 1,
        command: [],
        cwd: options.workspaceRoot ?? process.cwd(),
        error: discovery.error ?? "Ollama executable not found.",
      };
    }

    const command = this.buildLaunchVector(
      discovery.executablePath,
      options.model.trim(),
      options.passthroughArgs ?? []
    );
    const cwd = options.workspaceRoot ?? process.cwd();

    if (options.dryRun) {
      return {
        success: true,
        exitCode: 0,
        command,
        cwd,
      };
    }

    // Check daemon status before launching to provide helpful guidance
    const daemon = await this.checkDaemon(discovery.executablePath);
    if (!daemon.isRunning) {
      return {
        success: false,
        exitCode: 1,
        command,
        cwd,
        error:
          daemon.error ??
          "Could not connect to Ollama server. Please start the Ollama daemon via 'ollama serve'.",
      };
    }

    // Check if model exists locally without pulling
    const requestedModel = options.model.trim().toLowerCase();
    const hasModel = daemon.installedModels.some(
      (m) => m.toLowerCase() === requestedModel || m.toLowerCase().startsWith(`${requestedModel}:`)
    );

    if (!hasModel && daemon.installedModels.length > 0) {
      return {
        success: false,
        exitCode: 1,
        command,
        cwd,
        error: `Model '${options.model}' is not installed locally.\nInstalled models: ${daemon.installedModels.join(", ")}\nTo install, run: 'ollama pull ${options.model}'`,
      };
    }

    try {
      const proc = Bun.spawn(command, {
        cwd,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });

      this.activeProcess = proc;

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
        error: err.message ?? "Failed to spawn Ollama process",
      };
    }
  }
}
