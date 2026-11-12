/**
 * @terrarium/cli - commands/coding-agent-commands.ts
 *
 * CLI command handlers for Universal Coding Agent Integrations.
 * Provides terminal table outputs, compatibility matrices, context previews,
 * and safe execution invocation.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import {
  type CodingAgentRegistry,
  type CodingAgentRouter,
} from "@terrarium/core";
import {
  type CodingAgentMetadata,
  type CodingAgentType,
  type Result,
  type TerrariumError,
  ok,
  fail,
} from "@terrarium/contracts";

export interface CodingAgentListOptions {
  readonly json?: boolean;
}

export interface CodingAgentPreviewOptions {
  readonly agentId?: CodingAgentType;
  readonly prompt: string;
  readonly contextFiles?: string[];
  readonly workingDirectory?: string;
  readonly readOnly?: boolean;
  readonly json?: boolean;
}

export interface CodingAgentRunOptions {
  readonly agentId?: CodingAgentType;
  readonly prompt: string;
  readonly workingDirectory?: string;
  readonly timeoutMs?: number;
  readonly json?: boolean;
}

/**
 * Handles listing registered coding agent adapters.
 */
export async function handleCodingAgentList(
  registry: CodingAgentRegistry,
  options: CodingAgentListOptions = {}
): Promise<Result<string, TerrariumError>> {
  const discovered = await registry.discoverHostTools();

  if (options.json) {
    return ok(JSON.stringify(discovered, null, 2));
  }

  const lines: string[] = [];
  lines.push("TERRARIUM CODING AGENT INTEGRATIONS");
  lines.push("─".repeat(88));
  lines.push(
    "TOOL ID".padEnd(20) +
      "NAME".padEnd(30) +
      "STATUS".padEnd(16) +
      "INSTALLED".padEnd(12) +
      "VERSION"
  );
  lines.push("─".repeat(88));

  for (const meta of discovered) {
    const statusLabel =
      meta.compatibility === "supported"
        ? "[SUPPORTED]"
        : meta.compatibility === "partially_supported"
        ? "[PARTIAL]"
        : meta.compatibility === "experimental"
        ? "[EXP]"
        : "[UNAVAILABLE]";

    const installedLabel = meta.isInstalled ? "YES" : "NO";
    const versionLabel = meta.detectedVersion ?? "unknown";

    lines.push(
      meta.id.padEnd(20) +
        meta.name.slice(0, 28).padEnd(30) +
        statusLabel.padEnd(16) +
        installedLabel.padEnd(12) +
        versionLabel
    );
  }

  lines.push("─".repeat(88));
  lines.push(`Total Integrations: ${discovered.length}`);
  return ok(lines.join("\n"));
}

/**
 * Handles printing the honest compatibility matrix.
 */
export function handleCodingAgentMatrix(
  registry: CodingAgentRegistry,
  json = false
): Result<string, TerrariumError> {
  const matrix = registry.getCompatibilityMatrix();

  if (json) {
    return ok(JSON.stringify(matrix, null, 2));
  }

  const lines: string[] = [];
  lines.push("TERRARIUM CODING AGENT COMPATIBILITY MATRIX");
  lines.push("═".repeat(100));

  for (const entry of matrix) {
    lines.push(`• ${entry.name} (${entry.id})`);
    lines.push(`  Category:       ${entry.category}`);
    lines.push(`  Executable:     ${entry.executableName} (Installed: ${entry.isInstalled ? "YES" : "NO"})`);
    lines.push(`  Compatibility:  ${entry.compatibility.toUpperCase()}`);
    lines.push(`  Supported Modes:${entry.supportedModes.join(", ")}`);
    if (entry.limitations.length > 0) {
      lines.push(`  Limitations:    ${entry.limitations.join("; ")}`);
    }
    lines.push("─".repeat(100));
  }

  return ok(lines.join("\n"));
}

/**
 * Handles generating a transparent Context Preview before execution.
 */
export function handleCodingAgentPreview(
  router: CodingAgentRouter,
  options: CodingAgentPreviewOptions
): Result<string, TerrariumError> {
  const res = router.generateContextPreview(
    {
      taskId: `task_preview_${Date.now()}`,
      prompt: options.prompt,
      workingDirectory: options.workingDirectory ?? process.cwd(),
      contextFiles: options.contextFiles,
      readOnly: options.readOnly ?? true,
    },
    options.agentId
  );

  if (!res.success) {
    return fail({
      name: "ContextPreviewError",
      message: res.error,
      code: "CONTEXT_PREVIEW_ERROR",
    } as any);
  }

  const preview = res.data;

  if (options.json) {
    return ok(JSON.stringify(preview, null, 2));
  }

  const lines: string[] = [];
  lines.push("CODING AGENT CONTEXT DISCLOSURE PREVIEW");
  lines.push("═".repeat(80));
  lines.push(`Destination Tool:    ${preview.agentName} (${preview.agentId})`);
  lines.push(`Service Category:    ${preview.category}`);
  lines.push(`Destination Target:  ${preview.destinationEndpoint}`);
  lines.push(`Working Directory:   ${preview.workingDirectory}`);
  lines.push(`Operation Mode:      ${preview.readOnly ? "READ-ONLY (Safe)" : "MUTATING (Alters Working Tree)"}`);
  lines.push(`Human Approval:      ${preview.requiresApproval ? "REQUIRED" : "NOT REQUIRED"}`);
  lines.push(`Estimated Risk:      ${preview.estimatedRisk.toUpperCase()}`);
  lines.push("─".repeat(80));
  lines.push(`Prompt Content:`);
  lines.push(`  "${preview.promptPreview}"`);
  lines.push("─".repeat(80));
  lines.push(`Files Shared with Tool (${preview.includedFiles.length}):`);
  if (preview.includedFiles.length === 0) {
    lines.push("  (No specific files attached; workspace boundary applies)");
  } else {
    for (const file of preview.includedFiles) {
      lines.push(`  • ${file}`);
    }
  }
  lines.push("═".repeat(80));

  return ok(lines.join("\n"));
}
