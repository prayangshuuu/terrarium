/**
 * apps/cli/src/ui/views/ReportsView.tsx
 *
 * Workspace 8: Reports, Evidence & Simulated Customer Research.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer),
 * with provenance integrity and epistemic classification validated by A1, A2 & A3.
 *
 * Aligns strictly with PLAN.md Section 8 (Customer Simulation) & Section 15 (Reports & Deliverables),
 * and PROMPT 18 requirements:
 * - 10 required schema sections: objective, summary, method, evidence, sources, assumptions,
 *   confidence, limitations, disagreements, recommendations.
 * - Epistemic classification distinguishing verified facts, generated analysis, assumptions,
 *   hypotheses, and simulated persona feedback.
 * - Prominent synthetic disclaimer box for simulated research reports.
 * - Support preview, export, retrieval, and customer simulation actions.
 */

import React, { useCallback } from "react";
import { TextAttributes, type KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import {
  type Report,
  type ReportType,
  type ReportEvidenceItem,
  type EvidenceClaimType,
  SIMULATED_RESEARCH_DISCLAIMER,
} from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { useTerrariumUi } from "../state/ui-context.js";
import type { ReportsActiveTab } from "../state/ui-state-types.js";

export function ReportsView() {
  const { state, controller } = useTerrariumUi();
  const activeTab: ReportsActiveTab = state.reportsActiveTab ?? "overview";
  const reports = state.reports;
  const selectedIndex = state.selectedReportIndex;
  const selectedReport: Report | null = state.selectedReport ?? reports[selectedIndex] ?? null;

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (state.isCommandPaletteOpen || state.isHelpModalOpen) return;

      const keyName = event.name.toLowerCase();

      // Tab switching shortcuts [1-5]
      if (keyName === "1") {
        controller.setReportsActiveTab("overview");
        return;
      }
      if (keyName === "2") {
        controller.setReportsActiveTab("evidence");
        return;
      }
      if (keyName === "3") {
        controller.setReportsActiveTab("disagreements");
        return;
      }
      if (keyName === "4") {
        controller.setReportsActiveTab("recommendations");
        return;
      }
      if (keyName === "5") {
        controller.setReportsActiveTab("preview");
        return;
      }

      // Vertical navigation across reports list
      if (keyName === "up") {
        const nextIdx = Math.max(0, selectedIndex - 1);
        controller.selectReport(nextIdx);
        return;
      }
      if (keyName === "down") {
        const nextIdx = Math.min(reports.length - 1, selectedIndex + 1);
        controller.selectReport(nextIdx);
        return;
      }

      // Action shortcuts: [e] Export, [s] Simulate customer, [g] Generate report
      if (keyName === "e") {
        if (selectedReport) {
          void controller.exportReport(selectedReport.id);
        }
        return;
      }
      if (keyName === "s") {
        void controller.simulateCustomerResearch({
          concept: "Terrarium Multi-Agent Developer Workstation",
          scenario: "Fullstack engineering productivity evaluation",
        });
        return;
      }
    },
    [state.isCommandPaletteOpen, state.isHelpModalOpen, selectedIndex, reports.length, selectedReport, controller]
  );

  useKeyboard(handleKeyboard);

  const verifiedFactsCount = reports.reduce(
    (acc, r) => acc + r.evidence.filter((e) => e.claimType === "verified_fact").length,
    0
  );
  const simulatedCount = reports.filter((r) => r.hasSimulatedData).length;

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={THEME_COLORS.bgApp}>
      {/* 1. Header Toolbar */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        paddingX={2}
        paddingY={1}
        border={["bottom"]}
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        backgroundColor={THEME_COLORS.bgHeader}
      >
        <box flexDirection="row" alignItems="center" flexShrink={0}>
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            📊 Reports & Evidence
          </text>
          <text fg={THEME_COLORS.fgMuted}>
            {" "}({reports.length} Reports)
          </text>
        </box>

        {/* Tab Selector */}
        <box flexDirection="row" alignItems="center">
          {(["overview", "evidence", "disagreements", "recommendations", "preview"] as const).map(
            (tab, idx) => {
              const isActive = activeTab === tab;
              const labels = ["1: Overview", "2: Evidence", "3: Debates", "4: Recs", "5: Markdown"];
              return (
                <box
                  key={tab}
                  paddingX={1}
                  backgroundColor={isActive ? THEME_COLORS.statusInfo : undefined}
                >
                  <text
                    fg={isActive ? THEME_COLORS.fgInverse : THEME_COLORS.fgSecondary}
                    attributes={isActive ? TextAttributes.BOLD : undefined}
                  >
                    [{labels[idx]}]
                  </text>
                </box>
              );
            }
          )}
        </box>
      </box>

      {/* 2. Main Body: Split Master-Detail */}
      <box flexDirection="row" flexGrow={1} width="100%">
        {/* Left Pane: Reports Master List */}
        <box
          flexDirection="column"
          width="35%"
          border={["right"]}
          borderStyle="single"
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgSidebar}
          paddingX={1}
          paddingY={1}
        >
          <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
            <text fg={THEME_COLORS.fgSecondary} attributes={TextAttributes.BOLD}>
              REPORTS CATALOG
            </text>
            <text fg={THEME_COLORS.fgMuted}>[↑/↓ Select]</text>
          </box>

          {reports.length === 0 ? (
            <box
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              paddingY={3}
            >
              <text fg={THEME_COLORS.fgMuted}>No reports generated yet.</text>
              <text fg={THEME_COLORS.fgMuted}>Press [s] to run Customer Simulation</text>
            </box>
          ) : (
            <box flexDirection="column">
              {reports.map((rep, idx) => {
                const isSelected = idx === selectedIndex;
                const confColor =
                  rep.confidence === "high"
                    ? THEME_COLORS.statusSuccess
                    : rep.confidence === "medium"
                    ? THEME_COLORS.statusWarning
                    : THEME_COLORS.statusAccent;

                return (
                  <box
                    key={rep.id}
                    flexDirection="column"
                    paddingX={1}
                    paddingY={1}
                    marginBottom={1}
                    backgroundColor={isSelected ? THEME_COLORS.bgActive : THEME_COLORS.bgCard}
                    border={true}
                    borderColor={isSelected ? THEME_COLORS.statusInfo : THEME_COLORS.borderSubtle}
                  >
                    <box flexDirection="row" justifyContent="space-between" alignItems="center">
                      <text
                        fg={isSelected ? THEME_COLORS.fgPrimary : THEME_COLORS.fgSecondary}
                        attributes={isSelected ? TextAttributes.BOLD : undefined}
                      >
                        {isSelected ? "▶ " : "  "}
                        {rep.title.slice(0, 24)}
                      </text>
                      <text fg={confColor} attributes={TextAttributes.BOLD}>
                        [{rep.confidence.toUpperCase()}]
                      </text>
                    </box>

                    <box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={1}>
                      <text fg={THEME_COLORS.fgMuted}>
                        {rep.reportType}
                      </text>
                      {rep.hasSimulatedData && (
                        <text fg={THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD}>
                          [SIMULATED]
                        </text>
                      )}
                    </box>
                  </box>
                );
              })}
            </box>
          )}
        </box>

        {/* Right Pane: Selected Report Detail */}
        <box flexDirection="column" width="65%" paddingX={2} paddingY={1} flexGrow={1}>
          {!selectedReport ? (
            <box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
              <text fg={THEME_COLORS.fgMuted}>Select a report on the left or press [s] for simulation.</text>
            </box>
          ) : (
            <box flexDirection="column" flexGrow={1}>
              {/* Report Header Title */}
              <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
                <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
                  {selectedReport.title}
                </text>
                <text fg={THEME_COLORS.fgMuted}>
                  Task: {selectedReport.taskId} | Status: {selectedReport.status}
                </text>
              </box>

              {/* Mandatory Simulation Integrity Warning Banner */}
              {selectedReport.hasSimulatedData && (
                <box
                  flexDirection="column"
                  border={true}
                  borderColor={THEME_COLORS.statusWarning}
                  backgroundColor={THEME_COLORS.bgCard}
                  paddingX={2}
                  paddingY={1}
                  marginBottom={1}
                >
                  <text fg={THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD}>
                    ⚠️ SIMULATION NOTICE — SYNTHETIC CUSTOMER RESEARCH
                  </text>
                  <text fg={THEME_COLORS.fgSecondary}>
                    {SIMULATED_RESEARCH_DISCLAIMER}
                  </text>
                </box>
              )}

              {/* Dynamic Tab Content */}
              {activeTab === "overview" && (
                <box flexDirection="column">
                  {/* Objective Card */}
                  <box
                    flexDirection="column"
                    border={true}
                    borderColor={THEME_COLORS.borderSubtle}
                    backgroundColor={THEME_COLORS.bgCard}
                    paddingX={2}
                    paddingY={1}
                    marginBottom={1}
                  >
                    <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>OBJECTIVE</text>
                    <text fg={THEME_COLORS.fgPrimary}>{selectedReport.objective}</text>
                  </box>

                  {/* Summary Card */}
                  <box
                    flexDirection="column"
                    border={true}
                    borderColor={THEME_COLORS.borderSubtle}
                    backgroundColor={THEME_COLORS.bgCard}
                    paddingX={2}
                    paddingY={1}
                    marginBottom={1}
                  >
                    <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>EXECUTIVE SUMMARY</text>
                    <text fg={THEME_COLORS.fgPrimary}>{selectedReport.summary}</text>
                  </box>

                  {/* Methodology & Metadata Grid */}
                  <box
                    flexDirection="column"
                    border={true}
                    borderColor={THEME_COLORS.borderSubtle}
                    backgroundColor={THEME_COLORS.bgCard}
                    paddingX={2}
                    paddingY={1}
                  >
                    <text fg={THEME_COLORS.fgSecondary} attributes={TextAttributes.BOLD}>
                      METHODOLOGY & PROVENANCE
                    </text>
                    <text fg={THEME_COLORS.fgPrimary}>{selectedReport.method}</text>
                    <text fg={THEME_COLORS.fgMuted} marginTop={1}>
                      Evidence: {selectedReport.evidence.length} claims | Sources: {selectedReport.sources.length} | Disagreements: {selectedReport.disagreements.length} | Recommendations: {selectedReport.recommendations.length}
                    </text>
                  </box>
                </box>
              )}

              {activeTab === "evidence" && (
                <box flexDirection="column">
                  <text fg={THEME_COLORS.fgSecondary} attributes={TextAttributes.BOLD} marginBottom={1}>
                    EVIDENCE MATRIX ({selectedReport.evidence.length} Claims)
                  </text>

                  {selectedReport.evidence.length === 0 ? (
                    <text fg={THEME_COLORS.fgMuted}>No structured evidence recorded.</text>
                  ) : (
                    selectedReport.evidence.slice(0, 8).map((ev) => {
                      const tagColor =
                        ev.claimType === "verified_fact"
                          ? THEME_COLORS.statusSuccess
                          : ev.claimType === "simulated_feedback"
                          ? THEME_COLORS.statusWarning
                          : ev.claimType === "hypothesis"
                          ? THEME_COLORS.statusAccent
                          : THEME_COLORS.statusInfo;

                      const tagLabel =
                        ev.claimType === "verified_fact"
                          ? "[VERIFIED FACT]"
                          : ev.claimType === "simulated_feedback"
                          ? "[SIMULATED]"
                          : ev.claimType === "hypothesis"
                          ? "[HYPOTHESIS]"
                          : "[ANALYSIS]";

                      return (
                        <box
                          key={ev.id}
                          flexDirection="column"
                          border={true}
                          borderColor={THEME_COLORS.borderSubtle}
                          backgroundColor={THEME_COLORS.bgCard}
                          paddingX={1}
                          paddingY={1}
                          marginBottom={1}
                        >
                          <box flexDirection="row" alignItems="center">
                            <text fg={tagColor} attributes={TextAttributes.BOLD}>
                              {tagLabel}{" "}
                            </text>
                            <text fg={THEME_COLORS.fgPrimary}>{ev.claim}</text>
                          </box>
                          {ev.rationale && (
                            <text fg={THEME_COLORS.fgMuted} marginTop={1}>
                              Rationale: {ev.rationale}
                            </text>
                          )}
                        </box>
                      );
                    })
                  )}
                </box>
              )}

              {activeTab === "disagreements" && (
                <box flexDirection="column">
                  <text fg={THEME_COLORS.fgSecondary} attributes={TextAttributes.BOLD} marginBottom={1}>
                    PRESERVED DISAGREEMENTS ({selectedReport.disagreements.length})
                  </text>

                  {selectedReport.disagreements.length === 0 ? (
                    <text fg={THEME_COLORS.fgMuted}>No architectural disagreements recorded.</text>
                  ) : (
                    selectedReport.disagreements.map((dis) => (
                      <box
                        key={dis.id}
                        flexDirection="column"
                        border={true}
                        borderColor={THEME_COLORS.statusWarning}
                        backgroundColor={THEME_COLORS.bgCard}
                        paddingX={2}
                        paddingY={1}
                        marginBottom={1}
                      >
                        <box flexDirection="row" justifyContent="space-between">
                          <text fg={THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD}>
                            ⚠️ {dis.topic}
                          </text>
                          <text fg={THEME_COLORS.fgMuted}>[{dis.resolutionStatus.toUpperCase()}]</text>
                        </box>
                        <text fg={THEME_COLORS.fgPrimary} marginTop={1}>
                          {dis.summary}
                        </text>
                        {dis.tradeOffImplication && (
                          <text fg={THEME_COLORS.statusInfo} marginTop={1}>
                            Trade-off: {dis.tradeOffImplication}
                          </text>
                        )}
                      </box>
                    ))
                  )}
                </box>
              )}

              {activeTab === "recommendations" && (
                <box flexDirection="column">
                  <text fg={THEME_COLORS.fgSecondary} attributes={TextAttributes.BOLD} marginBottom={1}>
                    PRIORITIZED RECOMMENDATIONS ({selectedReport.recommendations.length})
                  </text>

                  {selectedReport.recommendations.length === 0 ? (
                    <text fg={THEME_COLORS.fgMuted}>No prioritized recommendations formulated.</text>
                  ) : (
                    selectedReport.recommendations.map((rec) => {
                      const pColor =
                        rec.priority === "P0"
                          ? THEME_COLORS.statusDanger
                          : rec.priority === "P1"
                          ? THEME_COLORS.statusWarning
                          : THEME_COLORS.statusInfo;

                      return (
                        <box
                          key={rec.id}
                          flexDirection="column"
                          border={true}
                          borderColor={THEME_COLORS.borderSubtle}
                          backgroundColor={THEME_COLORS.bgCard}
                          paddingX={2}
                          paddingY={1}
                          marginBottom={1}
                        >
                          <box flexDirection="row" alignItems="center">
                            <text fg={pColor} attributes={TextAttributes.BOLD}>
                              [{rec.priority}]
                            </text>
                            <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
                              {" "}{rec.title}
                            </text>
                          </box>
                          <text fg={THEME_COLORS.fgSecondary} marginTop={1}>
                            {rec.description}
                          </text>
                          <text fg={THEME_COLORS.fgMuted} marginTop={1}>
                            Rationale: {rec.rationale}
                          </text>
                        </box>
                      );
                    })
                  )}
                </box>
              )}

              {activeTab === "preview" && (
                <box
                  flexDirection="column"
                  border={true}
                  borderColor={THEME_COLORS.borderSubtle}
                  backgroundColor={THEME_COLORS.bgCard}
                  paddingX={2}
                  paddingY={1}
                  flexGrow={1}
                >
                  <text fg={THEME_COLORS.fgSecondary} attributes={TextAttributes.BOLD} marginBottom={1}>
                    MARKDOWN SOURCE (RAW EXPORT PREVIEW)
                  </text>
                  <text fg={THEME_COLORS.fgPrimary}>
                    {selectedReport.markdownContent.slice(0, 1500)}
                  </text>
                  {selectedReport.markdownContent.length > 1500 && (
                    <text fg={THEME_COLORS.fgMuted} marginTop={1}>
                      ... [Press [e] to export full {selectedReport.markdownContent.length} bytes to workspace]
                    </text>
                  )}
                </box>
              )}
            </box>
          )}
        </box>
      </box>

      {/* 3. Bottom Controls Hints */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        paddingX={2}
        paddingY={1}
        border={["top"]}
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        backgroundColor={THEME_COLORS.bgHeader}
      >
        <text fg={THEME_COLORS.fgSecondary}>
          [↑/↓] Select Report | [1-5] Tabs | [e] Export MD | [s] Customer Sim | [Tab] Focus
        </text>
        {state.exportedReportPath && (
          <text fg={THEME_COLORS.statusSuccess}>
            Exported to: {state.exportedReportPath.slice(-30)}
          </text>
        )}
      </box>
    </box>
  );
}
