/**
 * @terrarium/core - tests/reports-provenance.test.ts
 *
 * Verifies provenance validation rules, missing sources detection, contradiction detection,
 * low-confidence limitations enforcement, and simulation disclaimer integrity.
 * Strictly tests Prompt 18 requirements:
 * "Test missing sources, contradictions, low confidence, and simulation labels."
 */

import { describe, it, expect } from "bun:test";
import {
  type Report,
  type ReportEvidenceItem,
  type ReportSource,
  SIMULATED_RESEARCH_DISCLAIMER,
} from "@terrarium/contracts";
import { ProvenanceValidator } from "../src/reports/provenance-validator.ts";
import { ReportSanitizer } from "../src/reports/report-sanitizer.ts";

describe("Report Provenance, Integrity, and Simulation Validation Suite (A3)", () => {
  const now = new Date().toISOString();

  function createValidBaseReport(): Report {
    const source: ReportSource = {
      id: "src_valid_01",
      title: "Test Execution Logs",
      sourceType: "tool_output",
      retrievedAt: now,
    };

    const evidence: ReportEvidenceItem = {
      id: "ev_valid_01",
      claim: "Integration tests passed with 100% success rate.",
      claimType: "verified_fact",
      confidence: "high",
      isVerified: true,
      sourceId: "src_valid_01",
      rationale: "Zero test failures reported by test runner.",
    };

    return {
      id: "rep_prov_base",
      taskId: "task_prov_100",
      title: "Provenance Test Report",
      reportType: "test_strategy",
      summary: "Baseline valid report for provenance assertions.",
      objective: "Verify provenance rules.",
      method: "Automated test verification.",
      evidence: [evidence],
      sources: [source],
      assumptions: ["Test environment is isolated"],
      confidence: "high",
      limitations: ["Bounded to unit and integration test scope"],
      disagreements: [],
      recommendations: [],
      hasSimulatedData: false,
      findings: [],
      markdownContent: "# Baseline Report\nAll tests passed cleanly.",
      agentsInvolved: ["TestAgent"],
      status: "final",
      createdAt: now,
      updatedAt: now,
    };
  }

  describe("Missing Sources and Unregistered Sources", () => {
    it("flags error when verified_fact evidence item lacks sourceId and sourceRef", () => {
      const report = createValidBaseReport();
      const unsourcedItem: ReportEvidenceItem = {
        id: "ev_no_source",
        claim: "All database queries use indexed lookups.",
        claimType: "verified_fact",
        confidence: "high",
        isVerified: true,
        // Missing sourceId and sourceRef!
      };

      const invalidReport: Report = {
        ...report,
        evidence: [...report.evidence, unsourcedItem],
      };

      const res = ProvenanceValidator.validate(invalidReport);
      expect(res.success).toBe(false);
      if (!res.success) {
        const missingSourceIssue = res.error.issues.find(
          (i) => i.code === "MISSING_SOURCE" && i.evidenceId === "ev_no_source"
        );
        expect(missingSourceIssue).toBeDefined();
        expect(missingSourceIssue?.severity).toBe("error");
      }
    });

    it("flags error when evidence references a sourceId that does not exist in sources", () => {
      const report = createValidBaseReport();
      const ghostSourceItem: ReportEvidenceItem = {
        id: "ev_ghost_source",
        claim: "Code patch achieved 95% line coverage.",
        claimType: "verified_fact",
        confidence: "high",
        isVerified: true,
        sourceId: "src_non_existent_ghost",
      };

      const invalidReport: Report = {
        ...report,
        evidence: [...report.evidence, ghostSourceItem],
      };

      const res = ProvenanceValidator.validate(invalidReport);
      expect(res.success).toBe(false);
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.code === "UNREGISTERED_SOURCE");
        expect(issue).toBeDefined();
        expect(issue?.sourceId).toBe("src_non_existent_ghost");
      }
    });
  });

  describe("Contradiction Detection", () => {
    it("detects unacknowledged contradictions between opposing evidence claims", () => {
      const report = createValidBaseReport();
      const contradictoryItem: ReportEvidenceItem = {
        id: "ev_contradicting",
        claim: "Integration tests failed due to timeout.",
        claimType: "verified_fact",
        confidence: "high",
        isVerified: true,
        sourceId: "src_valid_01",
      };

      // Base report has: "Integration tests passed with 100% success rate."
      // This new item states: "Integration tests failed due to timeout."
      const conflictingReport: Report = {
        ...report,
        evidence: [...report.evidence, contradictoryItem],
        disagreements: [], // Not acknowledged in disagreements!
      };

      const res = ProvenanceValidator.validate(conflictingReport);
      // Contradictions produce warnings
      const issues = res.success ? res.data.issues : res.error.issues;
      const contradictionIssue = issues.find((i) => i.code === "UNACKNOWLEDGED_CONTRADICTION");
      expect(contradictionIssue).toBeDefined();
    });

    it("accepts opposing claims when contradiction is explicitly acknowledged in disagreements", () => {
      const report = createValidBaseReport();
      const conflictingItem: ReportEvidenceItem = {
        id: "ev_competing_02",
        claim: "Integration tests failed on macos-arm64 architecture.",
        claimType: "verified_fact",
        confidence: "high",
        isVerified: true,
        sourceId: "src_valid_01",
      };

      const acknowledgedReport: Report = {
        ...report,
        evidence: [...report.evidence, conflictingItem],
        disagreements: [
          {
            id: "dis_platform_flake",
            topic: "Platform-Specific Tests Passed vs Failed",
            summary: "Tests passed on Linux but failed on macOS ARM64.",
            resolutionStatus: "unresolved",
            perspectives: [
              {
                participantId: "agent_linux",
                participantName: "Linux CI Agent",
                isSimulatedPersona: false,
                stance: "Tests passed in container",
                rationale: "Clean environment",
              },
            ],
          },
        ],
      };

      const res = ProvenanceValidator.validate(acknowledgedReport);
      expect(res.success).toBe(true);
    });
  });

  describe("Low Confidence and Limitations Enforcement", () => {
    it("flags error when report confidence is 'low' but limitations list is empty", () => {
      const report = createValidBaseReport();
      const lowConfidenceReport: Report = {
        ...report,
        confidence: "low",
        limitations: [], // Missing mandatory limitations!
      };

      const res = ProvenanceValidator.validate(lowConfidenceReport);
      expect(res.success).toBe(false);
      if (!res.success) {
        const issue = res.error.issues.find(
          (i) => i.code === "MISSING_LOW_CONFIDENCE_LIMITATION"
        );
        expect(issue).toBeDefined();
        expect(issue?.severity).toBe("error");
      }
    });

    it("passes when low confidence report includes explicit limitations", () => {
      const report = createValidBaseReport();
      const lowConfidenceReport: Report = {
        ...report,
        confidence: "low",
        limitations: [
          "Static analysis was unable to parse proprietary binary dependencies.",
          "High hallucination risk due to limited training context.",
        ],
      };

      const res = ProvenanceValidator.validate(lowConfidenceReport);
      expect(res.success).toBe(true);
    });
  });

  describe("Simulation Labels and Disclaimer Verification", () => {
    it("flags error when simulated feedback is marked as verified_fact", () => {
      const report = createValidBaseReport();
      const fakeVerifiedItem: ReportEvidenceItem = {
        id: "ev_fake_fact",
        claim: "[Enterprise Buyer]: 80% of companies will buy this tool.",
        claimType: "simulated_feedback",
        confidence: "high",
        isVerified: true, // ILLEGAL: simulated feedback cannot be marked verified!
        simulatedPersonaId: "persona_ent",
      };

      const invalidReport: Report = {
        ...report,
        evidence: [fakeVerifiedItem],
        hasSimulatedData: true,
        markdownContent: `# Test\n${SIMULATED_RESEARCH_DISCLAIMER}`,
      };

      const res = ProvenanceValidator.validate(invalidReport);
      expect(res.success).toBe(false);
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.code === "SIMULATION_MISLABELED");
        expect(issue).toBeDefined();
      }
    });

    it("flags error when simulated research report is missing the mandatory simulation notice", () => {
      const report = createValidBaseReport();
      const simItem: ReportEvidenceItem = {
        id: "ev_sim_valid",
        claim: "[Indie Hacker]: Desires free local CLI tier.",
        claimType: "simulated_feedback",
        confidence: "medium",
        isVerified: false,
        simulatedPersonaId: "persona_indie",
      };

      const missingNoticeReport: Report = {
        ...report,
        evidence: [simItem],
        hasSimulatedData: true,
        markdownContent: "# Unlabeled Report\nUser said they like the tool.", // No disclaimer!
      };

      const res = ProvenanceValidator.validate(missingNoticeReport);
      expect(res.success).toBe(false);
      if (!res.success) {
        const issue = res.error.issues.find(
          (i) => i.code === "MISSING_SIMULATION_DISCLAIMER"
        );
        expect(issue).toBeDefined();
      }
    });

    it("passes cleanly when simulated report has all proper labels and disclaimer", () => {
      const report = createValidBaseReport();
      const simItem: ReportEvidenceItem = {
        id: "ev_sim_proper",
        claim: "[Solo Developer]: High price sensitivity regarding token usage.",
        claimType: "simulated_feedback",
        confidence: "medium",
        isVerified: false,
        simulatedPersonaId: "persona_indie_dev",
      };

      const properSimReport: Report = {
        ...report,
        evidence: [simItem],
        hasSimulatedData: true,
        markdownContent: `# Customer Simulation\n\n> [!WARNING]\n> ${SIMULATED_RESEARCH_DISCLAIMER}\nSynthetic responses.`,
      };

      const res = ProvenanceValidator.validate(properSimReport);
      expect(res.success).toBe(true);
    });
  });

  describe("ReportSanitizer Privacy & Secret Redaction", () => {
    it("redacts API keys, tokens, and private keys from report text", () => {
      const sensitiveText = `
        Connecting with OpenAI key: sk-proj-1234567890abcdef1234567890abcdef
        Anthropic key: sk-ant-api03-abcdef1234567890abcdef1234567890
        GitHub token: ghp_1234567890abcdef1234567890abcdef1234
        AWS key: AKIAIOSFODNN7EXAMPLE
        Authorization: Bearer mySecretTokenValue1234567890
      `;

      const result = ReportSanitizer.sanitize(sensitiveText);
      expect(result.redactionCount).toBeGreaterThanOrEqual(5);
      expect(result.sanitizedText.includes("sk-proj-")).toBe(false);
      expect(result.sanitizedText.includes("ghp_12345")).toBe(false);
      expect(result.sanitizedText.includes("AKIAIOSFODNN7EXAMPLE")).toBe(false);
      expect(result.sanitizedText.includes("[REDACTED_")).toBe(true);
    });

    it("strips hidden chain-of-thought blocks completely", () => {
      const textWithCoT = `
        ## Executive Summary
        <thinking>
        Internal agent monologue: User might be upset if we don't mention latency.
        Let's calculate token probability. Hidden CoT steps here.
        </thinking>
        System latency is verified at 42ms p95.
        <scratchpad>
        Temporary scratchpad calculation
        </scratchpad>
        Conclusion reached.
      `;

      const result = ReportSanitizer.sanitize(textWithCoT);
      expect(result.strippedCotCount).toBe(2);
      expect(result.sanitizedText.includes("<thinking>")).toBe(false);
      expect(result.sanitizedText.includes("Internal agent monologue")).toBe(false);
      expect(result.sanitizedText.includes("<scratchpad>")).toBe(false);
      expect(result.sanitizedText.includes("System latency is verified at 42ms p95.")).toBe(true);
      expect(result.sanitizedText.includes("Conclusion reached.")).toBe(true);
    });
  });
});
