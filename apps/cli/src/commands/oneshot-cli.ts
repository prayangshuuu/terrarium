/**
 * apps/cli/src/commands/oneshot-cli.ts
 *
 * One-shot CLI prompt runner for TERRARIUM (Prompt 26).
 * Supports non-interactive execution:
 *   terrarium "Review this codebase and identify risks"
 *   terrarium run "..." --provider claude
 *   terrarium run "..." --provider agy
 *   terrarium run "..." --provider agent
 *   terrarium run "..." --provider ollama --model qwen2.5:7b
 *   echo "..." | terrarium
 *
 * Contributed by A1 (Platform & Architecture) & A4 (Senior CLI/TUI Designer).
 * Zero emoji terminal typography.
 */

import { existsSync, writeFileSync } from "node:fs";
import { type PromptTargetProvider } from "@terrarium/contracts";
import {
  detectProjectRoot,
  assemblePromptContext,
  getPromptStorage,
} from "@terrarium/core";
import { handleClaudeCodeCommand } from "./claude-code-cli.ts";
import { handleAntigravityCommand } from "./antigravity-cli.ts";
import { handleCursorAgentCommand } from "./cursor-agent-cli.ts";
import { handleOllamaCommand } from "./ollama-cli.ts";
import { createCoreEngine } from "@terrarium/core";
import { getDefaultConfig } from "@terrarium/config";

export interface OneshotOptions {
  readonly promptText: string;
  readonly provider: PromptTargetProvider;
  readonly model?: string;
  readonly workspace: string;
  readonly dryRun: boolean;
  readonly includeContext: boolean;
  readonly outputFile?: string;
  readonly asJson: boolean;
}

/**
 * Parses command line arguments for one-shot prompt execution.
 */
export function parseOneshotArgs(args: readonly string[]): OneshotOptions {
  let promptText = "";
  let provider: PromptTargetProvider = "orchestrator";
  let model: string | undefined;
  let workspace = process.cwd();
  let dryRun = false;
  let includeContext = true;
  let outputFile: string | undefined;
  let asJson = false;

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";

    if (arg === "--provider" || arg === "-p") {
      const p = args[++i]?.toLowerCase();
      if (p === "claude" || p === "claude_code" || p === "claude-code") {
        provider = "claude_code";
      } else if (p === "agy" || p === "antigravity") {
        provider = "antigravity";
      } else if (p === "agent" || p === "cursor" || p === "cursor-agent") {
        provider = "cursor";
      } else if (p === "ollama") {
        provider = "ollama";
      } else if (p === "orchestrator") {
        provider = "orchestrator";
      }
    } else if (arg === "--model" || arg === "-m") {
      model = args[++i];
    } else if (arg === "--workspace" || arg === "-w") {
      workspace = args[++i] ?? process.cwd();
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--no-context") {
      includeContext = false;
    } else if (arg === "--output" || arg === "-o") {
      outputFile = args[++i];
    } else if (arg === "--json") {
      asJson = true;
    } else if (arg === "run") {
      // subcommand keyword, ignore
      continue;
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  promptText = positional.join(" ").trim();

  return {
    promptText,
    provider,
    model,
    workspace,
    dryRun,
    includeContext,
    outputFile,
    asJson,
  };
}

/**
 * Executes a one-shot prompt run from CLI.
 */
export async function handleOneshotCommand(rawArgs: readonly string[]): Promise<number> {
  const options = parseOneshotArgs(rawArgs);

  if (!options.promptText) {
    console.error("[FAIL] Empty prompt. Usage: terrarium run \"<prompt>\" [options]");
    return 1;
  }

  // 1. Detect project context
  const projectInfo = detectProjectRoot(options.workspace);

  // 2. Assemble context if requested
  let contextPayload = "";
  if (options.includeContext) {
    const context = assemblePromptContext(projectInfo.projectRoot, [
      "project_manifest",
      "project_tree",
      "git_status",
    ]);
    contextPayload = context.textSnippet;
  }

  const effectivePrompt = contextPayload
    ? `${contextPayload}\n\nTask:\n${options.promptText}`
    : options.promptText;

  // 3. Record in prompt storage (with automatic secret redaction)
  const storage = getPromptStorage();
  const historyItem = storage.recordPrompt({
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: options.promptText,
    provider: options.provider,
    projectRoot: projectInfo.projectRoot,
    selectedProfiles: [],
    submittedAt: new Date().toISOString(),
    status: "completed",
  });

  // 4. Handle Dry Run
  if (options.dryRun) {
    if (options.asJson) {
      console.log(
        JSON.stringify(
          {
            status: "dry_run",
            project: projectInfo,
            provider: options.provider,
            model: options.model ?? "default",
            promptText: historyItem.text,
            contextIncluded: options.includeContext,
            outputFile: options.outputFile,
          },
          null,
          2
        )
      );
      return 0;
    }

    console.log(`
TERRARIUM ONE-SHOT PROMPT RUNNER
──────────────────────────────────────────────────────────────────────────────
[OK] Project Root:   ${projectInfo.projectRoot} (${projectInfo.projectName})
[OK] Provider:       ${options.provider}
[OK] Model:          ${options.model ?? "default"}
[OK] Context Bound:  ${options.includeContext ? "Enabled (manifest, tree, git)" : "Disabled"}
──────────────────────────────────────────────────────────────────────────────
[DRY-RUN] Prepared prompt payload:
${historyItem.text}
──────────────────────────────────────────────────────────────────────────────
Prompt logged to history (id: ${historyItem.id}). Execution bypassed in dry-run mode.
`);
    return 0;
  }

  // 5. Provider Dispatch
  try {
    if (options.provider === "claude_code") {
      const exitCode = await handleClaudeCodeCommand([
        "claude",
        "code",
        "-p",
        effectivePrompt,
        "--workspace",
        projectInfo.projectRoot,
      ]);
      return exitCode;
    }

    if (options.provider === "antigravity") {
      const exitCode = await handleAntigravityCommand([
        "agy",
        effectivePrompt,
        "--workspace",
        projectInfo.projectRoot,
      ]);
      return exitCode;
    }

    if (options.provider === "cursor") {
      const exitCode = await handleCursorAgentCommand([
        "agent",
        "-p",
        effectivePrompt,
        "--workspace",
        projectInfo.projectRoot,
      ]);
      return exitCode;
    }

    if (options.provider === "ollama") {
      const modelName = options.model ?? "llama3.2";
      const exitCode = await handleOllamaCommand([
        "ollama",
        modelName,
        effectivePrompt,
      ]);
      return exitCode;
    }

    // Default: Orchestrator execution
    console.log(`[TERRARIUM] Dispatching task to Orchestrator: "${options.promptText.slice(0, 60)}..."`);
    const config = getDefaultConfig();
    const engine = createCoreEngine({ config, enableDatabase: true });

    try {
      const intakeRes = await engine.intake.processIntake({
        prompt: effectivePrompt,
        projectContext: {
          rootDir: projectInfo.projectRoot,
          name: projectInfo.projectName,
          scope: "full_codebase",
        },
      });

      if (!intakeRes.success) {
        console.error(`[FAIL] Task intake failed: ${intakeRes.error.message}`);
        return 1;
      }

      const plan = intakeRes.data.plan;
      const taskId = plan.taskId ?? plan.id;
      const dept = plan.classification.primaryDepartment;
      console.log(`[OK] Task analyzed & planned: ${taskId}`);
      console.log(`[OK] Department: ${dept} | Risk: ${plan.classification.risk.level} | Uncertainty: ${plan.classification.uncertainty.level}`);
      if (plan.steps.length > 0) {
        console.log(`[OK] Plan Steps (${plan.steps.length}):`);
        for (const step of plan.steps) {
          console.log(`  - [Step ${step.stepIndex}] ${step.title} (${step.department})`);
        }
      }

      const resultText = `Task ${taskId} intake analyzed and scheduled for project ${projectInfo.projectName} (${dept}).`;
      console.log(`[OK] Execution complete.\n\n${resultText}`);

      if (options.outputFile) {
        writeFileSync(options.outputFile, resultText, "utf8");
        console.log(`[OK] Result written to ${options.outputFile}`);
      }

      return 0;
    } finally {
      await engine.shutdown();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FAIL] Prompt execution error: ${msg}`);
    return 1;
  }
}
