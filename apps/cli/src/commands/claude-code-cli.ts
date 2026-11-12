/**
 * @terrarium/cli - commands/claude-code-cli.ts
 *
 * First-Class Claude Code Terminal Command Handler.
 * Invoked via: `bun run terrarium -- claude code [options]`
 * Contributed by A4 (Senior CLI/TUI Designer) & A2 (Orchestration & AI Runtime).
 *
 * Enforces:
 * - Clean argument vector forwarding (no shell interpolation).
 * - Standard mode as default with preserved permission prompts.
 * - Explicit opt-in for --dangerously-skip-permissions.
 * - Mandatory isolation gate before dangerous-permissions launch.
 * - Full interactive stdio passthrough.
 * - 100% emoji-free professional terminal presentation.
 */

import {
  type ClaudeCodeExecutionPolicy,
  type ClaudeCodeLaunchOptions,
} from "@terrarium/contracts";
import { ClaudeCodeRunner, verifyIsolation } from "@terrarium/core";
import readline from "node:readline";
import path from "node:path";

export interface ParsedClaudeArgs {
  readonly isClaudeCode: boolean;
  readonly executionPolicy: ClaudeCodeExecutionPolicy;
  readonly explicitOptIn: boolean;
  readonly confirmed: boolean;
  readonly workspaceRoot: string;
  readonly customExecutablePath?: string;
  readonly dryRun: boolean;
  readonly showHelp: boolean;
  readonly showVersion: boolean;
  readonly passthroughArgs: readonly string[];
}

/**
 * Parses user arguments after 'claude code' or 'claude'.
 */
export function parseClaudeCodeArgs(args: readonly string[]): ParsedClaudeArgs {
  let startIndex = 0;

  // Handle 'claude code' vs 'claude'
  if (args[0] === "claude") {
    startIndex = 1;
    if (args[1] === "code") {
      startIndex = 2;
    }
  }

  const remaining = args.slice(startIndex);
  const passthroughArgs: string[] = [];

  let executionPolicy: ClaudeCodeExecutionPolicy = "standard";
  let explicitOptIn = false;
  let confirmed = false;
  let dryRun = false;
  let showHelp = false;
  let showVersion = false;
  let customExecutablePath: string | undefined;
  let workspaceRoot = process.cwd();

  for (let i = 0; i < remaining.length; i++) {
    const arg = remaining[i];
    if (arg === undefined) continue;

    if (arg === "--dangerously-skip-permissions" || arg === "--danger-mode" || arg === "--isolated-bypass") {
      executionPolicy = "isolated_bypass";
      explicitOptIn = true;
    } else if (arg === "--yes" || arg === "-y" || arg === "--confirm-isolated-bypass" || arg === "--allow-danger") {
      confirmed = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--help" && remaining.length === 1) {
      showHelp = true;
    } else if (arg === "--version" && remaining.length === 1) {
      showVersion = true;
    } else if (arg === "--workspace" || arg === "--isolation-dir") {
      const nextArg = remaining[i + 1];
      if (nextArg !== undefined) {
        workspaceRoot = nextArg;
        i++;
      }
    } else if (arg.startsWith("--workspace=")) {
      workspaceRoot = arg.substring("--workspace=".length);
    } else if (arg === "--executable") {
      const nextArg = remaining[i + 1];
      if (nextArg !== undefined) {
        customExecutablePath = nextArg;
        i++;
      }
    } else if (arg.startsWith("--executable=")) {
      customExecutablePath = arg.substring("--executable=".length);
    } else {
      passthroughArgs.push(arg);
    }
  }

  return {
    isClaudeCode: true,
    executionPolicy,
    explicitOptIn,
    confirmed,
    workspaceRoot,
    customExecutablePath,
    dryRun,
    showHelp,
    showVersion,
    passthroughArgs,
  };
}

/**
 * Prompts user for interactive confirmation in the terminal.
 */
async function promptConfirmation(promptText: string): Promise<boolean> {
  // If not a TTY (running in pipe or non-interactive script), require explicit --yes
  if (!process.stdin.isTTY) {
    return false;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<boolean>((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === "y" || trimmed === "yes");
    });
  });
}

/**
 * Formats and prints command line help for Claude Code integration.
 */
export function printClaudeCodeHelp(): void {
  console.log(`
TERRARIUM CLAUDE CODE INTEGRATION
================================================================================
Invocation:
  bun run terrarium -- claude code [options] [passthrough-args...]

Description:
  Launches Anthropic's Claude Code CLI as a first-class coding agent through
  TERRARIUM. Manages argument forwarding, environment sanitization, process
  lifecycle, signal handling, and execution permissions.

Execution Modes:
  [STANDARD] (Default)
    Preserves Claude Code's normal permission behavior. Every command or tool
    invocation prompts the user interactively inside Claude Code.
    No dangerous flags are added.

  [ISOLATED-BYPASS] (Explicit Opt-In Only)
    Launches Claude Code with '--dangerously-skip-permissions'.
    MANDATORY PRECONDITIONS:
    1. Requires explicit command-line opt-in: '--dangerously-skip-permissions'
    2. Requires interactive confirmation or '--yes' flag
    3. Requires a verified isolated workspace directory or dedicated Git worktree
    4. Prohibits launching against filesystem root (/) or user home directory (~)
    5. Strips ambient cloud credentials, SSH keys, and secret tokens from environment
    Terrarium FAILS CLOSED if isolation verification does not succeed.

Terrarium Launch Options:
  --dangerously-skip-permissions   Opt into dangerous-permissions bypass mode
  --yes, -y                        Confirm dangerous mode non-interactively
  --workspace <path>               Specify target project/workspace directory
  --executable <path>              Override path to 'claude' CLI binary
  --dry-run                        Print resolved launch command without executing
  --help                           Show this Terrarium integration help

Argument Passthrough:
  All remaining options and arguments are forwarded directly to Claude Code
  using safe argument vectors without shell concatenation.
  Examples:
    bun run terrarium -- claude code --help
    bun run terrarium -- claude code --version
    bun run terrarium -- claude code --model claude-3-7-sonnet
    bun run terrarium -- claude code -p "Summarize project architecture"

Troubleshooting:
  Missing Executable:
    If 'claude' is not detected, install Claude Code via:
      npm install -g @anthropic-ai/claude-code
    Or set CLAUDE_EXECUTABLE_PATH=/path/to/claude in your environment.
================================================================================
`);
}

/**
 * Main execution handler for `bun run terrarium -- claude code`.
 */
export async function handleClaudeCodeCommand(args: readonly string[]): Promise<number> {
  const parsed = parseClaudeCodeArgs(args);

  if (parsed.showHelp) {
    printClaudeCodeHelp();
    return 0;
  }

  const runner = new ClaudeCodeRunner();

  // 1. Discover executable
  const discovery = await runner.discoverExecutable(parsed.customExecutablePath);
  if (!discovery.found || !discovery.executablePath) {
    console.error("\n[FAIL] Claude Code executable not found on host system.");
    console.error("Searched locations:");
    for (const loc of discovery.searchLocations) {
      console.error(`  - ${loc}`);
    }
    console.error("\nActionable Diagnostics:");
    console.error("  1. Ensure Claude Code is installed globally:");
    console.error("     npm install -g @anthropic-ai/claude-code");
    console.error("  2. Or specify custom binary path:");
    console.error("     bun run terrarium -- claude code --executable /path/to/claude");
    console.error("  3. Or export CLAUDE_EXECUTABLE_PATH=/path/to/claude\n");
    return 1;
  }

  if (parsed.showVersion) {
    console.log(`Terrarium Claude Code Integration: adapter v0.1.0`);
    console.log(`Host executable: ${discovery.executablePath}`);
    console.log(`Detected version: ${discovery.version ?? "unknown"}`);
    return 0;
  }

  const resolvedWorkspace = path.resolve(parsed.workspaceRoot);

  console.log("\nTERRARIUM CLAUDE CODE RUNNER");
  console.log("─".repeat(78));
  console.log(`[OK] Executable:  ${discovery.executablePath}`);
  console.log(`[OK] Detected:    ${discovery.version ?? "unknown"}`);
  console.log(`[OK] Workspace:   ${resolvedWorkspace}`);

  let isConfirmed = parsed.confirmed;

  // 2. Dangerous permissions check
  if (parsed.executionPolicy === "isolated_bypass") {
    console.log(`[WARN] DANGEROUS PERMISSIONS MODE REQUESTED`);
    console.log(`Mode:        [ISOLATED-BYPASS] Claude Code permission prompts will be bypassed!`);
    console.log(`Isolation:   Verifying workspace isolation boundary...`);

    const isolationReport = await verifyIsolation(resolvedWorkspace);

    if (!isolationReport.isIsolated) {
      console.error("\n[FAIL] ISOLATION GATE VERIFICATION FAILED");
      console.error(`Reason: ${isolationReport.failureReason}`);
      console.error("\nTerrarium security policy mandates fail-closed behavior.");
      console.error("Dangerous-permissions mode cannot be launched without verified isolation.");
      console.error("Remaining risks and honest limitations:");
      for (const lim of isolationReport.honestLimitations) {
        console.error(`  • ${lim}`);
      }
      console.error("\nTo run safely with standard permission prompts, omit '--dangerously-skip-permissions':");
      console.error("  bun run terrarium -- claude code\n");
      return 1;
    }

    console.log(`[SEC] Workspace boundary verified: ${resolvedWorkspace}`);
    console.log(`[SEC] Protected paths shielded:    ${isolationReport.shieldedPaths.join(", ")}`);
    console.log(`[SEC] Environment sanitized:       Ambient cloud & SSH tokens stripped`);
    console.log(`[WARN] Notice: Claude Code will bypass interactive permission prompts inside this folder.`);

    // Interactive confirmation prompt if not already confirmed with --yes
    if (!isConfirmed) {
      console.log("");
      const confirmed = await promptConfirmation(
        "Proceed with dangerous-permissions mode in this isolated workspace? (y/N): "
      );
      if (!confirmed) {
        console.log("\n[CANCELLED] Dangerous-permissions launch cancelled by operator.\n");
        return 0;
      }
      isConfirmed = true;
    }
  } else {
    console.log(`[MODE] Policy:     [STANDARD] Normal Claude Code permission prompts preserved`);
  }

  console.log("─".repeat(78));

  // 3. Launch via ClaudeCodeRunner
  const launchOptions: ClaudeCodeLaunchOptions = {
    rawArgs: args,
    passthroughArgs: parsed.passthroughArgs,
    executionPolicy: parsed.executionPolicy,
    explicitOptIn: parsed.explicitOptIn,
    confirmed: isConfirmed,
    workspaceRoot: resolvedWorkspace,
    customExecutablePath: discovery.executablePath,
    dryRun: parsed.dryRun,
    interactive: true,
  };

  if (parsed.dryRun) {
    console.log("[DRY-RUN] Prepared launch command vector:");
    const dryRunArgs = [discovery.executablePath];
    if (parsed.executionPolicy === "isolated_bypass") {
      dryRunArgs.push("--dangerously-skip-permissions");
    }
    dryRunArgs.push(...parsed.passthroughArgs);
    console.log(`Command: ${JSON.stringify(dryRunArgs)}`);
    console.log(`Working directory: ${resolvedWorkspace}`);
    return 0;
  }

  console.log(`[RUN] Starting Claude Code interactive session...\n`);

  const result = await runner.launch(launchOptions);

  if (!result.success && result.error) {
    console.error(`\n[FAIL] Claude Code session failed: ${result.error}`);
    return result.exitCode || 1;
  }

  return result.exitCode;
}
