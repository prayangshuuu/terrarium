/**
 * apps/cli/src/commands/cursor-agent-cli.ts
 *
 * Cursor Agent CLI Command Handler & Terminal Formatter (Prompt 25).
 * Invocation: bun run terrarium -- agent [options] [passthrough-args...]
 *
 * Contributed by A4 (Senior CLI/TUI Designer) & A1 (Platform & Architecture).
 * Strictly complies with zero-emoji terminal typography.
 */

import { CursorAgentRunner, type CursorAgentLaunchOptions } from "@terrarium/core";

export interface ParsedCursorAgentCliArgs {
  readonly isCursorAgent: boolean;
  readonly showHelp: boolean;
  readonly showVersion: boolean;
  readonly dryRun: boolean;
  readonly customExecutablePath?: string;
  readonly workspaceRoot: string;
  readonly passthroughArgs: readonly string[];
}

/**
 * Parses command-line arguments for Cursor Agent ('agent' or 'cursor').
 */
export function parseCursorAgentArgs(args: readonly string[]): ParsedCursorAgentCliArgs {
  if (args.length === 0) {
    return {
      isCursorAgent: false,
      showHelp: false,
      showVersion: false,
      dryRun: false,
      workspaceRoot: process.cwd(),
      passthroughArgs: [],
    };
  }

  const primary = args[0]?.toLowerCase();
  const isAgent = primary === "agent" || primary === "cursor" || primary === "cursor-agent";
  if (!isAgent) {
    return {
      isCursorAgent: false,
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
    isCursorAgent: true,
    showHelp,
    showVersion,
    dryRun,
    customExecutablePath,
    workspaceRoot,
    passthroughArgs,
  };
}

/**
 * Prints help for the Cursor Agent integration.
 */
export function printCursorAgentHelp(): void {
  console.log(`
TERRARIUM CURSOR AGENT INTEGRATION
================================================================================
Invocation:
  bun run terrarium -- agent [options] [passthrough-args...]

Description:
  Launches Cursor Agent CLI ('agent') as an integrated coding agent through
  TERRARIUM. Manages argument forwarding, environment sanitization, process
  lifecycle, and clean terminal handoff.

Terrarium Launch Options:
  --dry-run              Print resolved launch command vector without executing
  --workspace <path>     Specify target project or workspace directory
  --executable <path>    Override path to 'agent' binary
  --help                 Show this Terrarium integration help

Argument Passthrough:
  All remaining options are forwarded directly to the Cursor Agent CLI:
    bun run terrarium -- agent --help
    bun run terrarium -- agent --version
    bun run terrarium -- agent --plan
    bun run terrarium -- agent -p "Inspect database models"

Discovery Hierarchy:
  1. User flag: --executable <path>
  2. Environment: CURSOR_AGENT_EXECUTABLE or AGENT_EXECUTABLE_PATH
  3. System PATH: which agent / which cursor
  4. Standard user directories: ~/.local/bin/agent, ~/.cursor/bin/agent
================================================================================
`);
}

/**
 * Handles execution of 'bun run terrarium -- agent'.
 */
export async function handleCursorAgentCommand(
  args: readonly string[],
  runner: CursorAgentRunner = new CursorAgentRunner()
): Promise<number> {
  const parsed = parseCursorAgentArgs(args);

  if (parsed.showHelp) {
    printCursorAgentHelp();
    return 0;
  }

  const discovery = await runner.discoverExecutable(parsed.customExecutablePath);

  if (parsed.showVersion) {
    console.log(`Terrarium Cursor Agent Integration: adapter v0.1.0`);
    console.log(`Host executable: ${discovery.executablePath ?? "not found"}`);
    console.log(`Detected version: ${discovery.version ?? "unknown"}`);
    return discovery.found ? 0 : 1;
  }

  if (!discovery.found || !discovery.executablePath) {
    console.error(`\n[FAIL] CURSOR AGENT CLI NOT DETECTED`);
    console.error(`Reason: Executable 'agent' was not found in PATH or standard installation locations.`);
    console.error(`Search locations checked:\n  • ${discovery.searchLocations.join("\n  • ")}`);
    console.error(`\nTo install Cursor Agent CLI, install Cursor or configure:`);
    console.error(`  bun run terrarium -- agent --executable /path/to/agent\n`);
    return 1;
  }

  if (parsed.dryRun) {
    const cmd = runner.buildLaunchVector(discovery.executablePath, parsed.passthroughArgs);
    console.log(`\nTERRARIUM CURSOR AGENT RUNNER`);
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

  const launchOpts: CursorAgentLaunchOptions = {
    passthroughArgs: parsed.passthroughArgs,
    workspaceRoot: parsed.workspaceRoot,
    customExecutablePath: parsed.customExecutablePath,
    dryRun: false,
  };

  const result = await runner.launch(launchOpts);
  if (!result.success && result.error) {
    console.error(`\n[FAIL] Cursor Agent process failed: ${result.error}`);
  }
  return result.exitCode;
}
