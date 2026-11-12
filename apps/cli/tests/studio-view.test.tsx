/**
 * apps/cli/tests/studio-view.test.tsx
 *
 * Comprehensive UI test suite for Workspace 6: Engineering Studio.
 * Contributed by A3 (Data, Security & Reliability), A4 (CLI/TUI Designer), and A5 (Product Interface Designer).
 */

import { describe, expect, test } from "bun:test";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import {
  type CodeAnalysisSummary,
  type CodeFilePatch,
  type BoundedTestRunResult,
} from "@terrarium/contracts";
import { UiStateController } from "../src/ui/state/ui-state-controller.js";
import { TerrariumUiProvider } from "../src/ui/state/ui-context.js";
import { StudioView } from "../src/ui/views/StudioView.js";

function createMockAnalysis(overrides?: Partial<CodeAnalysisSummary>): CodeAnalysisSummary {
  return {
    repoPath: "/workspace/terrarium-app",
    branch: "main",
    isClean: true,
    languages: [
      { name: "TypeScript", percentage: 75, filesCount: 30 },
      { name: "JSON", percentage: 25, filesCount: 10 },
    ],
    frameworks: ["React", "Express", "Node.js / Bun"],
    entryPoints: ["src/index.ts", "apps/cli/src/index.tsx"],
    dependencies: [
      { name: "react", version: "^18.2.0", isDev: false },
      { name: "express", version: "^4.18.2", isDev: false },
    ],
    testFrameworks: ["bun:test"],
    sensitiveFiles: [
      { path: ".env", reason: "Environment variables with credentials", isProtected: true },
      { path: "id_rsa", reason: "Private SSH key", isProtected: true },
    ],
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockPatch(overrides?: Partial<CodeFilePatch>): CodeFilePatch {
  const diffUnified = [
    "--- a/src/index.ts",
    "+++ b/src/index.ts",
    "@@ -1,3 +1,4 @@",
    " export function hello(): string {",
    "+  // Added branding note",
    '-  return "hello world";',
    '+  return "hello terrarium";',
    " }",
  ].join("\n");

  return {
    id: "patch_mock_001",
    filePath: "src/index.ts",
    changeType: "modify",
    diffUnified,
    hunks: [
      {
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 4,
        header: "@@ -1,3 +1,4 @@",
        lines: [
          " export function hello(): string {",
          "+  // Added branding note",
          '-  return "hello world";',
          '+  return "hello terrarium";',
          " }",
        ],
      },
    ],
    proposedContent: 'export function hello(): string {\n  // Added branding note\n  return "hello terrarium";\n}\n',
    proposedHash: "sha256_mock_proposed",
    rationale: "Update greeting message for branding consistency",
    status: "proposed",
    requiresApproval: true,
    rollbackGuidance: "terrarium studio rollback patch_mock_001",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockTestRun(overrides?: Partial<BoundedTestRunResult>): BoundedTestRunResult {
  return {
    id: "test_run_001",
    command: "bun test",
    passed: true,
    exitCode: 0,
    totalTests: 42,
    passedTests: 42,
    failedTests: 0,
    durationMs: 380,
    stdout: "bun test v1.3.14\n 42 pass\n 0 fail\nRan 42 tests across 4 files.",
    stderr: "",
    executedAt: new Date().toISOString(),
    timedOut: false,
    ...overrides,
  };
}

describe("Engineering Studio OpenTUI View Suite (A3, A4 & A5)", () => {
  test("renders clean empty state when no analysis and no patches exist", async () => {
    const controller = new UiStateController({
      initialWorkspace: "studio",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <StudioView />
      </TerrariumUiProvider>,
      { width: 110, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("ENGINEERING STUDIO");
    expect(frame).toContain("Safe Code Workflow & Sandboxed Execution");
    expect(frame).toContain("[1] Repo Scan");
    expect(frame).toContain("[2] Patches (0)");
    expect(frame).toContain("[3] Diff Inspector");
    expect(frame).toContain("[4] Test Runner");
    expect(frame).toContain("[5] Security Shield");
    expect(frame).toContain("No Repository Analysis Performed Yet");
    expect(frame).toContain("Press [s] to run a static analysis scan");

    await setup.dispose();
  });

  test("renders repository analysis tab with languages, frameworks, entry points, and sensitive files", async () => {
    const mockAnalysis = createMockAnalysis();
    const controller = new UiStateController({
      initialWorkspace: "studio",
      initialStudioAnalysis: mockAnalysis,
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <StudioView />
      </TerrariumUiProvider>,
      { width: 110, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("Root: /workspace/terrarium-app");
    expect(frame).toContain("Clean (No uncommitted changes)");
    expect(frame).toContain("Branch: main");
    expect(frame).toContain("PRIMARY LANGUAGES");
    expect(frame).toContain("TypeScript");
    expect(frame).toContain("75% (30 files)");
    expect(frame).toContain("FRAMEWORKS & RUNTIMES");
    expect(frame).toContain("Express");
    expect(frame).toContain("ENTRY POINTS");
    expect(frame).toContain("src/index.ts");
    expect(frame).toContain("SHIELDED SENSITIVE FILES");
    expect(frame).toContain("[PROTECTED] .env");
    expect(frame).toContain("[PROTECTED] id_rsa");

    await setup.dispose();
  });

  test("renders patches list tab with status badges and approval requirements", async () => {
    const mockPatches = [
      createMockPatch({ id: "patch_01", filePath: "src/index.ts", status: "proposed", requiresApproval: true }),
      createMockPatch({ id: "patch_02", filePath: "src/utils.ts", status: "applied", requiresApproval: true }),
    ];

    const controller = new UiStateController({
      initialWorkspace: "studio",
      initialPatches: mockPatches,
    });
    controller.setStudioActiveTab("patches");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <StudioView />
      </TerrariumUiProvider>,
      { width: 110, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("2 Total Patches");
    expect(frame).toContain("src/index.ts");
    expect(frame).toContain("[PROPOSED]");
    expect(frame).toContain("[APPROVAL REQUIRED]");
    expect(frame).toContain("src/utils.ts");
    expect(frame).toContain("[APPLIED]");

    await setup.dispose();
  });

  test("renders unified diff inspector tab with diff hunks and consequential approval banner", async () => {
    const mockPatch = createMockPatch();
    const controller = new UiStateController({
      initialWorkspace: "studio",
      initialPatches: [mockPatch],
    });
    controller.setStudioActiveTab("diff");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <StudioView />
      </TerrariumUiProvider>,
      { width: 110, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("File: src/index.ts");
    expect(frame).toContain("STATUS: PROPOSED");
    expect(frame).toContain("[APPROVAL GATE] Consequential Action");
    expect(frame).toContain("[a] Approve & Apply");
    expect(frame).toContain("[r] Reject");
    expect(frame).toContain("--- a/src/index.ts");
    expect(frame).toContain("+++ b/src/index.ts");
    expect(frame).toContain("+  // Added branding note");
    expect(frame).toContain("-  return \"hello world\";");
    expect(frame).toContain("+  return \"hello terrarium\";");

    await setup.dispose();
  });

  test("renders bounded test runner tab with pass/fail counts and output logs", async () => {
    const mockTestRun = createMockTestRun();
    const controller = new UiStateController({
      initialWorkspace: "studio",
      initialStudioTestRun: mockTestRun,
    });
    controller.setStudioActiveTab("tests");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <StudioView />
      </TerrariumUiProvider>,
      { width: 110, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("ALL TESTS PASSED");
    expect(frame).toContain("Passed: 42");
    expect(frame).toContain("Failed: 0");
    expect(frame).toContain("Total: 42");
    expect(frame).toContain("Duration: 380ms");
    expect(frame).toContain("Command: bun test");
    expect(frame).toContain("TEST OUTPUT");
    expect(frame).toContain("42 pass");

    await setup.dispose();
  });

  test("renders security shield tab explaining active protection rules", async () => {
    const controller = new UiStateController({
      initialWorkspace: "studio",
    });
    controller.setStudioActiveTab("sandbox");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <StudioView />
      </TerrariumUiProvider>,
      { width: 110, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("ENGINEERING STUDIO SECURITY SHIELD");
    expect(frame).toContain("1. Read-Only Default & Human Authorization Gate");
    expect(frame).toContain("2. Shielded Sensitive Files Protection");
    expect(frame).toContain("3. Path Traversal & Symlink Escape Prevention");
    expect(frame).toContain("4. Destructive Shell Operation & Package Install Guards");
    expect(frame).toContain("5. Pre-Application Hash Verification & Atomic Rollback");

    await setup.dispose();
  });

  test("supports patch approval and rejection state transitions via controller", async () => {
    const mockPatch = createMockPatch({ id: "patch_trans_01", status: "proposed" });
    const controller = new UiStateController({
      initialWorkspace: "studio",
      initialPatches: [mockPatch],
    });

    expect(controller.getState().studioPatches[0]?.status).toBe("proposed");

    // Approve & Apply (in-memory mode)
    const approveResult = await controller.approveAndApplyStudioPatch("patch_trans_01");
    expect(approveResult).toBe(true);
    expect(controller.getState().studioPatches[0]?.status).toBe("applied");

    // Rollback
    const rollbackResult = await controller.rollbackStudioPatch("patch_trans_01");
    expect(rollbackResult).toBe(true);
    expect(controller.getState().studioPatches[0]?.status).toBe("rolled_back");

    // Reject another patch
    const mockPatch2 = createMockPatch({ id: "patch_trans_02", status: "proposed" });
    const controller2 = new UiStateController({
      initialWorkspace: "studio",
      initialPatches: [mockPatch2],
    });
    const rejectResult = await controller2.rejectStudioPatch("patch_trans_02", "Security vulnerability");
    expect(rejectResult).toBe(true);
    expect(controller2.getState().studioPatches[0]?.status).toBe("rejected");
  });
});
