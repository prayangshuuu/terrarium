/**
 * @terrarium/core - reports/markdown-generator.ts
 *
 * Generates standardized, readable GitHub-Flavored Markdown reports from structured Report entities.
 * Strictly implements Prompt 18 and PLAN.md Section 8 & 15:
 * - Distinguishes verified facts, generated analysis, assumptions, hypotheses, and simulated feedback.
 * - Displays prominent simulation notice banners whenever synthetic customer personas are present.
 * - Formats evidence matrix, sources provenance trail, disagreements, and prioritized recommendations.
 * - Strips hidden chain-of-thought, leaving only concise rationale and evidence.
 */

import {
  type Report,
  type ReportEvidenceItem,
  type EvidenceClaimType,
  SIMULATED_RESEARCH_DISCLAIMER,
} from "@terrarium/contracts";

export class MarkdownGenerator {
  /**
   * Generates formatted GitHub-Flavored Markdown from a structured Report.
   */
  static generate(report: Report): string {
    const lines: string[] = [];

    // 1. Report Title & Top Metadata
    lines.push(`# ${report.title}`);
    lines.push("");
    lines.push(`**Report Type:** \`${report.reportType}\` | **Task ID:** \`${report.taskId}\` | **Status:** \`${report.status.toUpperCase()}\``);
    lines.push(`**Generated At:** ${report.createdAt} | **Confidence:** **\`[${report.confidence.toUpperCase()}]\`**`);
    if (report.agentsInvolved && report.agentsInvolved.length > 0) {
      lines.push(`**Agents Involved:** ${report.agentsInvolved.map((a) => `\`${a}\``).join(", ")}`);
    }
    lines.push("");

    // 2. Mandatory Simulation Integrity Notice
    if (report.hasSimulatedData) {
      lines.push("> [!WARNING]");
      lines.push("> **SIMULATION INTEGRITY NOTICE: SYNTHETIC CUSTOMER RESEARCH**");
      lines.push(`> ${SIMULATED_RESEARCH_DISCLAIMER}`);
      if (report.simulationMetadata) {
        lines.push(`> `);
        lines.push(`> **Scenario:** ${report.simulationMetadata.scenario}`);
        lines.push(`> **Sampling Rationale:** ${report.simulationMetadata.samplingRationale}`);
        lines.push(`> **Personas Evaluated:** ${report.simulationMetadata.personas.map((p) => `${p.name} (${p.archetype})`).join(", ")}`);
      }
      lines.push("");
    }

    // 3. Section 1: Executive Summary & Objective
    lines.push("## 1. Executive Summary & Objective");
    lines.push("");
    lines.push(`**Objective:** ${report.objective}`);
    lines.push("");
    lines.push(report.summary);
    lines.push("");

    // 4. Section 2: Methodology
    lines.push("## 2. Methodology & Synthesis Protocol");
    lines.push("");
    lines.push(report.method);
    lines.push("");

    // 5. Section 3: Evidence Matrix & Epistemic Classification
    lines.push("## 3. Evidence Matrix & Epistemic Classification");
    lines.push("");
    lines.push("All statements are categorized by their epistemic status to separate empirically verified facts from synthetic assumptions and generated analysis.");
    lines.push("");

    if (report.evidence.length === 0) {
      lines.push("_No individual evidence items recorded for this report._");
    } else {
      lines.push("| ID | Epistemic Status | Claim | Conf. | Source / Provenance | Rationale |");
      lines.push("| :--- | :--- | :--- | :---: | :--- | :--- |");

      for (const item of report.evidence) {
        const badge = this.formatClaimBadge(item.claimType);
        const sourceRef = item.sourceRef || item.sourceId || (item.simulatedPersonaId ? `Persona: ${item.simulatedPersonaId}` : "Internal Synthesis");
        const rationale = item.rationale ? item.rationale.replace(/\|/g, "\\|") : "—";
        const cleanClaim = item.claim.replace(/\|/g, "\\|");
        const confBadge = item.confidence.toUpperCase();

        lines.push(`| \`${item.id}\` | ${badge} | ${cleanClaim} | \`${confBadge}\` | \`${sourceRef}\` | ${rationale} |`);
      }
    }
    lines.push("");

    // 6. Section 4: Sources & Provenance Trail
    lines.push("## 4. Sources & Provenance Trail");
    lines.push("");
    if (report.sources.length === 0) {
      lines.push("_No external sources or artifacts cited._");
    } else {
      lines.push("| Source ID | Type | Title / Description | URI / Location | Checksum / SHA-256 |");
      lines.push("| :--- | :--- | :--- | :--- | :--- |");
      for (const src of report.sources) {
        const typeBadge = src.isSimulatedPersona ? "`simulated_persona`" : `\`${src.sourceType}\``;
        const uri = src.uri ? `\`${src.uri}\`` : "—";
        const checksum = src.checksum ? `\`${src.checksum.slice(0, 12)}...\`` : "—";
        lines.push(`| \`${src.id}\` | ${typeBadge} | ${src.title} | ${uri} | ${checksum} |`);
      }
    }
    lines.push("");

    // 7. Section 5: Explicit Assumptions
    lines.push("## 5. Explicit Assumptions");
    lines.push("");
    if (report.assumptions.length === 0) {
      lines.push("_None recorded._");
    } else {
      for (const asm of report.assumptions) {
        lines.push(`- ${asm}`);
      }
    }
    lines.push("");

    // 8. Section 6: Preserved Disagreements & Tradeoffs
    lines.push("## 6. Preserved Disagreements & Trade-offs");
    lines.push("");
    lines.push("In alignment with Terrarium core principles, dissenting perspectives and architectural disagreements are preserved rather than obscured through artificial consensus.");
    lines.push("");

    if (report.disagreements.length === 0) {
      lines.push("_No unresolved or competing perspectives recorded for this evaluation._");
    } else {
      for (const dis of report.disagreements) {
        lines.push(`### ⚠️ ${dis.topic}`);
        lines.push(`**Status:** \`${dis.resolutionStatus.toUpperCase()}\``);
        lines.push("");
        lines.push(dis.summary);
        lines.push("");
        if (dis.tradeOffImplication) {
          lines.push(`**Trade-off Implication:** ${dis.tradeOffImplication}`);
          lines.push("");
        }

        lines.push("#### Competing Perspectives:");
        for (const p of dis.perspectives) {
          const simBadge = p.isSimulatedPersona ? " `[SIMULATED PERSONA]`" : " `[AGENT]`";
          lines.push(`- **${p.participantName}**${simBadge}:`);
          lines.push(`  - *Stance:* ${p.stance}`);
          lines.push(`  - *Rationale:* ${p.rationale}`);
        }
        lines.push("");
      }
    }

    // 9. Section 7: Prioritized Recommendations & Next Actions
    lines.push("## 7. Prioritized Recommendations & Next Actions");
    lines.push("");
    if (report.recommendations.length === 0) {
      lines.push("_No recommendations formulated._");
    } else {
      for (const rec of report.recommendations) {
        lines.push(`### \`[${rec.priority}]\` ${rec.title}`);
        if (rec.ownerRole) {
          lines.push(`**Owner:** \`${rec.ownerRole}\``);
        }
        lines.push("");
        lines.push(rec.description);
        lines.push("");
        lines.push(`> **Rationale:** ${rec.rationale}`);
        lines.push("");

        if (rec.nextActions && rec.nextActions.length > 0) {
          lines.push("**Action Items:**");
          for (const act of rec.nextActions) {
            lines.push(`- [ ] ${act}`);
          }
          lines.push("");
        }
      }
    }

    // 10. Section 8: Confidence Assessment & Limitations
    lines.push("## 8. Confidence Assessment & Limitations");
    lines.push("");
    lines.push(`**Overall Assessment:** **\`[${report.confidence.toUpperCase()}]\`**`);
    if (report.confidenceRationale) {
      lines.push(`*${report.confidenceRationale}*`);
      lines.push("");
    }

    lines.push("### Known Limitations & Risk Boundaries");
    if (report.limitations.length === 0) {
      lines.push("- Standard operational constraints apply.");
    } else {
      for (const lim of report.limitations) {
        lines.push(`- ${lim}`);
      }
    }
    lines.push("");

    lines.push("---");
    lines.push(`*Generated deterministically by Terrarium Orchestration Engine (${new Date().toISOString()})*`);

    return lines.join("\n");
  }

  private static formatClaimBadge(type: EvidenceClaimType): string {
    switch (type) {
      case "verified_fact":
        return "`[VERIFIED FACT]`";
      case "generated_analysis":
        return "`[ANALYSIS]`";
      case "assumption":
        return "`[ASSUMPTION]`";
      case "hypothesis":
        return "`[HYPOTHESIS]`";
      case "simulated_feedback":
        return "`[SIMULATED]`";
      default:
        return `\`[${String(type).toUpperCase()}\`]`;
    }
  }
}
