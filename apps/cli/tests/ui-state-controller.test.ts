/**
 * apps/cli/tests/ui-state-controller.test.ts
 *
 * Unit tests for UI state controller, navigation history stack, and command dispatching.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 */

import { describe, expect, it } from "bun:test";
import { UiStateController } from "../src/ui/state/ui-state-controller.js";

describe("UI State Controller & Navigation History Suite (A1 & A2)", () => {
  it("initializes with default overview workspace and disconnected status without engine", () => {
    const controller = new UiStateController();
    const state = controller.getState();

    expect(state.activeWorkspace).toBe("overview");
    expect(state.history).toEqual(["overview"]);
    expect(state.isSidebarCollapsed).toBe(false);
    expect(state.isCommandPaletteOpen).toBe(false);
    expect(state.isHelpModalOpen).toBe(false);
    expect(state.viewMode).toBe("ready");
    expect(state.engineStatus).toBe("disconnected");
  });

  it("navigates to workspaces and pushes onto history stack", () => {
    const controller = new UiStateController();

    controller.navigate("tasks");
    expect(controller.getState().activeWorkspace).toBe("tasks");
    expect(controller.getState().history).toEqual(["overview", "tasks"]);

    controller.navigate("studio");
    expect(controller.getState().activeWorkspace).toBe("studio");
    expect(controller.getState().history).toEqual(["overview", "tasks", "studio"]);

    // Navigating to the same workspace is an idempotent no-op
    controller.navigate("studio");
    expect(controller.getState().history).toEqual(["overview", "tasks", "studio"]);
  });

  it("executes back navigation pop from history stack", () => {
    const controller = new UiStateController();

    controller.navigate("tasks");
    controller.navigate("memory");
    controller.navigate("settings");
    expect(controller.getState().history).toEqual(["overview", "tasks", "memory", "settings"]);

    // 1st back: returns to memory
    const back1 = controller.goBack();
    expect(back1).toBe(true);
    expect(controller.getState().activeWorkspace).toBe("memory");
    expect(controller.getState().history).toEqual(["overview", "tasks", "memory"]);

    // 2nd back: returns to tasks
    const back2 = controller.goBack();
    expect(back2).toBe(true);
    expect(controller.getState().activeWorkspace).toBe("tasks");

    // 3rd back: returns to overview
    const back3 = controller.goBack();
    expect(back3).toBe(true);
    expect(controller.getState().activeWorkspace).toBe("overview");

    // 4th back: at root of history, returns false
    const back4 = controller.goBack();
    expect(back4).toBe(false);
    expect(controller.getState().activeWorkspace).toBe("overview");
  });

  it("dismisses open modals on back action before popping history", () => {
    const controller = new UiStateController();
    controller.navigate("tasks");

    controller.openCommandPalette();
    expect(controller.getState().isCommandPaletteOpen).toBe(true);

    // goBack closes palette first without popping workspace
    const back1 = controller.goBack();
    expect(back1).toBe(true);
    expect(controller.getState().isCommandPaletteOpen).toBe(false);
    expect(controller.getState().activeWorkspace).toBe("tasks");

    controller.openHelp();
    expect(controller.getState().isHelpModalOpen).toBe(true);

    // goBack closes help next
    const back2 = controller.goBack();
    expect(back2).toBe(true);
    expect(controller.getState().isHelpModalOpen).toBe(false);
    expect(controller.getState().activeWorkspace).toBe("tasks");
  });

  it("manages command palette search filtering and item selection", () => {
    const controller = new UiStateController();

    const allItems = controller.getCommandPaletteItems();
    expect(allItems.length).toBeGreaterThan(10);

    // Filter by query
    controller.setPaletteQuery("studio");
    const filtered = controller.getCommandPaletteItems();
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.title).toContain("Engineering Studio");

    // Execute filtered item
    filtered[0]?.action();
    expect(controller.getState().activeWorkspace).toBe("studio");
  });

  it("manages transient alerts and notification messages", () => {
    const controller = new UiStateController();
    expect(controller.getState().alert).toBeUndefined();

    controller.setAlert("Budget limit warning: 80% spent", "warning");
    expect(controller.getState().alert?.message).toBe("Budget limit warning: 80% spent");
    expect(controller.getState().alert?.level).toBe("warning");

    controller.clearAlert();
    expect(controller.getState().alert).toBeUndefined();
  });

  it("manages view modes (loading, empty, error, disconnected)", () => {
    const controller = new UiStateController();

    controller.setViewMode("loading");
    expect(controller.getState().viewMode).toBe("loading");

    controller.setViewMode("error", "Database connection timeout");
    expect(controller.getState().viewMode).toBe("error");
    expect(controller.getState().errorMessage).toBe("Database connection timeout");

    controller.setViewMode("disconnected");
    expect(controller.getState().viewMode).toBe("disconnected");

    controller.setViewMode("ready");
    expect(controller.getState().viewMode).toBe("ready");
  });

  it("notifies subscribers on state updates and cleans up listeners", () => {
    const controller = new UiStateController();
    const observed: string[] = [];

    const unsub = controller.subscribe((state) => {
      observed.push(state.activeWorkspace);
    });

    controller.navigate("tasks");
    controller.navigate("reports");
    unsub();

    controller.navigate("settings");

    // "settings" should not be recorded after unsub
    expect(observed).toEqual(["overview", "tasks", "reports"]);
  });
});
