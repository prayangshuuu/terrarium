/**
 * @terrarium/cli - commands/studio-commands.ts
 *
 * Command line handlers for Engineering Studio:
 * Repository static analysis, diff display, patch listing, application, rollback, and bounded test execution.
 * Contributed by A4 (CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns strictly with PLAN.md Section 17, PLAN_CONTEXT.md Section 7, and PROMPT 17.
 */

import {
  type CodeAnalysisSummary,
  type CodeFilePatch,
  type BoundedTestRunResult,
  type PatchApplicationResult,
  type PatchRollbackResult,
  type Result,
  type TerrariumError,
  ok,
  fail,
  NotFoundError,
} from "@terrarium/contracts";
import type { EngineeringStudioService } from "@terrarium/core";

export interface StudioCommandOptions {
  readonly json?: boolean;
  readonly useColor?: boolean;
  readonly patchId?: string;
  readonly command?: string;
  readonly timeoutMs?: number;
}

/**
 * Handles repository static analysis scan.
 */
export async function handleStudioAnalyze(
  studio: EngineeringStudioService,
  options: StudioCommandOptions = {}
): Promise<Result<{ output: string; summary: CodeAnalysisSummary }, TerrariumError>> {
  try {
    const summary = await studio.analyzeRepository();

    if (options.json) {
      return ok({
        output: JSON.stringify(summary, null, 2),
        summary,
      });
    }

    const useColor = options.useColor ?? false;
    const bold = useColor ? "\x1b[1m" : "";
    const reset = useColor ? "\x1b[0m" : "";
    const cyan = useColor ? "\x1b[36m" : "";
    const green = useColor ? "\x1b[32m" : "";
    const yellow = useColor ? "\x1b[33m" : "";
    const red = useColor ? "\x1b[31m" : "";
    const gray = useColor ? "\x1b[90m" : "";

    const lines: string[] = [
      `${bold}${cyan}=== Engineering Studio: Repository Analysis ===${reset}`,
      `${bold}Path:${reset} ${summary.repoPath}`,
      `${bold}Clean State:${reset} ${summary.isClean ? `${green}Clean${reset}` : `${yellow}Modified / Uncommitted Changes${reset}`}`,
      summary.branch ? `${bold}Branch:${reset} ${summary.branch}` : "",
      "",
      `${bold}Primary Languages:${reset}`,
    ];

    if (summary.languages.length === 0) {
      lines.push(`  ${gray}(no source files identified)${reset}`);
    } else {
      for (const lang of summary.languages) {
        lines.push(`  • ${lang.name}: ${lang.percentage}% (${lang.filesCount} files)`);
      }
    }

    lines.push("", `${bold}Frameworks & Runtimes:${reset}`);
    if (summary.frameworks.length === 0) {
      lines.push(`  ${gray}(none detected)${reset}`);
    } else {
      lines.push(`  ${summary.frameworks.join(", ")}`);
    }

    lines.push("", `${bold}Entry Points:${reset}`);
    if (summary.entryPoints.length === 0) {
      lines.push(`  ${gray}(none detected)${reset}`);
    } else {
      for (const ep of summary.entryPoints) {
        lines.push(`  • ${ep}`);
      }
    }

    lines.push("", `${bold}Sensitive / Protected Files Shield:${reset}`);
    if (summary.sensitiveFiles.length === 0) {
      lines.push(`  ${green}[OK] No unprotected secrets or credentials detected in project tree.${reset}`);
    } else {
      for (const sf of summary.sensitiveFiles) {
        lines.push(`  ${red}[WARN] [PROTECTED]${reset} ${sf.path} — ${sf.reason}`);
      }
    }

    return ok({
      output: lines.filter((l) => l !== "").join("\n"),
      summary,
    });
  } catch (err: unknown) {
    return fail(new NotFoundError("RepositoryAnalysis", String(err)));
  }
}

/**
 * Handles listing proposed and applied patches.
 */
export async function handleStudioListPatches(
  studio: EngineeringStudioService,
  options: StudioCommandOptions = {}
): Promise<Result<{ output: string; patches: readonly CodeFilePatch[] }, TerrariumError>> {
  const patches = studio.listPatches();

  if (options.json) {
    return ok({
      output: JSON.stringify(patches, null, 2),
      patches,
    });
  }

  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const reset = useColor ? "\x1b[0m" : "";
  const cyan = useColor ? "\x1b[36m" : "";
  const yellow = useColor ? "\x1b[33m" : "";
  const green = useColor ? "\x1b[32m" : "";
  const red = useColor ? "\x1b[31m" : "";
  const gray = useColor ? "\x1b[90m" : "";

  if (patches.length === 0) {
    return ok({
      output: `${gray}No code patches currently proposed or applied in Engineering Studio.${reset}`,
      patches: [],
    });
  }

  const lines: string[] = [
    `${bold}${cyan}=== Engineering Studio: Proposed & Applied Patches ===${reset}`,
    "",
  ];

  for (const patch of patches) {
    let statusBadge = `[${patch.status.toUpperCase()}]`;
    if (useColor) {
      if (patch.status === "applied") statusBadge = `${green}[APPLIED]${reset}`;
      else if (patch.status === "approved") statusBadge = `${green}[APPROVED]${reset}`;
      else if (patch.status === "proposed") statusBadge = `${yellow}[PROPOSED]${reset}`;
      else if (patch.status === "rejected" || patch.status === "failed")
        statusBadge = `${red}[${patch.status.toUpperCase()}]${reset}`;
      else if (patch.status === "rolled_back") statusBadge = `${gray}[ROLLED BACK]${reset}`;
    }

    lines.push(
      `${bold}Patch ID:${reset} ${patch.id} ${statusBadge}`,
      `  ${bold}File:${reset} ${patch.filePath} (${patch.changeType})`,
      `  ${bold}Rationale:${reset} ${patch.rationale}`,
      patch.requiresApproval
        ? `  ${bold}Approval Gate:${reset} Consequential change requires human authorization`
        : `  ${bold}Approval Gate:${reset} Auto-executable`,
      patch.rollbackGuidance ? `  ${bold}Rollback:${reset} ${patch.rollbackGuidance}` : "",
      ""
    );
  }

  return ok({
    output: lines.filter((l) => l !== "").join("\n"),
    patches,
  });
}

/**
 * Handles displaying unified diff for a proposed patch.
 */
export async function handleStudioDiff(
  studio: EngineeringStudioService,
  patchId: string,
  options: StudioCommandOptions = {}
): Promise<Result<{ output: string; patch: CodeFilePatch }, TerrariumError>> {
  const patch = studio.getPatch(patchId);
  if (!patch) {
    return fail(new NotFoundError("CodeFilePatch", patchId));
  }

  if (options.json) {
    return ok({
      output: JSON.stringify(patch, null, 2),
      patch,
    });
  }

  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const reset = useColor ? "\x1b[0m" : "";
  const cyan = useColor ? "\x1b[36m" : "";
  const green = useColor ? "\x1b[32m" : "";
  const red = useColor ? "\x1b[31m" : "";

  const lines: string[] = [
    `${bold}${cyan}=== Diff Inspector: ${patch.filePath} (${patch.id}) ===${reset}`,
    `${bold}Rationale:${reset} ${patch.rationale}`,
    `${bold}Status:${reset} ${patch.status}`,
    "",
  ];

  // Render colored diff if color requested
  const diffLines = patch.diffUnified.split("\n");
  for (const line of diffLines) {
    if (!useColor) {
      lines.push(line);
    } else if (line.startsWith("+++") || line.startsWith("---")) {
      lines.push(`${bold}${line}${reset}`);
    } else if (line.startsWith("+")) {
      lines.push(`${green}${line}${reset}`);
    } else if (line.startsWith("-")) {
      lines.push(`${red}${line}${reset}`);
    } else if (line.startsWith("@@")) {
      lines.push(`${cyan}${line}${reset}`);
    } else {
      lines.push(line);
    }
  }

  return ok({
    output: lines.join("\n"),
    patch,
  });
}

/**
 * Handles applying a patch to the workspace.
 */
export async function handleStudioApply(
  studio: EngineeringStudioService,
  patchId: string,
  options: StudioCommandOptions = {}
): Promise<Result<{ output: string; result: PatchApplicationResult }, TerrariumError>> {
  const result = await studio.applyPatch(patchId);

  if (options.json) {
    return ok({
      output: JSON.stringify(result, null, 2),
      result,
    });
  }

  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const reset = useColor ? "\x1b[0m" : "";
  const green = useColor ? "\x1b[32m" : "";
  const red = useColor ? "\x1b[31m" : "";

  if (result.success) {
    return ok({
      output: [
        `${green}[OK] Successfully applied patch '${patchId}' to '${result.filePath}'${reset}`,
        `  ${bold}Rollback guidance:${reset} ${result.rollbackGuidance}`,
      ].join("\n"),
      result,
    });
  }

  return fail(
    new NotFoundError(
      "PatchApply",
      `${red}[FAIL] Failed to apply patch '${patchId}': ${result.error}${reset}`
    )
  );
}

/**
 * Handles rolling back an applied patch.
 */
export async function handleStudioRollback(
  studio: EngineeringStudioService,
  patchId: string,
  options: StudioCommandOptions = {}
): Promise<Result<{ output: string; result: PatchRollbackResult }, TerrariumError>> {
  const result = await studio.rollbackPatch(patchId);

  if (options.json) {
    return ok({
      output: JSON.stringify(result, null, 2),
      result,
    });
  }

  const useColor = options.useColor ?? false;
  const reset = useColor ? "\x1b[0m" : "";
  const green = useColor ? "\x1b[32m" : "";
  const red = useColor ? "\x1b[31m" : "";

  if (result.success) {
    return ok({
      output: `${green}[OK] Successfully rolled back patch '${patchId}' for file '${result.filePath}'. Working tree restored.${reset}`,
      result,
    });
  }

  return fail(
    new NotFoundError(
      "PatchRollback",
      `${red}[FAIL] Failed to rollback patch '${patchId}': ${result.error}${reset}`
    )
  );
}

/**
 * Handles bounded test execution run.
 */
export async function handleStudioTest(
  studio: EngineeringStudioService,
  options: StudioCommandOptions = {}
): Promise<Result<{ output: string; result: BoundedTestRunResult }, TerrariumError>> {
  const result = await studio.runBoundedTests(options.command, options.timeoutMs);

  if (options.json) {
    return ok({
      output: JSON.stringify(result, null, 2),
      result,
    });
  }

  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const reset = useColor ? "\x1b[0m" : "";
  const green = useColor ? "\x1b[32m" : "";
  const red = useColor ? "\x1b[31m" : "";
  const cyan = useColor ? "\x1b[36m" : "";

  const lines: string[] = [
    `${bold}${cyan}=== Engineering Studio: Bounded Test Run ===${reset}`,
    `${bold}Command:${reset} ${result.command}`,
    `${bold}Duration:${reset} ${result.durationMs}ms`,
    `${bold}Exit Code:${reset} ${result.exitCode}`,
    result.passed
      ? `${green}[OK] PASSED (${result.passedTests} passed, ${result.totalTests} total)${reset}`
      : `${red}[FAIL] FAILED (${result.failedTests} failed, ${result.passedTests} passed, ${result.totalTests} total)${reset}`,
  ];

  if (result.timedOut) {
    lines.push(`${red}[WARN] Test execution exceeded configured execution timeout boundary.${reset}`);
  }

  if (result.stdout.trim()) {
    lines.push("", `${bold}Standard Output:${reset}`, result.stdout.trim());
  }

  if (result.stderr.trim()) {
    lines.push("", `${bold}Standard Error:${reset}`, result.stderr.trim());
  }

  return ok({
    output: lines.join("\n"),
    result,
  });
}
