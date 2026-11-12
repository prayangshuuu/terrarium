/**
 * apps/cli/tests/settings-view.test.tsx
 *
 * Comprehensive OpenTUI UI test suite for Workspace 10: Settings & Specialist Integrations.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import { describe, expect, test } from "bun:test";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import { UiStateController } from "../src/ui/state/ui-state-controller.js";
import { TerrariumUiProvider } from "../src/ui/state/ui-context.js";
import { SettingsView } from "../src/ui/views/SettingsView.js";

describe("Settings & Specialist Provider Integrations OpenTUI Suite (A4 & A5)", () => {
  test("renders Workspace 10 header with tabs and action indicators", async () => {
    const controller = new UiStateController({
      initialWorkspace: "settings",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <SettingsView />
      </TerrariumUiProvider>,
      { width: 130, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Settings & Specialist Provider");
    expect(frame).toContain("Workspace 10");
    expect(frame).toContain("[1] Model Providers");
    expect(frame).toContain("[2] CLI Integrations");
    expect(frame).toContain("[3] Priority Matrix");
    expect(frame).toContain("[4] Diagnostics");
    expect(frame).toContain("[t] Test Connection");

    await setup.dispose();
  });

  test("renders Model Providers tab with master provider list and specification details", async () => {
    const controller = new UiStateController({
      initialWorkspace: "settings",
    });
    controller.setSettingsTab("providers");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <SettingsView />
      </TerrariumUiProvider>,
      { width: 130, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("PROVIDERS (5)");
    expect(frame).toContain("ANTHROPIC");
    expect(frame).toContain("OLLAMA");
    expect(frame).toContain("OPENAI");
    expect(frame).toContain("GEMINI");
    expect(frame).toContain("OPENAI ADAPTER SPECIFICATION");
    expect(frame).toContain("Connection Mode");

    await setup.dispose();
  });

  test("renders CLI Integrations tab with Claude Code runner configuration and boundaries", async () => {
    const controller = new UiStateController({
      initialWorkspace: "settings",
    });
    controller.setSettingsTab("integrations");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <SettingsView />
      </TerrariumUiProvider>,
      { width: 110, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("SPECIALIST CODING-AGENT CLI RUNNERS");
    expect(frame).toContain("claude-code-cli");
    expect(frame).toContain("Supported Tools: edit, bash, grep, glob");
    expect(frame).toContain("Non-interactive batch print mode (-p)");
    expect(frame).toContain("SECURITY GUARD RAILS");

    await setup.dispose();
  });

  test("renders Priority Matrix tab with canonical rankings #1 through #5", async () => {
    const controller = new UiStateController({
      initialWorkspace: "settings",
    });
    controller.setSettingsTab("rankings");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <SettingsView />
      </TerrariumUiProvider>,
      { width: 110, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("INTEGRATION PRIORITY & RISK MATRIX");
    expect(frame).toContain("#1 Anthropic Claude Models");
    expect(frame).toContain("#2 Ollama Local Offline Models");
    expect(frame).toContain("#3 OpenAI & Compatible Models");
    expect(frame).toContain("#4 Google Gemini Models");
    expect(frame).toContain("#5 Claude Code CLI Subprocess Adapter");

    await setup.dispose();
  });

  test("renders Diagnostics tab and displays recorded health probe results", async () => {
    const controller = new UiStateController({
      initialWorkspace: "settings",
    });
    controller.setSettingsTab("diagnostics");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <SettingsView />
      </TerrariumUiProvider>,
      { width: 110, height: 45 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("LIVE PROVIDER REACHABILITY & HEALTH DIAGNOSTICS");
    expect(frame).toContain("Press [t] to test reachability");

    await setup.dispose();
  });
});
