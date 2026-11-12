/**
 * @terrarium/core - reports/provenance-validator.ts
 *
 * Verifies provenance integrity, epistemic consistency, simulation labeling,
 * and limitation requirements.
 * Strictly implements Prompt 18 requirements:
 * "Test missing sources, contradictions, low confidence, and simulation labels."
 */

import {
  type Report,
  type ReportEvidenceItem,
  type ReportSource,
  type Result,
  ok,
  fail,
  SIMULATED_RESEARCH_DISCLAIMER,
} from "@terrarium/contracts";

export interface ProvenanceValidationIssue {
  readonly code:
    | "MISSING_SOURCE"
    | "UNREGISTERED_SOURCE"
    | "SIMULATION_MISLABELED"
    | "MISSING_SIMULATION_DISCLAIMER"
    | "MISSING_LOW_CONFIDENCE_LIMITATION"
    | "UNACKNOWLEDGED_CONTRADICTION"
    | "INVALID_PERSONA_REFERENCE";
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly evidenceId?: string;
  readonly sourceId?: string;
}

export interface ProvenanceValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly ProvenanceValidationIssue[];
  readonly verifiedFactCount: number;
  readonly simulatedCount: number;
  readonly contradictionCount: number;
}

export class ProvenanceValidator {
  /**
   * Validates a complete report for provenance integrity, simulation labels,
   * contradiction handling, and confidence limitations.
   */
  static validate(report: Report): Result<ProvenanceValidationResult, ProvenanceValidationResult> {
    const issues: ProvenanceValidationIssue[] = [];
    const sourceIds = new Set(report.sources.map((s) => s.id));

    let verifiedFactCount = 0;
    let simulatedCount = 0;

    // 1. Check Evidence items: missing sources, unregistered sources, simulation labels
    for (const item of report.evidence) {
      if (item.claimType === "verified_fact") {
        verifiedFactCount++;
        if (!item.sourceId && !item.sourceRef) {
          issues.push({
            code: "MISSING_SOURCE",
            severity: "error",
            message: `Evidence item '${item.id}' is classified as verified_fact but has no sourceId or sourceRef.`,
            evidenceId: item.id,
          });
        } else if (item.sourceId && !sourceIds.has(item.sourceId)) {
          issues.push({
            code: "UNREGISTERED_SOURCE",
            severity: "error",
            message: `Evidence item '${item.id}' references sourceId '${item.sourceId}' which is not in report sources.`,
            evidenceId: item.id,
            sourceId: item.sourceId,
          });
        }

        if (!item.isVerified) {
          issues.push({
            code: "MISSING_SOURCE",
            severity: "warning",
            message: `Evidence item '${item.id}' is classified as verified_fact but isVerified is false.`,
            evidenceId: item.id,
          });
        }
      }

      if (item.claimType === "simulated_feedback") {
        simulatedCount++;
        if (!item.simulatedPersonaId) {
          issues.push({
            code: "INVALID_PERSONA_REFERENCE",
            severity: "error",
            message: `Evidence item '${item.id}' is classified as simulated_feedback but lacks simulatedPersonaId.`,
            evidenceId: item.id,
          });
        }
        if (item.isVerified) {
          issues.push({
            code: "SIMULATION_MISLABELED",
            severity: "error",
            message: `Evidence item '${item.id}' is simulated persona feedback but marked as isVerified=true. Simulated research cannot be verified as factual user data.`,
            evidenceId: item.id,
          });
        }
      }
    }

    // 2. Simulation Disclaimers & Integrity
    const hasSimulationItems =
      simulatedCount > 0 ||
      report.hasSimulatedData ||
      report.reportType === "customer_simulation" ||
      report.findings.some((f) => f.isSimulated);

    if (hasSimulationItems) {
      if (!report.hasSimulatedData) {
        issues.push({
          code: "SIMULATION_MISLABELED",
          severity: "error",
          message: "Report contains simulated findings or feedback but hasSimulatedData is false.",
        });
      }

      const markdownContainsNotice =
        report.markdownContent.includes("SIMULATION NOTICE") ||
        report.markdownContent.includes("simulated customer") ||
        report.markdownContent.includes("Synthetic responses");

      if (!markdownContainsNotice) {
        issues.push({
          code: "MISSING_SIMULATION_DISCLAIMER",
          severity: "error",
          message: "Report contains simulated customer research but does not include the mandatory simulation notice.",
        });
      }
    }

    // 3. Low confidence limitation requirement
    if (report.confidence === "low") {
      if (!report.limitations || report.limitations.length === 0) {
        issues.push({
          code: "MISSING_LOW_CONFIDENCE_LIMITATION",
          severity: "error",
          message: "Report overall confidence is 'low', but no explicit limitations are specified.",
        });
      }
    }

    // 4. Detect Contradictions between evidence items
    const contradictionCount = this.detectContradictions(report.evidence, report, issues);

    const hasErrors = issues.some((i) => i.severity === "error");
    const result: ProvenanceValidationResult = {
      isValid: !hasErrors,
      issues,
      verifiedFactCount,
      simulatedCount,
      contradictionCount,
    };

    if (hasErrors) {
      return fail(result);
    }
    return ok(result);
  }

  /**
   * Identifies unacknowledged contradictions between claims.
   * Contradictions that are recorded in report.disagreements are considered acknowledged.
   */
  private static detectContradictions(
    evidence: readonly ReportEvidenceItem[],
    report: Report,
    issues: ProvenanceValidationIssue[]
  ): number {
    let contradictions = 0;
    const acknowledgedTopics = new Set(
      report.disagreements.map((d) => d.topic.toLowerCase())
    );

    for (let i = 0; i < evidence.length; i++) {
      for (let j = i + 1; j < evidence.length; j++) {
        const itemA = evidence[i]!;
        const itemB = evidence[j]!;

        const conflict = this.isConflictingPair(itemA.claim, itemB.claim);
        if (conflict) {
          const isAcknowledged = Array.from(acknowledgedTopics).some(
            (topic) =>
              itemA.claim.toLowerCase().includes(topic) ||
              itemB.claim.toLowerCase().includes(topic)
          );

          if (!isAcknowledged) {
            contradictions++;
            issues.push({
              code: "UNACKNOWLEDGED_CONTRADICTION",
              severity: "warning",
              message: `Apparent contradiction between claim '${itemA.id}' ("${itemA.claim}") and claim '${itemB.id}' ("${itemB.claim}") is not preserved in report disagreements.`,
              evidenceId: itemA.id,
            });
          }
        }
      }
    }

    return contradictions;
  }

  /**
   * Heuristic conflict detector for obvious polar opposites or mutually exclusive statements.
   */
  private static isConflictingPair(claimA: string, claimB: string): boolean {
    const a = claimA.toLowerCase();
    const b = claimB.toLowerCase();

    // Directly opposing statements
    if (
      (a.includes("tests passed") && b.includes("tests failed")) ||
      (a.includes("tests failed") && b.includes("tests passed"))
    ) {
      return true;
    }

    if (
      (a.includes("is supported") && b.includes("is not supported")) ||
      (a.includes("is not supported") && b.includes("is supported"))
    ) {
      return true;
    }

    if (
      (a.includes("zero dependencies") && b.includes("requires external dependencies")) ||
      (a.includes("requires external dependencies") && b.includes("zero dependencies"))
    ) {
      return true;
    }

    if (
      (a.includes("feasible within budget") && b.includes("exceeds budget")) ||
      (a.includes("exceeds budget") && b.includes("feasible within budget"))
    ) {
      return true;
    }

    return false;
  }
}
