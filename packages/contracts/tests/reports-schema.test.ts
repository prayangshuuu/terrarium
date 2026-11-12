/**
 * @terrarium/contracts - tests/reports-schema.test.ts
 *
 * Domain contracts validation suite for enhanced reports, evidence, provenance,
 * disagreements, recommendations, and simulated customer research.
 * Aligns strictly with PLAN.md Section 8 & 15 and PROMPT 18.
 */

import { describe, it, expect } from "bun:test";
import {
  validateReport,
  validateReportFinding,
  validateReportEvidenceItem,
  validateReportSource,
  validateReportDisagreement,
  validateReportRecommendation,
  REPORT_TYPES,
  EVIDENCE_CLAIM_TYPES,
  CONFIDENCE_LEVELS,
  type Report,
  type ReportEvidenceItem,
  type ReportSource,
  type ReportDisagreement,
  type ReportRecommendation,
  type CustomerSimulationMetadata,
  SIMULATED_RESEARCH_DISCLAIMER,
} from "../src/index.ts";

describe("Enhanced Reports Schema & Epistemic Contracts (A1)", () => {
  const now = new Date().toISOString();

  it("validates a complete Prompt 18 compliant report with all 10 required sections", () => {
    const report: Report = {
      id: "rep_prompt18_full",
      taskId: "task_eval_100",
      title: "Core Architecture & Security Evaluation",
      reportType: "architecture_review",
      summary: "Comprehensive architectural assessment verifying least-privilege boundaries and test coverage.",
      objective: "Assess platform architectural isolation and identify operational risks before v1.0 RC.",
      method: "Multi-agent code inspection, static repository scan, and bounded test execution.",
      evidence: [
        {
          id: "ev_01",
          claim: "Repository scan identified zero circular dependencies across 4 packages.",
          claimType: "verified_fact",
          confidence: "high",
          isVerified: true,
          sourceId: "src_01",
          sourceRef: "packages/contracts/package.json",
          rationale: "Automated topological sort of internal dependency tree.",
        },
        {
          id: "ev_02",
          claim: "Proposed SQLite migration 007 applies non-destructively on existing databases.",
          claimType: "generated_analysis",
          confidence: "high",
          isVerified: false,
          sourceId: "src_02",
          sourceRef: "packages/core/src/persistence/migrations/007_enhanced_reports_and_evidence.ts",
          rationale: "ALTER TABLE statements use DEFAULT values preventing data corruption.",
        },
      ],
      sources: [
        {
          id: "src_01",
          title: "Package dependency manifests",
          sourceType: "repository_file",
          uri: "package.json",
          retrievedAt: now,
        },
        {
          id: "src_02",
          title: "Database Migration 007",
          sourceType: "repository_file",
          uri: "packages/core/src/persistence/migrations/007_enhanced_reports_and_evidence.ts",
          retrievedAt: now,
        },
      ],
      assumptions: [
        "SQLite is compiled with JSON1 extension enabled in runtime environment.",
        "File system access permits local directory creation in workspace root.",
      ],
      confidence: "high",
      confidenceRationale: "Direct verification via static inspection and integration test proofs.",
      limitations: [
        "Does not assess network throughput under high concurrency.",
      ],
      disagreements: [
        {
          id: "dis_01",
          topic: "Default Report Export Format",
          summary: "Debate over whether reports should default to Markdown or JSON.",
          resolutionStatus: "compromise",
          tradeOffImplication: "Markdown is standard for Git repos; JSON is available via flag.",
          perspectives: [
            {
              participantId: "agent_a4",
              participantName: "CLI Designer",
              isSimulatedPersona: false,
              stance: "Markdown by default for immediate human readability in repository.",
              rationale: "Engineers expect readable docs in docs/ or reports/ folders.",
            },
            {
              participantId: "agent_a3",
              participantName: "Reliability Engineer",
              isSimulatedPersona: false,
              stance: "JSON by default for automated pipeline ingestion.",
              rationale: "Easier schema verification in automated CI checks.",
            },
          ],
        },
      ],
      recommendations: [
        {
          id: "rec_01",
          priority: "P0",
          title: "Enforce Workspace Boundary on Report File Exports",
          description: "Ensure report export path cannot resolve outside workspace root.",
          rationale: "Prevent malicious path traversal through agent-generated export paths.",
          ownerRole: "Senior Security Engineer",
          nextActions: ["Add relative() check", "Verify against path traversal tests"],
        },
      ],
      hasSimulatedData: false,
      findings: [],
      markdownContent: "# Core Architecture & Security Evaluation\nAll checks passed.",
      agentsInvolved: ["A1_architect", "A3_security"],
      status: "final",
      createdAt: now,
      updatedAt: now,
    };

    const res = validateReport(report);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.id).toBe("rep_prompt18_full");
      expect(res.data.evidence.length).toBe(2);
      expect(res.data.sources.length).toBe(2);
      expect(res.data.disagreements.length).toBe(1);
      expect(res.data.recommendations.length).toBe(1);
      expect(res.data.hasSimulatedData).toBe(false);
    }
  });

  it("validates customer simulation report with simulation metadata and synthetic flags", () => {
    const simMetadata: CustomerSimulationMetadata = {
      personas: [
        {
          id: "persona_ent",
          name: "Sarah Jenkins",
          archetype: "Enterprise IT Director",
          background: "Enterprise IT buyer",
          primaryGoals: ["Security", "Compliance"],
          constraints: ["SOC2 compliance"],
          knownBiases: ["Risk-averse"],
        },
      ],
      scenario: "Evaluation of multi-agent coding orchestra",
      assumptions: ["Synthetic evaluation based on defined constraints"],
      samplingRationale: "Assess enterprise security vetting criteria",
      disclaimer: SIMULATED_RESEARCH_DISCLAIMER,
      simulatedFeedback: [
        {
          id: "fb_01",
          personaId: "persona_ent",
          personaName: "Sarah Jenkins",
          scenario: "Evaluation of multi-agent coding orchestra",
          sentiment: "skeptical",
          reaction: "Requires strict human approval gates and least-privilege sandbox.",
          objections: ["Risk of uncontrolled code modification"],
          featureRequests: ["RBAC approval gates"],
          adoptionBarriers: ["Security audit clearance"],
        },
      ],
    };

    const report: Report = {
      id: "rep_sim_01",
      taskId: "task_sim_01",
      title: "Simulated Customer Research: Multi-Agent Orchestra",
      reportType: "customer_simulation",
      summary: "Synthetic exploration across enterprise persona.",
      objective: "Evaluate enterprise readiness and objections.",
      method: "Simulated persona feedback under constraint modeling.",
      evidence: [
        {
          id: "ev_sim_01",
          claim: "[Enterprise IT Director]: Requires strict human approval gates and least-privilege sandbox.",
          claimType: "simulated_feedback",
          confidence: "medium",
          isVerified: false,
          simulatedPersonaId: "persona_ent",
          rationale: "Constraint: SOC2 compliance",
        },
      ],
      sources: [
        {
          id: "src_persona_ent",
          title: "Sarah Jenkins (Enterprise IT Director)",
          sourceType: "simulated_persona",
          isSimulatedPersona: true,
          retrievedAt: now,
        },
      ],
      assumptions: ["Synthetic exploration"],
      confidence: "medium",
      limitations: ["Not real customer research; requires empirical interview validation"],
      disagreements: [],
      recommendations: [],
      hasSimulatedData: true,
      simulationMetadata: simMetadata,
      findings: [],
      markdownContent: `# Simulated Customer Research\n\n> [!WARNING]\n> ${SIMULATED_RESEARCH_DISCLAIMER}`,
      agentsInvolved: ["CustomerIntelligenceAgent"],
      status: "final",
      createdAt: now,
      updatedAt: now,
    };

    const res = validateReport(report);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.hasSimulatedData).toBe(true);
      expect(res.data.evidence[0]!.claimType).toBe("simulated_feedback");
      expect(res.data.sources[0]!.isSimulatedPersona).toBe(true);
    }
  });

  it("rejects evidence item with invalid claimType or negative verification on verified_fact", () => {
    const invalidEvidence = {
      id: "ev_bad",
      claim: "Some claim",
      claimType: "unrecognized_status" as any,
      confidence: "high" as const,
      isVerified: true,
    };

    const res = validateReportEvidenceItem(invalidEvidence);
    expect(res.success).toBe(false);
  });

  it("validates report disagreements with multi-perspective stances", () => {
    const disagreement: ReportDisagreement = {
      id: "dis_testing",
      topic: "Automated Rollback on Test Failure",
      summary: "Whether failed tests should automatically revert working tree or prompt user.",
      resolutionStatus: "compromise",
      tradeOffImplication: "Auto-revert in headless batch mode; prompt with diff in interactive TUI.",
      perspectives: [
        {
          participantId: "agent_qa",
          participantName: "QA Specialist",
          isSimulatedPersona: false,
          stance: "Automatic instant rollback prevents contaminated working tree.",
          rationale: "Prevents flaky tests from propagating.",
        },
        {
          participantId: "agent_dev",
          participantName: "Core Developer",
          isSimulatedPersona: false,
          stance: "Prompt user to allow manual inspection of failure before rollback.",
          rationale: "User may want to diagnose the test failure directly.",
        },
      ],
    };

    const res = validateReportDisagreement(disagreement);
    expect(res.success).toBe(true);
  });

  it("validates prioritized recommendations with action checklists", () => {
    const rec: ReportRecommendation = {
      id: "rec_p0_security",
      priority: "P0",
      title: "Block Destructive Shell Commands",
      description: "Intercept 'rm -rf /' and 'mkfs' in bounded test runner.",
      rationale: "Sandbox safety and host preservation.",
      ownerRole: "Security Lead",
      nextActions: ["Add command regex validation", "Test with malicious payload"],
      dependencies: ["dep_security_sandbox"],
    };

    const res = validateReportRecommendation(rec);
    expect(res.success).toBe(true);
  });
});
