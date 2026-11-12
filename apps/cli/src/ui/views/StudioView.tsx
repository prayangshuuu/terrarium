/**
 * apps/cli/src/ui/views/StudioView.tsx
 *
 * Workspace 6: Engineering Studio (Safe Code Workflows, Diffs, Patches & Sandboxes).
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer),
 * with security and bounded execution guarantees enforced by A3 & A2.
 *
 * PLAN.md Section 17 & PROMPT 17:
 * - Read-only repository access by default with consequential approval gates.
 * - Unified diff inspector with syntax-colored hunks, line coordinates, and rationale.
 * - Multi-file patch management with rollback guidance and atomic partial-failure handling.
 * - Bounded test runner with execution timeout and exact count recording.
 * - Security sandbox shield protecting .env, credentials, symlinks, and path traversal.
 */

import React, { useCallback } from "react";
import { TextAttributes, type KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import {
  type CodeAnalysisSummary,
  type CodeFilePatch,
  type BoundedTestRunResult,
} from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { useTerrariumUi } from "../state/ui-context.js";

type StudioTab = "analysis" | "patches" | "diff" | "tests" | "sandbox";

export function StudioView() {
  const { state, controller } = useTerrariumUi();
  const activeTab: StudioTab = (state.studioActiveTab as StudioTab) ?? "analysis";

  const patches = state.studioPatches;
  const selectedPatchIndex = state.selectedStudioPatchIndex;
  const selectedPatch: CodeFilePatch | null = patches[selectedPatchIndex] ?? null;
  const analysis = state.studioAnalysis;
  const testRun = state.latestStudioTestRun;

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (state.isCommandPaletteOpen || state.isHelpModalOpen) return;

      const keyName = event.name.toLowerCase();

      // Tab switching shortcuts [1-5] or Tab
      if (keyName === "1") {
        controller.setStudioActiveTab("analysis");
        return;
      }
      if (keyName === "2") {
        controller.setStudioActiveTab("patches");
        return;
      }
      if (keyName === "3") {
        controller.setStudioActiveTab("diff");
        return;
      }
      if (keyName === "4") {
        controller.setStudioActiveTab("tests");
        return;
      }
      if (keyName === "5") {
        controller.setStudioActiveTab("sandbox");
        return;
      }
      if (keyName === "tab") {
        const tabs: StudioTab[] = ["analysis", "patches", "diff", "tests", "sandbox"];
        const curIdx = tabs.indexOf(activeTab);
        const nextTab = tabs[(curIdx + 1) % tabs.length] ?? "analysis";
        controller.setStudioActiveTab(nextTab);
        return;
      }

      // Action shortcuts
      if (keyName === "s") {
        void controller.analyzeRepository();
        return;
      }

      if (keyName === "t") {
        void controller.runStudioTests();
        return;
      }

      // Patch list navigation
      if (keyName === "up" || keyName === "k") {
        if (patches.length > 0) {
          const nextIdx = Math.max(0, selectedPatchIndex - 1);
          controller.selectStudioPatch(nextIdx);
        }
        return;
      }
      if (keyName === "down" || keyName === "j") {
        if (patches.length > 0) {
          const nextIdx = Math.min(patches.length - 1, selectedPatchIndex + 1);
          controller.selectStudioPatch(nextIdx);
        }
        return;
      }

      // Patch actions
      if (selectedPatch) {
        if (keyName === "a") {
          void controller.approveAndApplyStudioPatch(selectedPatch.id);
          return;
        }
        if (keyName === "r") {
          void controller.rejectStudioPatch(selectedPatch.id);
          return;
        }
        if (keyName === "u") {
          void controller.rollbackStudioPatch(selectedPatch.id);
          return;
        }
      }
    },
    [
      state.isCommandPaletteOpen,
      state.isHelpModalOpen,
      activeTab,
      patches,
      selectedPatchIndex,
      selectedPatch,
      controller,
    ]
  );

  useKeyboard(handleKeyboard);

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1} paddingTop={0} paddingBottom={0}>
      {/* 1. Header & Tab Navigation Bar */}
      <box flexDirection="column" marginBottom={1}>
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <box flexDirection="row" alignItems="center">
            <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
              {"⚡ ENGINEERING STUDIO"}
            </text>
            <text style={{ fg: THEME_COLORS.fgMuted }}>{" | Safe Code Workflow & Sandboxed Execution"}</text>
          </box>
          <box flexDirection="row">
            <text style={{ fg: THEME_COLORS.fgMuted }}>{"[1-5] Tabs | [s] Scan | [t] Tests"}</text>
          </box>
        </box>

        {/* Tab Buttons */}
        <box flexDirection="row" marginTop={1}>
          <box
            marginRight={2}
            backgroundColor={activeTab === "analysis" ? THEME_COLORS.bgCard : undefined}
            paddingLeft={1}
            paddingRight={1}
          >
            <text
              style={{
                fg: activeTab === "analysis" ? THEME_COLORS.statusInfo : THEME_COLORS.fgMuted,
                attributes: activeTab === "analysis" ? TextAttributes.BOLD : undefined,
              }}
            >
              {"[1] Repo Scan"}
            </text>
          </box>
          <box
            marginRight={2}
            backgroundColor={activeTab === "patches" ? THEME_COLORS.bgCard : undefined}
            paddingLeft={1}
            paddingRight={1}
          >
            <text
              style={{
                fg: activeTab === "patches" ? THEME_COLORS.statusInfo : THEME_COLORS.fgMuted,
                attributes: activeTab === "patches" ? TextAttributes.BOLD : undefined,
              }}
            >
              {`[2] Patches (${patches.length})`}
            </text>
          </box>
          <box
            marginRight={2}
            backgroundColor={activeTab === "diff" ? THEME_COLORS.bgCard : undefined}
            paddingLeft={1}
            paddingRight={1}
          >
            <text
              style={{
                fg: activeTab === "diff" ? THEME_COLORS.statusInfo : THEME_COLORS.fgMuted,
                attributes: activeTab === "diff" ? TextAttributes.BOLD : undefined,
              }}
            >
              {"[3] Diff Inspector"}
            </text>
          </box>
          <box
            marginRight={2}
            backgroundColor={activeTab === "tests" ? THEME_COLORS.bgCard : undefined}
            paddingLeft={1}
            paddingRight={1}
          >
            <text
              style={{
                fg: activeTab === "tests" ? THEME_COLORS.statusInfo : THEME_COLORS.fgMuted,
                attributes: activeTab === "tests" ? TextAttributes.BOLD : undefined,
              }}
            >
              {`[4] Test Runner ${testRun ? (testRun.passed ? "✓" : "✗") : ""}`}
            </text>
          </box>
          <box
            backgroundColor={activeTab === "sandbox" ? THEME_COLORS.bgCard : undefined}
            paddingLeft={1}
            paddingRight={1}
          >
            <text
              style={{
                fg: activeTab === "sandbox" ? THEME_COLORS.statusInfo : THEME_COLORS.fgMuted,
                attributes: activeTab === "sandbox" ? TextAttributes.BOLD : undefined,
              }}
            >
              {"[5] Security Shield"}
            </text>
          </box>
        </box>
      </box>

      {/* 2. Main Tab Body */}
      {activeTab === "analysis" && (
        <RepositoryScanTab analysis={analysis} isAnalyzing={state.isAnalyzingStudio} />
      )}
      {activeTab === "patches" && (
        <PatchesListTab
          patches={patches}
          selectedIndex={selectedPatchIndex}
          onSelect={(idx) => controller.selectStudioPatch(idx)}
        />
      )}
      {activeTab === "diff" && (
        <DiffInspectorTab patch={selectedPatch} />
      )}
      {activeTab === "tests" && (
        <TestRunnerTab testRun={testRun} isRunning={state.isRunningStudioTests} />
      )}
      {activeTab === "sandbox" && (
        <SecurityShieldTab analysis={analysis} />
      )}

      {/* 3. Bottom Keyboard Shortcuts Reference */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        backgroundColor={THEME_COLORS.bgHeader}
        paddingLeft={1}
        paddingRight={1}
        marginTop={1}
      >
        <box flexDirection="row">
          <text style={{ fg: THEME_COLORS.fgDim }}>
            {"[Tab] Cycle Tabs  [s] Scan Repo  [t] Run Tests  [↑/↓] Select Patch  [a] Approve & Apply  [r] Reject  [u] Rollback"}
          </text>
        </box>
        <box flexDirection="row">
          <text style={{ fg: THEME_COLORS.fgSecondary }}>
            {state.isApplyingStudioPatch ? "Applying patch..." : state.isRunningStudioTests ? "Running tests..." : "Ready"}
          </text>
        </box>
      </box>
    </box>
  );
}

// =============================================================================
// Tab 1: Repository Static Analysis
// =============================================================================

interface RepositoryScanTabProps {
  readonly analysis: CodeAnalysisSummary | null;
  readonly isAnalyzing: boolean;
}

function RepositoryScanTab({ analysis, isAnalyzing }: RepositoryScanTabProps) {
  if (isAnalyzing) {
    return (
      <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
        <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
          {"Analyzing repository structure, languages, entry points, and protected files..."}
        </text>
      </box>
    );
  }

  if (!analysis) {
    return (
      <box
        flexDirection="column"
        flexGrow={1}
        alignItems="center"
        justifyContent="center"
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        padding={2}
      >
        <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
          {"No Repository Analysis Performed Yet"}
        </text>
        <text style={{ fg: THEME_COLORS.fgMuted }} marginTop={1}>
          {"Press [s] to run a static analysis scan of the repository tree."}
        </text>
        <text style={{ fg: THEME_COLORS.fgDim }} marginTop={1}>
          {"Discovers primary languages, dependencies, framework entry points, and sensitive files."}
        </text>
      </box>
    );
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Overview Card */}
      <box
        flexDirection="row"
        backgroundColor={THEME_COLORS.bgCard}
        padding={1}
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        marginBottom={1}
      >
        <box flexDirection="column" flexGrow={1}>
          <text style={{ fg: THEME_COLORS.fgPrimary, attributes: TextAttributes.BOLD }}>
            {`Root: ${analysis.repoPath}`}
          </text>
          <text style={{ fg: THEME_COLORS.fgMuted }} marginTop={1}>
            {`Working Tree: ${analysis.isClean ? "✓ Clean (No uncommitted changes)" : "⚠ Modified / Uncommitted edits detected"}`}
          </text>
          {analysis.branch && (
            <text style={{ fg: THEME_COLORS.fgSecondary }}>{`Branch: ${analysis.branch}`}</text>
          )}
        </box>
        <box flexDirection="column" alignItems="flex-end">
          <text style={{ fg: THEME_COLORS.fgDim }}>{`Last Scanned: ${new Date(analysis.analyzedAt).toLocaleTimeString()}`}</text>
          <text style={{ fg: THEME_COLORS.statusInfo }} marginTop={1}>{"[s] Re-scan"}</text>
        </box>
      </box>

      {/* Two Column Layout: Languages & Frameworks | Entry Points & Sensitive Files */}
      <box flexDirection="row" flexGrow={1}>
        {/* Left Column: Languages & Frameworks */}
        <box
          flexDirection="column"
          flexGrow={1}
          marginRight={1}
          borderStyle="single"
          borderColor={THEME_COLORS.borderSubtle}
          padding={1}
        >
          <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
            {"PRIMARY LANGUAGES"}
          </text>
          {analysis.languages.length === 0 ? (
            <text style={{ fg: THEME_COLORS.fgDim }} marginTop={1}>{"(no source files found)"}</text>
          ) : (
            analysis.languages.map((l) => (
              <box key={l.name} flexDirection="row" justifyContent="space-between" marginTop={1}>
                <text style={{ fg: THEME_COLORS.fgPrimary }}>{l.name}</text>
                <text style={{ fg: THEME_COLORS.fgSecondary }}>{`${l.percentage}% (${l.filesCount} files)`}</text>
              </box>
            ))
          )}

          <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }} marginTop={2}>
            {"FRAMEWORKS & RUNTIMES"}
          </text>
          {analysis.frameworks.length === 0 ? (
            <text style={{ fg: THEME_COLORS.fgDim }} marginTop={1}>{"(none detected)"}</text>
          ) : (
            <box flexDirection="row" flexWrap="wrap" marginTop={1}>
              {analysis.frameworks.map((fw) => (
                <box key={fw} backgroundColor={THEME_COLORS.bgCardHover} paddingLeft={1} paddingRight={1} marginRight={1} marginBottom={1}>
                  <text style={{ fg: THEME_COLORS.statusInfo }}>{fw}</text>
                </box>
              ))}
            </box>
          )}

          <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }} marginTop={2}>
            {"TEST FRAMEWORKS"}
          </text>
          {analysis.testFrameworks.length === 0 ? (
            <text style={{ fg: THEME_COLORS.fgDim }} marginTop={1}>{"(none detected)"}</text>
          ) : (
            <text style={{ fg: THEME_COLORS.statusSuccess }} marginTop={1}>
              {analysis.testFrameworks.join(", ")}
            </text>
          )}
        </box>

        {/* Right Column: Entry Points & Sensitive Files */}
        <box
          flexDirection="column"
          flexGrow={1}
          borderStyle="single"
          borderColor={THEME_COLORS.borderSubtle}
          padding={1}
        >
          <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
            {"ENTRY POINTS"}
          </text>
          {analysis.entryPoints.length === 0 ? (
            <text style={{ fg: THEME_COLORS.fgDim }} marginTop={1}>{"(no canonical entry points found)"}</text>
          ) : (
            analysis.entryPoints.map((ep) => (
              <text key={ep} style={{ fg: THEME_COLORS.fgPrimary }} marginTop={1}>
                {`• ${ep}`}
              </text>
            ))
          )}

          <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }} marginTop={2}>
            {"SHIELDED SENSITIVE FILES"}
          </text>
          {analysis.sensitiveFiles.length === 0 ? (
            <text style={{ fg: THEME_COLORS.statusSuccess }} marginTop={1}>
              {"✓ No unprotected secrets or credentials detected in project tree."}
            </text>
          ) : (
            analysis.sensitiveFiles.map((sf) => (
              <box key={sf.path} flexDirection="column" marginTop={1}>
                <text style={{ fg: THEME_COLORS.statusDanger, attributes: TextAttributes.BOLD }}>
                  {`⚠ [PROTECTED] ${sf.path}`}
                </text>
                <text style={{ fg: THEME_COLORS.fgDim }}>{`  ${sf.reason}`}</text>
              </box>
            ))
          )}
        </box>
      </box>
    </box>
  );
}

// =============================================================================
// Tab 2: Proposed & Applied Patches List
// =============================================================================

interface PatchesListTabProps {
  readonly patches: readonly CodeFilePatch[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}

function PatchesListTab({ patches, selectedIndex, onSelect }: PatchesListTabProps) {
  if (patches.length === 0) {
    return (
      <box
        flexDirection="column"
        flexGrow={1}
        alignItems="center"
        justifyContent="center"
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        padding={2}
      >
        <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
          {"No Code Patches Available"}
        </text>
        <text style={{ fg: THEME_COLORS.fgMuted }} marginTop={1}>
          {"When coding agents propose file modifications, inspectable patches appear here."}
        </text>
        <text style={{ fg: THEME_COLORS.fgDim }} marginTop={1}>
          {"Patches remain isolated until reviewed and explicitly approved by human authorization."}
        </text>
      </box>
    );
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text style={{ fg: THEME_COLORS.fgMuted }}>
          {"Select a patch with [↑/↓], press [3] to inspect diff, [a] to approve, [r] to reject"}
        </text>
        <text style={{ fg: THEME_COLORS.statusInfo }}>{`${patches.length} Total Patches`}</text>
      </box>

      <box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={THEME_COLORS.borderSubtle}>
        {patches.map((patch, idx) => {
          const isSelected = idx === selectedIndex;
          let statusColor: string = THEME_COLORS.fgSecondary;
          if (patch.status === "applied") statusColor = THEME_COLORS.statusSuccess;
          else if (patch.status === "rejected" || patch.status === "failed") statusColor = THEME_COLORS.statusDanger;
          else if (patch.status === "proposed") statusColor = THEME_COLORS.statusWarning;
          else if (patch.status === "rolled_back") statusColor = THEME_COLORS.fgDim;

          return (
            <box
              key={patch.id}
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              backgroundColor={isSelected ? THEME_COLORS.bgCardHover : undefined}
              paddingLeft={1}
              paddingRight={1}
              paddingTop={1}
              paddingBottom={1}
              borderStyle="single"
              borderColor={isSelected ? THEME_COLORS.statusInfo : THEME_COLORS.borderSubtle}
            >
              <box flexDirection="column" flexGrow={1}>
                <box flexDirection="row" alignItems="center">
                  <text style={{ fg: isSelected ? THEME_COLORS.statusInfo : THEME_COLORS.fgPrimary, attributes: isSelected ? TextAttributes.BOLD : undefined }}>
                    {`${isSelected ? "▶ " : "  "}${patch.filePath}`}
                  </text>
                  <text style={{ fg: THEME_COLORS.fgDim, marginLeft: 2 }}>{`(${patch.changeType.toUpperCase()})`}</text>
                </box>
                <text style={{ fg: THEME_COLORS.fgMuted }} marginTop={1}>
                  {`Rationale: ${patch.rationale}`}
                </text>
                {patch.rollbackGuidance && (
                  <text style={{ fg: THEME_COLORS.fgDim }}>{`Rollback: ${patch.rollbackGuidance}`}</text>
                )}
              </box>

              <box flexDirection="column" alignItems="flex-end">
                <text style={{ fg: statusColor, attributes: TextAttributes.BOLD }}>
                  {`[${patch.status.toUpperCase()}]`}
                </text>
                <text style={{ fg: THEME_COLORS.fgDim }} marginTop={1}>
                  {patch.requiresApproval ? "⚠ Requires Approval" : "Auto-executable"}
                </text>
              </box>
            </box>
          );
        })}
      </box>
    </box>
  );
}

// =============================================================================
// Tab 3: Unified Diff Inspector & Approval Gate
// =============================================================================

interface DiffInspectorTabProps {
  readonly patch: CodeFilePatch | null;
}

function DiffInspectorTab({ patch }: DiffInspectorTabProps) {
  if (!patch) {
    return (
      <box
        flexDirection="column"
        flexGrow={1}
        alignItems="center"
        justifyContent="center"
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        padding={2}
      >
        <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
          {"No Patch Selected for Inspection"}
        </text>
        <text style={{ fg: THEME_COLORS.fgMuted }} marginTop={1}>
          {"Select a patch from the [2] Patches tab to inspect its unified diff and hunks."}
        </text>
      </box>
    );
  }

  const diffLines = patch.diffUnified.split("\n");

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Patch Header & Approval Gate Banner */}
      <box
        flexDirection="column"
        backgroundColor={patch.status === "proposed" ? THEME_COLORS.bgCardHover : THEME_COLORS.bgCard}
        borderStyle="single"
        borderColor={patch.status === "proposed" ? THEME_COLORS.statusWarning : THEME_COLORS.borderSubtle}
        padding={1}
        marginBottom={1}
      >
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <box flexDirection="row" alignItems="center">
            <text style={{ fg: THEME_COLORS.fgPrimary, attributes: TextAttributes.BOLD }}>
              {`File: ${patch.filePath}`}
            </text>
            <text style={{ fg: THEME_COLORS.statusInfo, marginLeft: 2 }}>
              {`(${patch.changeType.toUpperCase()})`}
            </text>
          </box>
          <text
            style={{
              fg: patch.status === "applied" ? THEME_COLORS.statusSuccess : patch.status === "proposed" ? THEME_COLORS.statusWarning : THEME_COLORS.fgDim,
              attributes: TextAttributes.BOLD,
            }}
          >
            {`STATUS: ${patch.status.toUpperCase()}`}
          </text>
        </box>

        <text style={{ fg: THEME_COLORS.fgMuted }} marginTop={1}>
          {`Rationale: ${patch.rationale}`}
        </text>

        {/* Consequential Action Approval Gate Controls */}
        {patch.status === "proposed" && (
          <box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            backgroundColor={THEME_COLORS.bgApp}
            padding={1}
            marginTop={1}
            borderStyle="single"
            borderColor={THEME_COLORS.statusWarning}
          >
            <box flexDirection="column">
              <text style={{ fg: THEME_COLORS.statusWarning, attributes: TextAttributes.BOLD }}>
                {"⚠ Consequential Action Approval Gate"}
              </text>
              <text style={{ fg: THEME_COLORS.fgDim }}>
                {"Direct working-tree modifications require explicit human authorization."}
              </text>
            </box>
            <box flexDirection="row">
              <box backgroundColor={THEME_COLORS.bgCardHover} paddingLeft={1} paddingRight={1} marginRight={2}>
                <text style={{ fg: THEME_COLORS.statusSuccess, attributes: TextAttributes.BOLD }}>
                  {"[a] Approve & Apply"}
                </text>
              </box>
              <box backgroundColor={THEME_COLORS.bgCardHover} paddingLeft={1} paddingRight={1}>
                <text style={{ fg: THEME_COLORS.statusDanger, attributes: TextAttributes.BOLD }}>
                  {"[r] Reject"}
                </text>
              </box>
            </box>
          </box>
        )}

        {patch.status === "applied" && (
          <box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={1}>
            <text style={{ fg: THEME_COLORS.statusSuccess }}>
              {`✓ Patch applied at ${patch.appliedAt ? new Date(patch.appliedAt).toLocaleTimeString() : "recently"}`}
            </text>
            <text style={{ fg: THEME_COLORS.statusWarning, attributes: TextAttributes.BOLD }}>
              {"[u] Rollback Working Tree"}
            </text>
          </box>
        )}
      </box>

      {/* Unified Diff View */}
      <box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        padding={1}
      >
        <text style={{ fg: THEME_COLORS.fgDim, marginBottom: 1 }}>
          {`Unified Diff (${diffLines.length} lines, ${patch.hunks.length} hunks)`}
        </text>

        <box flexDirection="column" flexGrow={1}>
          {diffLines.slice(0, 50).map((line, idx) => {
            let color: string = THEME_COLORS.fgPrimary;
            let bold = false;

            if (line.startsWith("+++") || line.startsWith("---")) {
              color = THEME_COLORS.fgSecondary;
              bold = true;
            } else if (line.startsWith("+")) {
              color = THEME_COLORS.statusSuccess;
            } else if (line.startsWith("-")) {
              color = THEME_COLORS.statusDanger;
            } else if (line.startsWith("@@")) {
              color = THEME_COLORS.statusInfo;
              bold = true;
            }

            return (
              <text
                key={idx}
                style={{
                  fg: color,
                  attributes: bold ? TextAttributes.BOLD : undefined,
                }}
              >
                {line}
              </text>
            );
          })}
          {diffLines.length > 50 && (
            <text style={{ fg: THEME_COLORS.fgDim }} marginTop={1}>
              {`... and ${diffLines.length - 50} more lines`}
            </text>
          )}
        </box>
      </box>
    </box>
  );
}

// =============================================================================
// Tab 4: Bounded Test Execution Runner
// =============================================================================

interface TestRunnerTabProps {
  readonly testRun: BoundedTestRunResult | null;
  readonly isRunning: boolean;
}

function TestRunnerTab({ testRun, isRunning }: TestRunnerTabProps) {
  if (isRunning) {
    return (
      <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
        <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
          {"Executing bounded tests in workspace sandbox..."}
        </text>
      </box>
    );
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Test Controls & Status Card */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        backgroundColor={THEME_COLORS.bgCard}
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        padding={1}
        marginBottom={1}
      >
        <box flexDirection="column">
          <text style={{ fg: THEME_COLORS.fgPrimary, attributes: TextAttributes.BOLD }}>
            {"Bounded Test Execution Engine"}
          </text>
          <text style={{ fg: THEME_COLORS.fgDim }} marginTop={1}>
            {"Runs workspace test suite within strict execution timeout and path isolation."}
          </text>
        </box>
        <box backgroundColor={THEME_COLORS.bgCardHover} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
            {"[t] Run Tests"}
          </text>
        </box>
      </box>

      {/* Latest Run Results */}
      {testRun ? (
        <box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={THEME_COLORS.borderSubtle} padding={1}>
          <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
            <text
              style={{
                fg: testRun.passed ? THEME_COLORS.statusSuccess : THEME_COLORS.statusDanger,
                attributes: TextAttributes.BOLD,
              }}
            >
              {testRun.passed ? "✓ ALL TESTS PASSED" : testRun.timedOut ? "⚠ EXECUTION TIMED OUT" : "✗ TESTS FAILED"}
            </text>
            <text style={{ fg: THEME_COLORS.fgDim }}>
              {`Exit Code: ${testRun.exitCode} | Duration: ${testRun.durationMs}ms`}
            </text>
          </box>

          <box flexDirection="row" marginBottom={1}>
            <text style={{ fg: THEME_COLORS.statusSuccess }}>{`Passed: ${testRun.passedTests}`}</text>
            <text style={{ fg: THEME_COLORS.statusDanger, marginLeft: 2 }}>{`Failed: ${testRun.failedTests}`}</text>
            <text style={{ fg: THEME_COLORS.fgPrimary, marginLeft: 2 }}>{`Total: ${testRun.totalTests}`}</text>
          </box>

          <text style={{ fg: THEME_COLORS.fgDim, marginBottom: 1 }}>{`Command: ${testRun.command}`}</text>

          {/* Output Display */}
          <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
            {"TEST OUTPUT"}
          </text>
          <box flexDirection="column" flexGrow={1} backgroundColor={THEME_COLORS.bgApp} padding={1} marginTop={1}>
            {testRun.stdout.trim() ? (
              testRun.stdout.split("\n").slice(-25).map((line, idx) => (
                <text key={idx} style={{ fg: THEME_COLORS.fgPrimary }}>{line}</text>
              ))
            ) : (
              <text style={{ fg: THEME_COLORS.fgDim }}>{"(no standard output)"}</text>
            )}

            {testRun.stderr.trim() && (
              <box flexDirection="column" marginTop={1}>
                <text style={{ fg: THEME_COLORS.statusDanger, attributes: TextAttributes.BOLD }}>{"Standard Error:"}</text>
                {testRun.stderr.split("\n").slice(-10).map((line, idx) => (
                  <text key={idx} style={{ fg: THEME_COLORS.statusDanger }}>{line}</text>
                ))}
              </box>
            )}
          </box>
        </box>
      ) : (
        <box
          flexDirection="column"
          flexGrow={1}
          alignItems="center"
          justifyContent="center"
          borderStyle="single"
          borderColor={THEME_COLORS.borderSubtle}
          padding={2}
        >
          <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
            {"No Test Runs Executed Yet"}
          </text>
          <text style={{ fg: THEME_COLORS.fgMuted }} marginTop={1}>
            {"Press [t] to execute bounded tests in this workspace."}
          </text>
        </box>
      )}
    </box>
  );
}

// =============================================================================
// Tab 5: Security Shield & Least Privilege Boundary Reference
// =============================================================================

interface SecurityShieldTabProps {
  readonly analysis: CodeAnalysisSummary | null;
}

function SecurityShieldTab({ analysis: _analysis }: SecurityShieldTabProps) {
  return (
    <box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={THEME_COLORS.borderSubtle} padding={1}>
      <text style={{ fg: THEME_COLORS.statusInfo, attributes: TextAttributes.BOLD }}>
        {"ENGINEERING STUDIO SECURITY SHIELD & SANDBOX BOUNDARIES"}
      </text>
      <text style={{ fg: THEME_COLORS.fgDim }} marginTop={1}>
        {"Strict isolation rules enforced by CodeSecuritySandbox (A3) and BoundedCoordinator (A2):"}
      </text>

      <box flexDirection="column" marginTop={2}>
        <text style={{ fg: THEME_COLORS.statusSuccess, attributes: TextAttributes.BOLD }}>
          {"1. Read-Only Default & Human Authorization Gate"}
        </text>
        <text style={{ fg: THEME_COLORS.fgMuted }}>
          {"   Repository access is strictly read-only by default. Consequential working-tree modifications require explicit human approval."}
        </text>

        <text style={{ fg: THEME_COLORS.statusSuccess, attributes: TextAttributes.BOLD }} marginTop={1}>
          {"2. Shielded Sensitive Files Protection"}
        </text>
        <text style={{ fg: THEME_COLORS.fgMuted }}>
          {"   The sandbox shields .env*, *.key, id_rsa*, id_ed25519, credentials*.json, service-account*.json, and .git/config from write mutations."}
        </text>

        <text style={{ fg: THEME_COLORS.statusSuccess, attributes: TextAttributes.BOLD }} marginTop={1}>
          {"3. Path Traversal & Symlink Escape Prevention"}
        </text>
        <text style={{ fg: THEME_COLORS.fgMuted }}>
          {"   Parent directory traversal ('..'), null-byte injection, and symlinks resolving outside the workspace sandbox root are blocked."}
        </text>

        <text style={{ fg: THEME_COLORS.statusSuccess, attributes: TextAttributes.BOLD }} marginTop={1}>
          {"4. Destructive Shell Operation & Package Install Guards"}
        </text>
        <text style={{ fg: THEME_COLORS.fgMuted }}>
          {"   Destructive commands (rm -rf, mkfs, git reset --hard) and unapproved dependency additions (npm install, pip install) are intercepted."}
        </text>

        <text style={{ fg: THEME_COLORS.statusSuccess, attributes: TextAttributes.BOLD }} marginTop={1}>
          {"5. Pre-Application Hash Verification & Atomic Rollback"}
        </text>
        <text style={{ fg: THEME_COLORS.fgMuted }}>
          {"   Before writing patches, existing file SHA-256 hashes are verified to prevent clobbering user edits. Multi-file failures roll back atomically."}
        </text>
      </box>
    </box>
  );
}
