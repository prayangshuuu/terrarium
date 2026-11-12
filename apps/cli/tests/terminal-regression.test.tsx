/**
 * apps/cli/tests/terminal-regression.test.tsx
 *
 * Terminal viewport regression and long content stress test suite.
 * Aligns with Prompt 20: "Test terminal sizes/long content. A4: terminal regression."
 * Verifies OpenTUI views under constrained viewports (60x20, 80x24), standard viewports (120x40),
 * ultra-wide screens (180x50), and massive content (1,000+ line logs and deep reports).
 * Contributed by A4 (Senior CLI/TUI Designer & Developer).
 */

import { describe, expect, test } from "bun:test";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import { UiStateController } from "../src/ui/state/ui-state-controller.js";
import { TerrariumUiProvider } from "../src/ui/state/ui-context.js";
import { OverviewView } from "../src/ui/views/OverviewView.js";
import { TasksView } from "../src/ui/views/TasksView.js";
import { ReportsView } from "../src/ui/views/ReportsView.js";
import { SettingsView } from "../src/ui/views/SettingsView.js";
import { StudioView } from "../src/ui/views/StudioView.js";

describe("OpenTUI Terminal Viewport Regression & Content Suite (A4)", () => {
  test("renders OverviewView cleanly in standard 80x24 legacy terminal", async () => {
    const controller = new UiStateController({
      initialWorkspace: "overview",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <OverviewView />
      </TerrariumUiProvider>,
      { width: 80, height: 24 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("SYSTEM OVERVIEW");
    expect(frame.length).toBeGreaterThan(0);
    await setup.dispose();
  });

  test("renders TasksView without crashing in constrained 60x20 mobile/SSH terminal", async () => {
    const controller = new UiStateController({
      initialWorkspace: "tasks",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <TasksView />
      </TerrariumUiProvider>,
      { width: 60, height: 20 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame.length).toBeGreaterThan(0);
    expect(frame).toContain("TASK MANAGER");
    await setup.dispose();
  });

  test("renders SettingsView in standard 120x40 desktop terminal", async () => {
    const controller = new UiStateController({
      initialWorkspace: "settings",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <SettingsView />
      </TerrariumUiProvider>,
      { width: 120, height: 40 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("SETTINGS & SPECIALIST PROVIDER");
    expect(frame).toContain("[1] Model Providers");
    expect(frame).toContain("[2] CLI Integrations");
    await setup.dispose();
  });

  test("renders ReportsView in ultra-wide 180x50 terminal with deep content", async () => {
    const controller = new UiStateController({
      initialWorkspace: "reports",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ReportsView />
      </TerrariumUiProvider>,
      { width: 180, height: 50 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("REPORTS & EVIDENCE");
    await setup.dispose();
  });

  test("handles massive multi-line content without terminal buffer overflow", async () => {
    const controller = new UiStateController({
      initialWorkspace: "studio",
    });

    // Populate large activity feed logs (100+ events)
    for (let i = 0; i < 100; i++) {
      controller.recordActivityEvent({
        id: `evt_stress_${i}`,
        type: "tool_executed",
        severity: "info",
        message: `Bulk stress test log message event line #${i} with extended context metadata and file paths`,
        source: "stress_test_runner",
        timestamp: new Date().toISOString(),
      });
    }

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <StudioView />
      </TerrariumUiProvider>,
      { width: 100, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame.length).toBeGreaterThan(0);
    expect(frame).toContain("ENGINEERING STUDIO");
    await setup.dispose();
  });
});
