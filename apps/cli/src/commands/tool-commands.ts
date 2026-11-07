/**
 * @terrarium/cli - commands/tool-commands.ts
 *
 * Command line handlers for tool registry inspection, schema discovery,
 * permission viewing, and risk analysis.
 * Aligns strictly with PLAN.md Section 16 & Prompt 10 instructions (A4 - Approval & Tool UX).
 */

import {
  type ToolDefinition,
  type ToolFilter,
  type ToolRegistry,
  type ToolRiskLevel,
  type Result,
  type TerrariumError,
  ok,
  fail,
  ToolNotFoundError,
} from "@terrarium/contracts";
import { formatRiskBadge } from "./risk-communicator.ts";

export interface ToolCommandOptions {
  readonly json?: boolean;
  readonly useColor?: boolean;
  readonly category?: string;
  readonly risk?: ToolRiskLevel;
  readonly search?: string;
}

export interface ToolSummaryView {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly riskLevel: ToolRiskLevel;
  readonly sideEffectClass: string;
  readonly permissions: readonly string[];
  readonly requiresApproval: boolean;
  readonly timeoutMs: number;
}

/**
 * Lists all registered tools with risk levels, permissions, and approval requirements.
 */
export async function handleToolList(
  registry: ToolRegistry,
  options: ToolCommandOptions = {}
): Promise<Result<{ output: string; tools: readonly ToolSummaryView[] }, TerrariumError>> {
  const filter: {
    category?: string;
    riskLevel?: ToolRiskLevel;
    search?: string;
  } = {};
  if (options.category) filter.category = options.category;
  if (options.risk) filter.riskLevel = options.risk;
  if (options.search) filter.search = options.search;

  const tools = registry.list(filter);

  const summaries: ToolSummaryView[] = tools.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    riskLevel: t.riskLevel,
    sideEffectClass: t.sideEffectClass,
    permissions: t.requiredPermissions,
    requiresApproval: Boolean(t.requiresApproval),
    timeoutMs: t.defaultTimeoutMs,
  }));

  if (options.json) {
    return ok({
      output: JSON.stringify(summaries, null, 2),
      tools: summaries,
    });
  }

  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const reset = useColor ? "\x1b[0m" : "";
  const dim = useColor ? "\x1b[2m" : "";
  const yellow = useColor ? "\x1b[33m" : "";
  const green = useColor ? "\x1b[32m" : "";

  let table = `${bold}Terrarium Registered Tools (${summaries.length})${reset}\n`;
  table += `${dim}Tool ID               Category     Risk Level   Side-Effect      Approval?  Permissions${reset}\n`;
  table += `${dim}────────────────────────────────────────────────────────────────────────────────────────────${reset}\n`;

  for (const t of summaries) {
    const idPad = t.id.padEnd(21);
    const catPad = t.category.padEnd(12);
    const riskBadge = formatRiskBadge(t.riskLevel, useColor);
    const riskPad = riskBadge.padEnd(useColor ? 21 : 12);
    const sidePad = t.sideEffectClass.padEnd(16);
    const appText = t.requiresApproval ? `${yellow}YES (Gate)${reset}` : `${green}No${reset}`;
    const appPad = appText.padEnd(useColor ? 20 : 10);
    const perms = t.permissions.join(", ") || "none";

    table += `${idPad} ${catPad} ${riskPad} ${sidePad} ${appPad} ${perms}\n`;
  }

  return ok({
    output: table,
    tools: summaries,
  });
}

/**
 * Displays detailed schema and metadata for a specific tool.
 */
export async function handleToolInfo(
  toolId: string,
  registry: ToolRegistry,
  options: ToolCommandOptions = {}
): Promise<Result<string, TerrariumError>> {
  const tool = registry.get(toolId);
  if (!tool) {
    return fail(new ToolNotFoundError(toolId));
  }

  if (options.json) {
    return ok(JSON.stringify(tool, null, 2));
  }

  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const reset = useColor ? "\x1b[0m" : "";
  const dim = useColor ? "\x1b[2m" : "";
  const riskBadge = formatRiskBadge(tool.riskLevel, useColor);

  let card = `\n${bold}┌────────────────────────────────────────────────────────────────────────────┐${reset}\n`;
  card += `${bold}│ TOOL: ${tool.id.padEnd(66)}│${reset}\n`;
  card += `${bold}├────────────────────────────────────────────────────────────────────────────┤${reset}\n`;
  card += `│ ${bold}Name:${reset}        ${tool.name.padEnd(60)}│\n`;
  card += `│ ${bold}Category:${reset}    ${tool.category.padEnd(60)}│\n`;
  card += `│ ${bold}Version:${reset}     ${tool.version.padEnd(60)}│\n`;
  card += `│ ${bold}Risk Level:${reset}  ${riskBadge.padEnd(useColor ? 28 : 20)} ${bold}Side-Effect:${reset} ${tool.sideEffectClass.padEnd(20)}│\n`;
  card += `│ ${bold}Approval:${reset}    ${(Boolean(tool.requiresApproval) ? "REQUIRED (Human Gate)" : "Not required").padEnd(60)}│\n`;
  card += `│ ${bold}Timeouts:${reset}    Default: ${tool.defaultTimeoutMs}ms / Max: ${tool.maxTimeoutMs}ms${" ".repeat(Math.max(0, 36 - String(tool.defaultTimeoutMs).length - String(tool.maxTimeoutMs).length))}│\n`;
  card += `│ ${bold}Permissions:${reset} ${(tool.requiredPermissions.join(", ") || "none").padEnd(60)}│\n`;
  card += `│ ${bold}Description:${reset} ${tool.description.padEnd(60)}│\n`;

  card += `${bold}├────────────────────────────────────────────────────────────────────────────┤${reset}\n`;
  card += `│ ${bold}Input Parameters (Schema):${reset}${" ".repeat(48)}│\n`;

  const props = tool.inputSchema.properties;
  const reqSet = new Set(tool.inputSchema.required ?? []);

  for (const [propName, propSchema] of Object.entries(props)) {
    const isReq = reqSet.has(propName);
    const desc = propSchema.description ? ` - ${propSchema.description}` : "";
    const def = propSchema.default !== undefined ? ` [default: ${JSON.stringify(propSchema.default)}]` : "";
    const paramLine = `  • ${propName} (${propSchema.type}${isReq ? ", required" : ""})${def}${desc}`;
    const truncated = paramLine.length > 70 ? paramLine.substring(0, 67) + "..." : paramLine;
    card += `│ ${dim}${truncated.padEnd(73)}${reset}│\n`;
  }

  card += `${bold}└────────────────────────────────────────────────────────────────────────────┘${reset}\n`;
  return ok(card);
}
