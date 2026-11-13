/**
 * @terrarium/core - prompt/doctor-service.ts
 *
 * System Diagnostics & Environment Health Service for 'terrarium doctor'.
 * Contributed by A1 (Platform & Architecture) & A3 (Data, Security & Reliability).
 * Aligns with PROMPT 26 Phase F.6. Strictly zero-emoji.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  type DoctorReport,
  type DoctorProviderCheck,
  type DoctorPathCheck,
} from "@terrarium/contracts";
import { ClaudeCodeRunner } from "../coding-agents/claude-code-runner.ts";
import { AntigravityRunner } from "../coding-agents/antigravity-runner.ts";
import { CursorAgentRunner } from "../coding-agents/cursor-agent-runner.ts";
import { OllamaRunner } from "../coding-agents/ollama-runner.ts";
import { detectProjectRoot } from "./project-detector.ts";

export interface DoctorServiceOptions {
  readonly version?: string;
  readonly projectRoot?: string;
  readonly configDir?: string;
  readonly dataDir?: string;
}

export class DoctorService {
  private readonly version: string;
  private readonly startDir: string;
  private readonly configDir: string;
  private readonly dataDir: string;

  constructor(options: DoctorServiceOptions = {}) {
    this.version = options.version ?? "0.1.0";
    this.startDir = options.projectRoot ?? process.cwd();
    this.configDir = options.configDir ?? path.join(os.homedir(), ".terrarium");
    this.dataDir = options.dataDir ?? path.join(os.homedir(), ".terrarium", "data");
  }

  /**
   * Static helper to generate report directly with optional project root override.
   */
  static async generateReport(projectRoot?: string): Promise<DoctorReport> {
    const service = new DoctorService({ projectRoot });
    return service.generateReport();
  }

  /**
   * Generates a complete system diagnostics report.
   */
  async generateReport(): Promise<DoctorReport> {
    const project = detectProjectRoot(this.startDir);
    const claudeRunner = new ClaudeCodeRunner();
    const agyRunner = new AntigravityRunner();
    const cursorRunner = new CursorAgentRunner();
    const ollamaRunner = new OllamaRunner();

    // 1. Check Providers
    const providerChecks: DoctorProviderCheck[] = [];

    // Claude Code
    const claudeDisc = await claudeRunner.discoverExecutable();
    providerChecks.push({
      id: "claude_code",
      name: "Claude Code CLI",
      binary: "claude",
      installed: claudeDisc.found,
      executablePath: claudeDisc.executablePath,
      version: claudeDisc.version,
      status: claudeDisc.found ? "verified" : "unavailable",
      error: claudeDisc.error,
      installationHint: "npm install -g @anthropic-ai/claude-code",
    });

    // Antigravity
    const agyDisc = await agyRunner.discoverExecutable();
    providerChecks.push({
      id: "antigravity",
      name: "Antigravity CLI",
      binary: "agy",
      installed: agyDisc.found,
      executablePath: agyDisc.executablePath,
      version: agyDisc.version,
      status: agyDisc.found ? "verified" : "unavailable",
      error: agyDisc.error,
      installationHint: "Install from https://github.com/google/antigravity or place 'agy' in ~/.local/bin",
    });

    // Cursor Agent
    const cursorDisc = await cursorRunner.discoverExecutable();
    providerChecks.push({
      id: "cursor",
      name: "Cursor Agent CLI",
      binary: "agent",
      installed: cursorDisc.found,
      executablePath: cursorDisc.executablePath,
      version: cursorDisc.version,
      status: cursorDisc.found ? "verified" : "unavailable",
      error: cursorDisc.error,
      installationHint: "Install Cursor desktop app or standalone 'agent' CLI",
    });

    // Ollama
    const ollamaDisc = await ollamaRunner.discoverExecutable();
    let ollamaStatus: DoctorProviderCheck["status"] = "unavailable";
    if (ollamaDisc.found && ollamaDisc.executablePath) {
      const daemon = await ollamaRunner.checkDaemon(ollamaDisc.executablePath);
      ollamaStatus = daemon.isRunning ? "verified" : "offline";
    }
    providerChecks.push({
      id: "ollama",
      name: "Ollama Local Runtime",
      binary: "ollama",
      installed: ollamaDisc.found,
      executablePath: ollamaDisc.executablePath,
      version: ollamaDisc.version,
      status: ollamaStatus,
      error: ollamaDisc.error,
      installationHint: "Download from https://ollama.com",
    });

    // 2. PATH check
    const pathEnv = process.env.PATH ?? "";
    const home = os.homedir();
    const localBin = path.join(home, ".local", "bin");
    const inPath = pathEnv.split(path.delimiter).includes(localBin);
    const userShell = process.env.SHELL ? path.basename(process.env.SHELL) : "zsh";

    const pathIssues: string[] = [];
    let recommendedExport: string | undefined;
    if (!inPath) {
      pathIssues.push(`Directory '${localBin}' is not in system PATH.`);
      recommendedExport = `export PATH="${localBin}:$PATH"`;
    }

    const pathCheck: DoctorPathCheck = {
      executableName: "terrarium",
      resolvedPath: process.argv[1] ?? "unknown",
      inPath,
      userShell,
      recommendedPathExport: recommendedExport,
      issues: pathIssues,
    };

    // 3. Database & storage health
    let dbStatus: "ok" | "degraded" | "error" = "ok";
    let dbError: string | undefined;
    const dbPath = path.join(this.storageDir(), "terrarium.sqlite");
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
    } catch (e: any) {
      dbStatus = "error";
      dbError = `Cannot access config directory: ${e.message}`;
    }

    const allChecksPassed =
      dbStatus === "ok" &&
      providerChecks.some((p) => p.installed);

    return {
      terrariumVersion: this.version,
      bunVersion: typeof Bun !== "undefined" ? Bun.version : "unknown",
      platform: os.platform(),
      architecture: os.arch(),
      executablePath: process.argv[1] ?? "terrarium",
      projectRoot: project.projectRoot,
      isGitRepo: project.isGitRepo,
      configDir: this.configDir,
      dataDir: this.dataDir,
      databaseHealth: {
        status: dbStatus,
        path: dbPath,
        error: dbError,
      },
      providers: providerChecks,
      pathCheck,
      allChecksPassed,
      timestamp: new Date().toISOString(),
    };
  }

  private storageDir(): string {
    return this.configDir;
  }
}
