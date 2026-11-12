/**
 * apps/cli/tests/ui-shell.test.ts
 *
 * Comprehensive integration tests for OpenTUI Shell & Navigation.
 * Uses OpenTUI testRender & mockInput to verify rendering, layout, keyboard interaction,
 * history back behavior, and responsive handling.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import { describe, expect, it } from "bun:test";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import { UiStateController, TerrariumUiProvider, AppShell } from "../src/ui/index.js";

describe("OpenTUI Application Shell & Navigation Suite (A4 & A5)", () => {
  it("renders full terminal shell with header, sidebar, overview cards, and status bar", async () => {
    const controller = new UiStateController({
      projectName: "terrarium-test",
      environment: "test",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <AppShell version="0.1.0" forcedWidth={100} forcedHeight={26} />
      </TerrariumUiProvider>,
      { width: 100, height: 26 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    // Verify Header Elements
    expect(frame).toContain("TERRARIUM");
    expect(frame).toContain("v0.1.0");
    expect(frame).toContain("terrarium-test");

    // Verify Navigation Bar Workspaces
    expect(frame).toContain("[1]");
    expect(frame).toContain("Overview");
    expect(frame).toContain("[2]");
    expect(frame).toContain("Agent Ecosystem");
    expect(frame).toContain("[5]");
    expect(frame).toContain("Task Manager");
    expect(frame).toContain("[6]");
    expect(frame).toContain("Engineering Studio");

    // Verify Breadcrumbs
    expect(frame).toContain("TERRARIUM");

    // Verify Overview Content Cards
    expect(frame).toContain("SYSTEM OVERVIEW");
    expect(frame).toContain("VIRTUAL ORG");
    expect(frame).toContain("TASKS");
    expect(frame).toContain("BUDGET");

    // Verify Status Bar Elements
    expect(frame).toContain("Active:");
    expect(frame).toContain("[1-9,0] Nav");

    await setup.dispose();
  });

  it("switches workspaces using direct number keys (1-9, 0)", async () => {
    const controller = new UiStateController();

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <AppShell version="0.1.0" forcedWidth={100} forcedHeight={26} />
      </TerrariumUiProvider>,
      { width: 100, height: 26 }
    );

    await setup.renderOnce();
    expect(controller.getState().activeWorkspace).toBe("overview");

    // Press '5' for Task Manager
    setup.mockInput.pressKey("5");
    await setup.renderOnce();
    expect(controller.getState().activeWorkspace).toBe("tasks");

    let frame = setup.captureCharFrame();
    expect(frame).toContain("Task Manager");
    expect(frame).toContain("TASK MANAGER");

    // Press '6' for Engineering Studio
    setup.mockInput.pressKey("6");
    await setup.renderOnce();
    expect(controller.getState().activeWorkspace).toBe("studio");

    frame = setup.captureCharFrame();
    expect(frame).toContain("Engineering Studio");
    expect(frame).toContain("Prompt 17");

    // Press '0' for Settings
    setup.mockInput.pressKey("0");
    await setup.renderOnce();
    expect(controller.getState().activeWorkspace).toBe("settings");

    frame = setup.captureCharFrame();
    expect(frame).toContain("Settings");

    await setup.dispose();
  });

  it("executes history back navigation on 'b' or 'escape' keys", async () => {
    const controller = new UiStateController();

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <AppShell version="0.1.0" forcedWidth={100} forcedHeight={26} />
      </TerrariumUiProvider>,
      { width: 100, height: 26 }
    );

    await setup.renderOnce();

    // Navigate: overview -> tasks -> memory
    setup.mockInput.pressKey("5");
    await setup.renderOnce();
    expect(controller.getState().activeWorkspace).toBe("tasks");

    setup.mockInput.pressKey("7");
    await setup.renderOnce();
    expect(controller.getState().activeWorkspace).toBe("memory");

    // Verify Breadcrumbs shows back hint
    let frame = setup.captureCharFrame();
    expect(frame).toContain("Back to Task Manager");

    // Press 'b' to navigate back to tasks
    setup.mockInput.pressKey("b");
    await setup.renderOnce();
    expect(controller.getState().activeWorkspace).toBe("tasks");

    // Press 'b' to navigate back to overview
    setup.mockInput.pressKey("b");
    await setup.renderOnce();
    expect(controller.getState().activeWorkspace).toBe("overview");

    await setup.dispose();
  });

  it("opens, filters, and executes actions from Command Palette", async () => {
    const controller = new UiStateController();

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <AppShell version="0.1.0" forcedWidth={100} forcedHeight={26} />
      </TerrariumUiProvider>,
      { width: 100, height: 26 }
    );

    await setup.renderOnce();
    expect(controller.getState().isCommandPaletteOpen).toBe(false);

    // Open palette with '/'
    setup.mockInput.pressKey("/");
    await setup.renderOnce();
    expect(controller.getState().isCommandPaletteOpen).toBe(true);

    let frame = setup.captureCharFrame();
    expect(frame).toContain("Command Palette");
    expect(frame).toContain("Go to Overview");

    // Close palette with Escape (ANSI parser requires timeout flush for isolated ESC)
    setup.mockInput.pressEscape();
    await new Promise((r) => setTimeout(r, 120));
    await setup.renderOnce();
    expect(controller.getState().isCommandPaletteOpen).toBe(false);

    // Reopen palette and navigate to a command
    setup.mockInput.pressKey("k", { ctrl: true });
    await setup.renderOnce();
    expect(controller.getState().isCommandPaletteOpen).toBe(true);

    // Press down arrow to select second item (Agent Ecosystem)
    setup.mockInput.pressArrow("down");
    await setup.renderOnce();
    expect(controller.getState().selectedPaletteIndex).toBe(1);

    // Press Enter to execute selection
    setup.mockInput.pressEnter();
    await setup.renderOnce();
    expect(controller.getState().isCommandPaletteOpen).toBe(false);
    expect(controller.getState().activeWorkspace).toBe("ecosystem");

    await setup.dispose();
  });

  it("opens and closes keyboard help reference modal on '?' and 'escape'", async () => {
    const controller = new UiStateController();

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <AppShell version="0.1.0" forcedWidth={100} forcedHeight={26} />
      </TerrariumUiProvider>,
      { width: 100, height: 26 }
    );

    await setup.renderOnce();
    expect(controller.getState().isHelpModalOpen).toBe(false);

    // Open help modal with '?'
    setup.mockInput.pressKey("?");
    await setup.renderOnce();
    expect(controller.getState().isHelpModalOpen).toBe(true);

    let frame = setup.captureCharFrame();
    expect(frame).toContain("TERRARIUM Keyboard & Navigation Reference");
    expect(frame).toContain("Direct jump to Workspaces");

    // Close help modal with Escape (ANSI parser requires timeout flush for isolated ESC)
    setup.mockInput.pressEscape();
    await new Promise((r) => setTimeout(r, 120));
    await setup.renderOnce();
    expect(controller.getState().isHelpModalOpen).toBe(false);

    await setup.dispose();
  });

  it("handles narrow and small terminal dimensions gracefully", async () => {
    const controller = new UiStateController();

    // Render in narrow terminal (width 70, below 80 minimum)
    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <AppShell version="0.1.0" forcedWidth={70} forcedHeight={18} />
      </TerrariumUiProvider>,
      { width: 70, height: 18 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    // Verify warning advisory banner is present without crashing
    expect(frame).toContain("Recommended min: 80x20");
    // Verify core shell components still render
    expect(frame).toContain("TERRARIUM");
    expect(frame).toContain("[1]");

    await setup.dispose();
  });

  it("renders Loading, Error, and Disconnected view states properly", async () => {
    const controller = new UiStateController();

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <AppShell version="0.1.0" forcedWidth={100} forcedHeight={26} />
      </TerrariumUiProvider>,
      { width: 100, height: 26 }
    );

    await setup.renderOnce();

    // 1. Loading State
    controller.setViewMode("loading");
    await setup.renderOnce();
    let frame = setup.captureCharFrame();
    expect(frame).toContain("Loading workspace data");

    // 2. Error State
    controller.setViewMode("error", "Database lock contention error");
    await setup.renderOnce();
    frame = setup.captureCharFrame();
    expect(frame).toContain("Component Execution Error");
    expect(frame).toContain("Database lock contention error");

    // 3. Disconnected State
    controller.setViewMode("disconnected");
    await setup.renderOnce();
    frame = setup.captureCharFrame();
    expect(frame).toContain("Engine Status: DISCONNECTED");

    // 4. Recovery back to Ready
    controller.setViewMode("ready");
    await setup.renderOnce();
    frame = setup.captureCharFrame();
    expect(frame).toContain("SYSTEM OVERVIEW");

    await setup.dispose();
  });

  it("calls onQuit callback when 'q' key is pressed", async () => {
    let quitCalled = false;
    const controller = new UiStateController();

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <AppShell
          version="0.1.0"
          forcedWidth={100}
          forcedHeight={26}
          onQuit={() => {
            quitCalled = true;
          }}
        />
      </TerrariumUiProvider>,
      { width: 100, height: 26 }
    );

    await setup.renderOnce();
    expect(quitCalled).toBe(false);

    setup.mockInput.pressKey("q");
    await setup.renderOnce();
    expect(quitCalled).toBe(true);

    await setup.dispose();
  });
});
