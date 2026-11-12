/**
 * apps/cli/tests/reports-view.test.tsx
 *
 * Comprehensive UI test suite for Workspace 8: Reports & Evidence.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import { describe, expect, test } from "bun:test";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import {
  type Report,
  type ReportEvidenceItem,
  type ReportSource,
  type ReportDisagreement,
  type ReportRecommendation,
  SIMULATED_RESEARCH_DISCLAIMER,
} from "@terrarium/contracts";
import { UiStateController } from "../src/ui/state/ui-state-controller.js";
import { TerrariumUiProvider } from "../src/ui/state/ui-context.js";
import { ReportsView } from "../src/ui/views/ReportsView.js";

function createMockReport(overrides?: Partial<Report>): Report {
  const now = new Date().toISOString();
  return {
    id: "rep_mock_001",
    taskId: "task_mock_100",
    title: "Platform Security & Architecture Audit",
    reportType: "architecture_review",
    summary: "Comprehensive architectural review verifying least-privilege boundary compliance.",
    objective: "Verify least-privilege boundary compliance across all repository workspaces.",
    method: "Static code inspection, bounded test execution, and permission policy verification.",
    evidence: [
      {
        id: "ev_01",
        claim: "All 57 test files pass with 0 regressions.",
        claimType: "verified_fact",
        confidence: "high",
        isVerified: true,
        sourceId: "src_test_run",
        rationale: "Zero failures in bounded test runner execution.",
      },
      {
        id: "ev_02",
        claim: "Read-only file access protects .env secrets from unauthorized writes.",
        claimType: "verified_fact",
        confidence: "high",
        isVerified: true,
        sourceId: "src_sec_shield",
        rationale: "Regex shield prevents path traversal and credential reads.",
      },
    ],
    sources: [
      {
        id: "src_test_run",
        title: "Bounded Test Runner Log",
        sourceType: "tool_output",
        retrievedAt: now,
      },
      {
        id: "src_sec_shield",
        title: "CodeSecuritySandbox Policy",
        sourceType: "repository_file",
        uri: "packages/core/src/studio/code-security-sandbox.ts",
        retrievedAt: now,
      },
    ],
    assumptions: ["Standard execution environment"],
    confidence: "high",
    confidenceRationale: "Empirical verification via test runner",
    limitations: ["Bounded to local repository workspace"],
    disagreements: [
      {
        id: "dis_01",
        topic: "Auto-Rollback on Test Failure",
        summary: "Debate between instant auto-rollback vs user prompt on test failure.",
        resolutionStatus: "compromise",
        tradeOffImplication: "Auto-rollback in headless mode; interactive confirmation in TUI.",
        perspectives: [
          {
            participantId: "agent_qa",
            participantName: "QA Specialist",
            isSimulatedPersona: false,
            stance: "Instant rollback",
            rationale: "Prevents dirty working tree",
          },
        ],
      },
    ],
    recommendations: [
      {
        id: "rec_01",
        priority: "P0",
        title: "Enforce Workspace Boundary on File Exports",
        description: "Validate export paths against path traversal.",
        rationale: "Prevent malicious file overwrite outside repository.",
        ownerRole: "Security Lead",
        nextActions: ["Add relative path check"],
      },
    ],
    hasSimulatedData: false,
    findings: [],
    markdownContent: "# Platform Security & Architecture Audit\nAll checks passed.",
    agentsInvolved: ["A1_architect", "A3_security"],
    status: "final",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockSimulatedReport(): Report {
  const base = createMockReport();
  return {
    ...base,
    id: "rep_sim_mock_002",
    title: "Simulated Customer Research: Multi-Agent CLI",
    reportType: "customer_simulation",
    summary: "Synthetic customer persona exploration across 4 archetypes.",
    hasSimulatedData: true,
    evidence: [
      {
        id: "ev_sim_01",
        claim: "[Enterprise IT Director]: Demands strict SOC2 compliance and mandatory human approval gates.",
        claimType: "simulated_feedback",
        confidence: "medium",
        isVerified: false,
        simulatedPersonaId: "persona_ent",
        rationale: "Enterprise procurement constraints",
      },
    ],
    markdownContent: `# Customer Simulation\n\n> [!WARNING]\n> ${SIMULATED_RESEARCH_DISCLAIMER}`,
  };
}

describe("Reports & Evidence OpenTUI View Suite (A4 & A5)", () => {
  test("renders clean empty state when zero reports exist", async () => {
    const controller = new UiStateController({
      initialWorkspace: "reports",
      initialReports: [],
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ReportsView />
      </TerrariumUiProvider>,
      { width: 110, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Reports & Evidence");
    expect(frame).toContain("No reports generated yet");
    expect(frame).toContain("Press [s] to run Customer");
    await setup.dispose();
  });

  test("renders populated reports catalog with confidence and type badges", async () => {
    const report = createMockReport();
    const simReport = createMockSimulatedReport();

    const controller = new UiStateController({
      initialWorkspace: "reports",
      initialReports: [report, simReport],
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ReportsView />
      </TerrariumUiProvider>,
      { width: 110, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Reports & Evidence");
    expect(frame).toContain("2 Reports");
    expect(frame).toContain("Platform Security");
    expect(frame).toContain("[HIGH]");
    expect(frame).toContain("[SIMULATED]");
    await setup.dispose();
  });

  test("renders overview tab with objective, executive summary, and methodology", async () => {
    const report = createMockReport();
    const controller = new UiStateController({
      initialWorkspace: "reports",
      initialReports: [report],
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ReportsView />
      </TerrariumUiProvider>,
      { width: 110, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("OBJECTIVE");
    expect(frame).toContain("least-privilege boundary");
    expect(frame).toContain("EXECUTIVE SUMMARY");
    expect(frame).toContain("Comprehensive architectural");
    expect(frame).toContain("METHODOLOGY & PROVENANCE");
    await setup.dispose();
  });

  test("renders evidence tab with epistemic classification badges", async () => {
    const report = createMockReport();
    const controller = new UiStateController({
      initialWorkspace: "reports",
      initialReports: [report],
    });
    controller.setReportsActiveTab("evidence");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ReportsView />
      </TerrariumUiProvider>,
      { width: 110, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("EVIDENCE MATRIX");
    expect(frame).toContain("[VERIFIED FACT]");
    expect(frame).toContain("All 57 test files pass");
    await setup.dispose();
  });

  test("renders preserved disagreements tab with trade-off implications", async () => {
    const report = createMockReport();
    const controller = new UiStateController({
      initialWorkspace: "reports",
      initialReports: [report],
    });
    controller.setReportsActiveTab("disagreements");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ReportsView />
      </TerrariumUiProvider>,
      { width: 110, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("PRESERVED DISAGREEMENTS");
    expect(frame).toContain("Auto-Rollback on Test Failure");
    expect(frame).toContain("Trade-off:");
    await setup.dispose();
  });

  test("renders prioritized recommendations tab with priority badges", async () => {
    const report = createMockReport();
    const controller = new UiStateController({
      initialWorkspace: "reports",
      initialReports: [report],
    });
    controller.setReportsActiveTab("recommendations");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ReportsView />
      </TerrariumUiProvider>,
      { width: 110, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("PRIORITIZED RECOMMENDATIONS");
    expect(frame).toContain("[P0]");
    expect(frame).toContain("Enforce Workspace Boundary on File Exports");
    await setup.dispose();
  });

  test("displays prominent simulation notice warning box when viewing simulated customer research", async () => {
    const simReport = createMockSimulatedReport();
    const controller = new UiStateController({
      initialWorkspace: "reports",
      initialReports: [simReport],
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ReportsView />
      </TerrariumUiProvider>,
      { width: 110, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("SIMULATION NOTICE — SYNTHETIC CUSTOMER RESEARCH");
    expect(frame).toContain("This report contains synthetic responses");
    await setup.dispose();
  });
});
