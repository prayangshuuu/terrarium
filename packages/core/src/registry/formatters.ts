/**
 * @terrarium/core - registry/formatters.ts
 *
 * Terminal and Studio-compatible formatting and presentation utilities for agent profiles.
 * Aligns with PLAN.md Section 4 & 18 and PLAN_CONTEXT.md Section 2.
 */

import {
  type AgentProfile,
  type DepartmentTaxonomy,
} from "@terrarium/contracts";

/**
 * Formats a single agent profile as a rich information card for terminal or detail inspection.
 */
export function formatProfileCard(profile: AgentProfile): string {
  const lines: string[] = [];

  const statusBadge = profile.status === "available" ? "[AVAILABLE]" : `[${profile.status.toUpperCase()}]`;
  const personaBadge = profile.personaAttributes ? " (Simulated Persona)" : "";

  lines.push(`┌─────────────────────────────────────────────────────────────────────────────┐`);
  lines.push(`│ ${profile.displayName}${personaBadge}`);
  lines.push(`│ Status: ${statusBadge}   Version: v${profile.version}   Dept: ${profile.department}`);
  lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
  lines.push(`  ID:          ${profile.id}`);
  lines.push(`  Slug:        ${profile.slug}`);
  lines.push(`  Role:        ${profile.role}`);
  lines.push(`  Model Tier:  ${profile.modelPreference.tier.toUpperCase()}` + 
    (profile.modelPreference.preferredModel ? ` (${profile.modelPreference.preferredModel})` : ""));
  lines.push("");
  lines.push(`  Description:`);
  lines.push(`    ${profile.description}`);
  lines.push("");

  if (profile.personaAttributes) {
    lines.push(`  Simulated Persona Profile:`);
    lines.push(`    • Occupation:           ${profile.personaAttributes.occupation}`);
    lines.push(`    • Technical Knowledge:  ${profile.personaAttributes.technicalFamiliarity}`);
    lines.push(`    • Price Sensitivity:    ${profile.personaAttributes.priceSensitivity}`);
    lines.push(`    • Buying Criteria:      ${profile.personaAttributes.buyingCriteria.join(", ")}`);
    lines.push(`    • Adoption Barriers:    ${profile.personaAttributes.adoptionBarriers.join(", ")}`);
    lines.push("");
  }

  lines.push(`  Declared Capabilities (${profile.capabilities.length}):`);
  if (profile.capabilities.length === 0) {
    lines.push(`    (none declared)`);
  } else {
    for (const cap of profile.capabilities) {
      const consequential = cap.isConsequential ? " [CONSEQUENTIAL]" : "";
      lines.push(`    • ${cap.name}${consequential}: ${cap.description}`);
    }
  }
  lines.push("");

  lines.push(`  Supported Tasks (${profile.supportedTasks.length}):`);
  if (profile.supportedTasks.length === 0) {
    lines.push(`    (none declared)`);
  } else {
    lines.push(`    ${profile.supportedTasks.join(", ")}`);
  }
  lines.push("");

  lines.push(`  Operational Constraints:`);
  lines.push(`    • Max Tokens/Turn:      ${profile.constraints.maxTokensPerTurn}`);
  lines.push(`    • Max Delegation Depth: ${profile.constraints.maxDelegationDepth}`);
  lines.push(`    • Max Children Tasks:   ${profile.constraints.maxChildrenTasks}`);
  if (profile.constraints.timeoutMs) {
    lines.push(`    • Timeout:              ${profile.constraints.timeoutMs / 1000}s`);
  }
  if (profile.constraints.disallowedTools && profile.constraints.disallowedTools.length > 0) {
    lines.push(`    • Prohibited Tools:     ${profile.constraints.disallowedTools.join(", ")}`);
  }
  lines.push("");

  lines.push(`  Permissions (${profile.permissions.length}):`);
  lines.push(`    ${profile.permissions.length > 0 ? profile.permissions.join(", ") : "(read-only baseline)"}`);
  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);

  return lines.join("\n");
}

/**
 * Formats a collection of agent profiles as a clean, aligned terminal table.
 */
export function formatProfileTable(profiles: readonly AgentProfile[]): string {
  if (profiles.length === 0) {
    return "No agent profiles found matching query.";
  }

  const headers = ["SLUG", "NAME", "DEPARTMENT", "ROLE", "TIER", "STATUS"];
  const rows = profiles.map((p) => [
    p.slug,
    p.name,
    p.department,
    p.role.length > 28 ? p.role.slice(0, 25) + "..." : p.role,
    p.modelPreference.tier,
    p.status,
  ]);

  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const maxVal = Math.max(...rows.map((r) => (r[i] ?? "").length), h.length);
    return Math.min(maxVal, 32);
  });

  const formatRow = (cols: string[]) =>
    cols.map((col, i) => (col ?? "").padEnd(colWidths[i] ?? 10)).join("  ");

  const lines: string[] = [];
  lines.push(formatRow(headers));
  lines.push(colWidths.map((w) => "─".repeat(w)).join("  "));
  for (const row of rows) {
    lines.push(formatRow(row));
  }

  return lines.join("\n");
}

/**
 * Formats department taxonomy details with profile counts.
 */
export function formatDepartmentSummary(
  taxonomy: DepartmentTaxonomy,
  agentCount: number
): string {
  const lines: string[] = [];
  const personaTag = taxonomy.isSimulatedPersona ? " [Simulated Personas]" : "";

  lines.push(`=== ${taxonomy.name}${personaTag} (${taxonomy.id}) ===`);
  lines.push(`Description:    ${taxonomy.description}`);
  lines.push(`Lead Role:      ${taxonomy.defaultLeadRole}`);
  lines.push(`Registered:     ${agentCount} profile(s)`);
  lines.push(`Risk Profile:   ${taxonomy.riskProfile.toUpperCase()}`);
  lines.push(`Default Tier:   ${taxonomy.defaultModelTier.toUpperCase()}`);
  lines.push(`Typical Tasks:  ${taxonomy.supportedTaskTypes.join(", ")}`);
  lines.push(`Core Outputs:   ${taxonomy.typicalOutputs.join(", ")}`);

  return lines.join("\n");
}
