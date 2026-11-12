/**
 * @terrarium/cli - commands/cli-dispatcher.ts
 *
 * Universal Command Line Dispatcher for TERRARIUM.
 * Routes command line invocations:
 *   bun run terrarium -- claude code [options]
 *   bun run terrarium -- help
 *   bun run terrarium -- agent list
 *   bun run terrarium -- coding-agents list
 *   bun run terrarium (launches interactive OpenTUI)
 *
 * Contributed by A4 (Senior CLI/TUI Designer) & A1 (Platform & Architecture).
 */

import { handleClaudeCodeCommand, printClaudeCodeHelp } from "./claude-code-cli.ts";
import { handleAgentList, handleAgentSearch, handleAgentInspect, handleDepartmentList } from "./agent-commands.ts";
import { handleCodingAgentList, handleCodingAgentMatrix } from "./coding-agent-commands.ts";
import { createCoreEngine } from "@terrarium/core";
import { getDefaultConfig } from "@terrarium/config";

/**
 * Prints the main TERRARIUM CLI help documentation.
 */
export function printMainCliHelp(): void {
  console.log(`
TERRARIUM — On-Demand Multi-Agent AI Orchestration Platform
================================================================================
Usage:
  bun run terrarium                                Launch interactive OpenTUI terminal shell
  bun run terrarium -- claude code [options]       Launch first-class Claude Code session
  bun run terrarium -- <command> [subcommand]      Execute CLI subcommands
  bun run terrarium -- help                        Show this help documentation

Core Commands:
  claude code [options]      Launch Anthropic Claude Code via Terrarium
                             Options:
                               --dangerously-skip-permissions  Bypass permission prompts (requires verified isolation)
                               --yes, -y                       Confirm dangerous mode non-interactively
                               --workspace <path>              Set workspace directory
                               --dry-run                       Simulate launch without executing
                               --help                          Show Claude Code integration help

  agent list [options]       List agent profiles from the 700+ ecosystem catalog
  agent search <query>       Search agent profiles across roles, capabilities, and domains
  agent inspect <idOrSlug>   Inspect full profile details and capability specifications
  agent departments          List all 10 virtual organization departments

  coding-agents list         List universal coding agent CLI adapters and host tools
  coding-agents matrix       Display compatibility matrix and isolation capabilities

Terminal UI (Default):
  Running 'bun run terrarium' without arguments launches the full-screen OpenTUI
  workspace featuring all 10 workspaces, interactive agent explorer, task intake,
  Engineering Studio, and settings.

Documentation:
  Run 'bun run terrarium -- claude --help' for detailed Claude Code integration docs.
================================================================================
`);
}

/**
 * Dispatches CLI arguments passed to Terrarium.
 * Returns true if an argument command was handled, false if no arguments were provided (launch TUI).
 */
export async function dispatchCliCommand(rawArgs: readonly string[]): Promise<boolean> {
  if (rawArgs.length === 0) {
    return false; // Launch interactive TUI
  }

  const primaryCmd = rawArgs[0]?.toLowerCase();
  if (!primaryCmd) {
    return false;
  }

  // 1. Help commands
  if (primaryCmd === "help" || primaryCmd === "--help" || primaryCmd === "-h") {
    printMainCliHelp();
    process.exit(0);
  }

  // 2. Claude / Claude Code command
  if (primaryCmd === "claude") {
    const subCmd = rawArgs[1]?.toLowerCase();
    if (subCmd === "--help" || subCmd === "-h") {
      printClaudeCodeHelp();
      process.exit(0);
    }

    const exitCode = await handleClaudeCodeCommand(rawArgs);
    process.exit(exitCode);
  }

  // 3. Agent catalog commands
  if (primaryCmd === "agent" || primaryCmd === "agents") {
    const subCmd = rawArgs[1]?.toLowerCase() ?? "list";
    const config = getDefaultConfig();
    const engine = createCoreEngine({ config, enableDatabase: true });

    try {
      if (subCmd === "list") {
        const res = await handleAgentList(engine.registry, { limit: 50 });
        if (res.success) {
          console.log(res.data);
          process.exit(0);
        } else {
          console.error(`[FAIL] ${res.error.message}`);
          process.exit(1);
        }
      } else if (subCmd === "search") {
        const query = rawArgs[2] ?? "";
        const res = await handleAgentSearch(engine.registry, query);
        if (res.success) {
          console.log(res.data);
          process.exit(0);
        } else {
          console.error(`[FAIL] ${res.error.message}`);
          process.exit(1);
        }
      } else if (subCmd === "inspect") {
        const idOrSlug = rawArgs[2] ?? "";
        const res = await handleAgentInspect(engine.registry, idOrSlug);
        if (res.success) {
          console.log(res.data);
          process.exit(0);
        } else {
          console.error(`[FAIL] ${res.error.message}`);
          process.exit(1);
        }
      } else if (subCmd === "departments") {
        const res = await handleDepartmentList(engine.registry);
        if (res.success) {
          console.log(res.data);
          process.exit(0);
        } else {
          console.error(`[FAIL] ${res.error.message}`);
          process.exit(1);
        }
      } else {
        console.error(`[FAIL] Unknown agent subcommand '${subCmd}'. Valid: list, search, inspect, departments.`);
        process.exit(1);
      }
    } finally {
      await engine.shutdown();
    }
  }

  // 4. Coding agent commands
  if (primaryCmd === "coding-agents" || primaryCmd === "coding-agent") {
    const subCmd = rawArgs[1]?.toLowerCase() ?? "list";
    const config = getDefaultConfig();
    const engine = createCoreEngine({ config, enableDatabase: true });

    try {
      if (subCmd === "matrix") {
        const res = handleCodingAgentMatrix(engine.codingAgents);
        if (res.success) {
          console.log(res.data);
          process.exit(0);
        }
      } else {
        const res = await handleCodingAgentList(engine.codingAgents);
        if (res.success) {
          console.log(res.data);
          process.exit(0);
        }
      }
    } finally {
      await engine.shutdown();
    }
    process.exit(0);
  }

  // Unknown command
  console.error(`[FAIL] Unknown command '${primaryCmd}'. Run 'bun run terrarium -- help' for available commands.`);
  process.exit(1);
}
