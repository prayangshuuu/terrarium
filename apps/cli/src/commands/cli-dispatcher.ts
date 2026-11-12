/**
 * @terrarium/cli - commands/cli-dispatcher.ts
 *
 * Universal Command Line Dispatcher for TERRARIUM (Prompt 24 & Prompt 25).
 * Routes user-facing command line invocations:
 *   bun run terrarium -- claude code [options]
 *   bun run terrarium -- agy [options]
 *   bun run terrarium -- agent [options]
 *   bun run terrarium --ollama <model> [options]
 *   bun run terrarium -- ollama <model> [options]
 *   bun run terrarium -- agent list [options]
 *   bun run terrarium -- help
 *   bun run terrarium (launches interactive OpenTUI)
 *
 * Contributed by A4 (Senior CLI/TUI Designer) & A1 (Platform & Architecture).
 * Strictly complies with zero-emoji terminal typography.
 */

import { handleClaudeCodeCommand, printClaudeCodeHelp } from "./claude-code-cli.ts";
import { handleAntigravityCommand, printAntigravityHelp } from "./antigravity-cli.ts";
import { handleCursorAgentCommand, printCursorAgentHelp } from "./cursor-agent-cli.ts";
import { handleOllamaCommand, printOllamaHelp } from "./ollama-cli.ts";
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
  bun run terrarium -- <command> [options]         Execute CLI subcommands or agent tools
  bun run terrarium --ollama <model>               Run local model via Ollama
  bun run terrarium -- help                        Show this help documentation

Unified Multi-Provider Coding Agent Commands:
  claude code [options]      Launch Anthropic Claude Code via Terrarium
                             Options:
                               --dangerously-skip-permissions  Bypass permission prompts (requires verified isolation)
                               --yes, -y                       Confirm dangerous mode non-interactively
                               --workspace <path>              Set workspace directory
                               --dry-run                       Simulate launch without executing
                               --help                          Show Claude Code integration help

  agy [options]              Launch Google Antigravity CLI via Terrarium
                             Options:
                               --dry-run                       Simulate launch without executing
                               --workspace <path>              Set workspace directory
                               --executable <path>             Override 'agy' path
                               --help                          Show Antigravity integration help

  agent [options]            Launch Cursor Agent CLI via Terrarium
                             Options:
                               --dry-run                       Simulate launch without executing
                               --workspace <path>              Set workspace directory
                               --executable <path>             Override 'agent' path
                               --help                          Show Cursor Agent integration help

  --ollama <model>           Run a local model through Ollama (100% private, zero egress)
  ollama <model>             Alternative syntax for local Ollama model execution
                             Options:
                               --dry-run                       Simulate launch without executing
                               --help                          Show Ollama integration help

Agent Profile Ecosystem Commands:
  agent list [options]       List agent profiles from the 700+ ecosystem catalog
  agent search <query>       Search agent profiles across roles, capabilities, and domains
  agent inspect <idOrSlug>   Inspect full profile details and capability specifications
  agent departments          List all 10 virtual organization departments

Specialist Provider & Diagnostics:
  coding-agents list         List universal coding agent CLI adapters and host tools
  coding-agents matrix       Display compatibility matrix and isolation capabilities

Terminal UI (Default):
  Running 'bun run terrarium' without arguments launches the full-screen OpenTUI
  workspace featuring all 10 workspaces, interactive agent explorer, task intake,
  Engineering Studio, and settings.
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

  // 3. Antigravity CLI ('agy' or 'antigravity')
  if (primaryCmd === "agy" || primaryCmd === "antigravity") {
    const subCmd = rawArgs[1]?.toLowerCase();
    if (subCmd === "--help" || subCmd === "-h") {
      printAntigravityHelp();
      process.exit(0);
    }

    const exitCode = await handleAntigravityCommand(rawArgs);
    process.exit(exitCode);
  }

  // 4. Ollama model runner ('--ollama <model>' or 'ollama <model>')
  if (primaryCmd === "--ollama" || primaryCmd === "-ollama" || primaryCmd === "ollama") {
    const exitCode = await handleOllamaCommand(rawArgs);
    process.exit(exitCode);
  }

  // 5. Cursor Agent command vs Agent Catalog command
  if (primaryCmd === "cursor" || primaryCmd === "cursor-agent") {
    const exitCode = await handleCursorAgentCommand(rawArgs);
    process.exit(exitCode);
  }

  if (primaryCmd === "agent" || primaryCmd === "agents") {
    const subCmd = rawArgs[1]?.toLowerCase();
    const isCatalogSubcommand =
      subCmd === "list" ||
      subCmd === "search" ||
      subCmd === "inspect" ||
      subCmd === "departments" ||
      subCmd === "seed";

    // If sub-command is a catalog action, route to Agent Registry
    if (isCatalogSubcommand) {
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
        }
      } finally {
        await engine.shutdown();
      }
    } else {
      // Otherwise, route to Cursor Agent CLI runner (e.g. 'bun run terrarium -- agent', 'agent -p', 'agent --help')
      const exitCode = await handleCursorAgentCommand(rawArgs);
      process.exit(exitCode);
    }
  }

  // 6. Coding agent commands
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
