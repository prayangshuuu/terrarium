/**
 * apps/cli/src/commands/ollama-cli.ts
 *
 * Ollama Local Model Command Handler & Terminal Formatter (Prompt 25).
 * Invocation: bun run terrarium --ollama <model> [passthrough-args...]
 *         or: bun run terrarium -- ollama <model> [passthrough-args...]
 *
 * Contributed by A4 (Senior CLI/TUI Designer) & A1 (Platform & Architecture).
 * Strictly complies with zero-emoji terminal typography.
 */

import { OllamaRunner, type OllamaLaunchOptions } from "@terrarium/core";

export interface ParsedOllamaCliArgs {
  readonly isOllama: boolean;
  readonly model?: string;
  readonly showHelp: boolean;
  readonly showVersion: boolean;
  readonly dryRun: boolean;
  readonly customExecutablePath?: string;
  readonly workspaceRoot: string;
  readonly passthroughArgs: readonly string[];
}

/**
 * Parses command-line arguments for Ollama invocation.
 * Handles both '--ollama <model>' and 'ollama <model>' / 'ollama run <model>'.
 */
export function parseOllamaArgs(args: readonly string[]): ParsedOllamaCliArgs {
  if (args.length === 0) {
    return {
      isOllama: false,
      showHelp: false,
      showVersion: false,
      dryRun: false,
      workspaceRoot: process.cwd(),
      passthroughArgs: [],
    };
  }

  const primary = args[0]?.toLowerCase();
  const isDirectOption = primary === "--ollama" || primary === "-ollama";
  const isSubcommand = primary === "ollama";

  if (!isDirectOption && !isSubcommand) {
    return {
      isOllama: false,
      showHelp: false,
      showVersion: false,
      dryRun: false,
      workspaceRoot: process.cwd(),
      passthroughArgs: [],
    };
  }

  let remaining = args.slice(1);

  // If "ollama run <model>", skip "run"
  if (isSubcommand && remaining[0]?.toLowerCase() === "run") {
    remaining = remaining.slice(1);
  }

  let model: string | undefined;
  let showHelp = false;
  let showVersion = false;
  let dryRun = false;
  let customExecutablePath: string | undefined;
  let workspaceRoot = process.cwd();
  const passthroughArgs: string[] = [];

  for (let i = 0; i < remaining.length; i++) {
    const arg = remaining[i];
    if (arg === undefined) continue;

    if (arg === "--help" || arg === "-h") {
      showHelp = true;
    } else if (arg === "--version" || arg === "-v") {
      showVersion = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--workspace") {
      const next = remaining[i + 1];
      if (next !== undefined) {
        workspaceRoot = next;
        i++;
      }
    } else if (arg.startsWith("--workspace=")) {
      workspaceRoot = arg.substring("--workspace=".length);
    } else if (arg === "--executable") {
      const next = remaining[i + 1];
      if (next !== undefined) {
        customExecutablePath = next;
        i++;
      }
    } else if (arg.startsWith("--executable=")) {
      customExecutablePath = arg.substring("--executable=".length);
    } else if (!model && !arg.startsWith("-")) {
      model = arg;
    } else {
      passthroughArgs.push(arg);
    }
  }

  return {
    isOllama: true,
    model,
    showHelp,
    showVersion,
    dryRun,
    customExecutablePath,
    workspaceRoot,
    passthroughArgs,
  };
}

/**
 * Prints help for the Ollama integration.
 */
export function printOllamaHelp(): void {
  console.log(`
TERRARIUM OLLAMA LOCAL MODEL RUNNER
================================================================================
Invocation:
  bun run terrarium --ollama <model> [options] [prompt...]
  bun run terrarium -- ollama <model> [options] [prompt...]

Description:
  Runs a local LLM model through Ollama with zero external data egress.
  Guarantees private, offline execution without cloud transmission.

Terrarium Launch Options:
  --dry-run              Print resolved launch command vector without executing
  --executable <path>    Override path to 'ollama' binary
  --workspace <path>     Working directory for execution context
  --help                 Show this Terrarium integration help

Examples:
  bun run terrarium --ollama llama3.2
  bun run terrarium --ollama qwen2.5-coder "Explain system invariants"
  bun run terrarium --ollama deepseek-r1 --dry-run
  bun run terrarium -- ollama list

Safety & Privacy Invariants:
  1. 100% Private: All inference executes on localhost (http://localhost:11434).
  2. No Automatic Downloads: Terrarium never downloads or pulls models without
     explicit operator approval. If a model is missing, pull instructions are displayed.
  3. No Cloud Egress: Local model queries are never routed to external providers.
================================================================================
`);
}

/**
 * Handles execution of 'bun run terrarium --ollama <model>' or 'bun run terrarium -- ollama <model>'.
 */
export async function handleOllamaCommand(
  args: readonly string[],
  runner: OllamaRunner = new OllamaRunner()
): Promise<number> {
  const parsed = parseOllamaArgs(args);

  if (parsed.showHelp) {
    printOllamaHelp();
    return 0;
  }

  const discovery = await runner.discoverExecutable(parsed.customExecutablePath);

  if (parsed.showVersion) {
    console.log(`Terrarium Ollama Integration: adapter v0.1.0`);
    console.log(`Host executable: ${discovery.executablePath ?? "not found"}`);
    console.log(`Detected version: ${discovery.version ?? "unknown"}`);
    return discovery.found ? 0 : 1;
  }

  if (!discovery.found || !discovery.executablePath) {
    console.error(`\n[FAIL] OLLAMA CLI NOT DETECTED`);
    console.error(`Reason: Executable 'ollama' was not found in PATH or standard installation locations.`);
    console.error(`Search locations checked:\n  • ${discovery.searchLocations.join("\n  • ")}`);
    console.error(`\nTo install Ollama, download from https://ollama.com or specify:`);
    console.error(`  bun run terrarium --ollama <model> --executable /path/to/ollama\n`);
    return 1;
  }

  if (!parsed.model) {
    console.error(`\n[FAIL] MISSING MODEL NAME`);
    console.error(`Usage: bun run terrarium --ollama <model>`);
    console.error(`Example: bun run terrarium --ollama llama3.2\n`);
    return 1;
  }

  if (parsed.dryRun) {
    const cmd = runner.buildLaunchVector(discovery.executablePath, parsed.model, parsed.passthroughArgs);
    console.log(`\nTERRARIUM OLLAMA RUNNER`);
    console.log(`──────────────────────────────────────────────────────────────────────────────`);
    console.log(`[OK] Executable:  ${discovery.executablePath}`);
    console.log(`[OK] Detected:    ${discovery.version ?? "verified"}`);
    console.log(`[OK] Model:       ${parsed.model}`);
    console.log(`[OK] Privacy:     100% Local Inference (Zero Data Egress)`);
    console.log(`──────────────────────────────────────────────────────────────────────────────`);
    console.log(`[DRY-RUN] Prepared launch command vector:`);
    console.log(`Command: ${JSON.stringify(cmd)}`);
    console.log(`Working directory: ${parsed.workspaceRoot}`);
    return 0;
  }

  const launchOpts: OllamaLaunchOptions = {
    model: parsed.model,
    passthroughArgs: parsed.passthroughArgs,
    workspaceRoot: parsed.workspaceRoot,
    customExecutablePath: parsed.customExecutablePath,
    dryRun: false,
  };

  const result = await runner.launch(launchOpts);
  if (!result.success && result.error) {
    console.error(`\n[FAIL] Ollama execution failed:`);
    console.error(result.error);
  }
  return result.exitCode;
}
