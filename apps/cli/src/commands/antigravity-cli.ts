/**
 * apps/cli/src/commands/antigravity-cli.ts
 *
 * Antigravity CLI Command Handler & Terminal Formatter (Prompt 25).
 * Invocation: bun run terrarium -- agy [options] [passthrough-args...]
 *
 * Contributed by A4 (Senior CLI/TUI Designer) & A1 (Platform & Architecture).
 * Strictly complies with zero-emoji terminal typography.
 */

import { AntigravityRunner, type AntigravityLaunchOptions } from "@terrarium/core";

export interface ParsedAntigravityCliArgs {
  readonly isAntigravity: boolean;
  readonly showHelp: boolean;
  readonly showVersion: boolean;
  readonly dryRun: boolean;
  readonly customExecutablePath?: string;
  readonly workspaceRoot: string;
  readonly passthroughArgs: readonly string[];
}

/**
 * Parses command-line arguments for 'agy'.
 */
export function parseAntigravityArgs(args: readonly string[]): ParsedAntigravityCliArgs {
  if (args.length === 0) {
    return {
      isAntigravity: false,
      showHelp: false,
      showVersion: false,
      dryRun: false,
      workspaceRoot: process.cwd(),
      passthroughArgs: [],
    };
  }

  const primary = args[0]?.toLowerCase();
  const isAgy = primary === "agy" || primary === "antigravity";
  if (!isAgy) {
    return {
      isAntigravity: false,
      showHelp: false,
      showVersion: false,
      dryRun: false,
      workspaceRoot: process.cwd(),
      passthroughArgs: [],
    };
  }

  const remaining = args.slice(1);
  const passthroughArgs: string[] = [];
  let showHelp = false;
  let showVersion = false;
  let dryRun = false;
  let customExecutablePath: string | undefined;
  let workspaceRoot = process.cwd();

  for (let i = 0; i < remaining.length; i++) {
    const arg = remaining[i];
    if (arg === undefined) continue;

    if (arg === "--help" && remaining.length === 1) {
      showHelp = true;
    } else if (arg === "--version" && remaining.length === 1) {
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
    } else {
      passthroughArgs.push(arg);
    }
  }

  return {
    isAntigravity: true,
    showHelp,
    showVersion,
    dryRun,
    customExecutablePath,
    workspaceRoot,
    passthroughArgs,
  };
}

/**
 * Prints help for the Antigravity integration.
 */
export function printAntigravityHelp(): void {
  console.log(`
TERRARIUM ANTIGRAVITY INTEGRATION
================================================================================
Invocation:
  bun run terrarium -- agy [options] [passthrough-args...]

Description:
  Launches Google's Antigravity CLI as an integrated coding agent through
  TERRARIUM. Manages argument forwarding, environment sanitization, process
  lifecycle, and clean terminal handoff.

Terrarium Launch Options:
  --dry-run              Print resolved launch command vector without executing
  --workspace <path>     Specify target project or workspace directory
  --executable <path>    Override path to 'agy' binary
  --help                 Show this Terrarium integration help

Argument Passthrough:
  All remaining options are forwarded directly to the Antigravity CLI:
    bun run terrarium -- agy --help
    bun run terrarium -- agy --version
    bun run terrarium -- agy --mode auto
    bun run terrarium -- agy -p "Summarize domain boundaries"

Discovery Hierarchy:
  1. User flag: --executable <path>
  2. Environment: AGY_EXECUTABLE_PATH or ANTIGRAVITY_ENTRYPOINT
  3. System PATH: which agy / which antigravity
  4. Standard user directories: ~/.local/bin/agy, /opt/homebrew/bin/agy
================================================================================
`);
}

/**
 * Handles execution of 'bun run terrarium -- agy'.
 */
export async function handleAntigravityCommand(
  args: readonly string[],
  runner: AntigravityRunner = new AntigravityRunner()
): Promise<number> {
  const parsed = parseAntigravityArgs(args);

  if (parsed.showHelp) {
    printAntigravityHelp();
    return 0;
  }

  const discovery = await runner.discoverExecutable(parsed.customExecutablePath);

  if (parsed.showVersion) {
    console.log(`Terrarium Antigravity Integration: adapter v0.1.0`);
    console.log(`Host executable: ${discovery.executablePath ?? "not found"}`);
    console.log(`Detected version: ${discovery.version ?? "unknown"}`);
    return discovery.found ? 0 : 1;
  }

  if (!discovery.found || !discovery.executablePath) {
    console.error(`\n[FAIL] ANTIGRAVITY CLI NOT DETECTED`);
    console.error(`Reason: Executable 'agy' was not found in PATH or standard installation locations.`);
    console.error(`Search locations checked:\n  • ${discovery.searchLocations.join("\n  • ")}`);
    console.error(`\nTo install Antigravity CLI, ensure 'agy' is in your PATH or specify:`);
    console.error(`  bun run terrarium -- agy --executable /path/to/agy\n`);
    return 1;
  }

  if (parsed.dryRun) {
    const cmd = runner.buildLaunchVector(discovery.executablePath, parsed.passthroughArgs);
    console.log(`\nTERRARIUM ANTIGRAVITY RUNNER`);
    console.log(`──────────────────────────────────────────────────────────────────────────────`);
    console.log(`[OK] Executable:  ${discovery.executablePath}`);
    console.log(`[OK] Detected:    ${discovery.version ?? "verified"}`);
    console.log(`[OK] Workspace:   ${parsed.workspaceRoot}`);
    console.log(`──────────────────────────────────────────────────────────────────────────────`);
    console.log(`[DRY-RUN] Prepared launch command vector:`);
    console.log(`Command: ${JSON.stringify(cmd)}`);
    console.log(`Working directory: ${parsed.workspaceRoot}`);
    return 0;
  }

  const launchOpts: AntigravityLaunchOptions = {
    passthroughArgs: parsed.passthroughArgs,
    workspaceRoot: parsed.workspaceRoot,
    customExecutablePath: parsed.customExecutablePath,
    dryRun: false,
  };

  const result = await runner.launch(launchOpts);
  if (!result.success && result.error) {
    console.error(`\n[FAIL] Antigravity process failed: ${result.error}`);
  }
  return result.exitCode;
}
