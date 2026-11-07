/**
 * @terrarium/cli - commands/agent-commands.ts
 *
 * Command line handlers for agent directory inspection, search, and department taxonomies.
 * Aligns with PLAN.md Section 4 & 14 and PLAN_CONTEXT.md Section 2.
 */

import {
  type AgentDepartment,
  type AgentProfileFilter,
  type AgentRegistry,
  type Result,
  type TerrariumError,
  fail,
  listDepartmentTaxonomies,
  ok,
} from "@terrarium/contracts";
import {
  formatDepartmentSummary,
  formatProfileCard,
  formatProfileTable,
} from "@terrarium/core";

export interface AgentListCommandOptions extends AgentProfileFilter {}

/**
 * Handles agent profile listing for terminal output.
 */
export async function handleAgentList(
  registry: AgentRegistry,
  options: AgentListCommandOptions = {}
): Promise<Result<string, TerrariumError>> {
  const listRes = await registry.list(options);
  if (!listRes.success) {
    return fail(listRes.error);
  }

  const table = formatProfileTable(listRes.data);
  const total = listRes.data.length;
  const header = `Terrarium Agent Profile Directory (${total} profile${total === 1 ? "" : "s"} shown)\n`;

  return ok(header + table);
}

/**
 * Handles agent search across keywords, capabilities, and roles.
 */
export async function handleAgentSearch(
  registry: AgentRegistry,
  query: string,
  department?: AgentDepartment
): Promise<Result<string, TerrariumError>> {
  const searchRes = await registry.search({ query, department });
  if (!searchRes.success) {
    return fail(searchRes.error);
  }

  const table = formatProfileTable(searchRes.data);
  const header = `Search Results for "${query}" (${searchRes.data.length} match${searchRes.data.length === 1 ? "" : "es"})\n`;

  return ok(header + table);
}

/**
 * Handles detailed profile inspection by ID or slug.
 */
export async function handleAgentInspect(
  registry: AgentRegistry,
  idOrSlug: string
): Promise<Result<string, TerrariumError>> {
  const inspectRes = await registry.inspect(idOrSlug);
  if (!inspectRes.success) {
    return fail(inspectRes.error);
  }

  return ok(formatProfileCard(inspectRes.data));
}

/**
 * Handles listing virtual organization departments and taxonomies.
 */
export async function handleDepartmentList(
  registry?: AgentRegistry
): Promise<Result<string, TerrariumError>> {
  const taxonomies = listDepartmentTaxonomies();
  const summaries: string[] = [];

  for (const tax of taxonomies) {
    const count = registry ? await registry.count(tax.id) : 0;
    summaries.push(formatDepartmentSummary(tax, count));
  }

  return ok(summaries.join("\n\n"));
}
