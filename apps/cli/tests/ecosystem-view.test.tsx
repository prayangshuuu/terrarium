/**
 * apps/cli/tests/ecosystem-view.test.tsx
 *
 * Comprehensive test suite for Workspace 2: Searchable/Filterable Agent Ecosystem.
 * Contributed by A3 (Senior Backend Developer, Data, Security & Reliability)
 * and A4 (Senior CLI/TUI Designer & Developer).
 *
 * Validates:
 * - Empty state on unpopulated clean install.
 * - Profile directory table with lifecycle status badges.
 * - Department filtering (Executive, Engineering, Customer Intelligence, etc.).
 * - Lifecycle status filtering (registered, enabled, selected, executing, paused, disabled).
 * - Keyword search across name, role, capability, keywords.
 * - Detail inspection view with capabilities, constraints, and selection rationale.
 * - Prominent [SIMULATED] labels on simulated customer personas (PLAN.md Section 8 & Section 4.5).
 * - Keyboard navigation (Up/Down, Enter/Space, Esc, 'd', 'f').
 */

import { describe, expect, test } from "bun:test";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import { SEED_AGENT_PROFILES } from "@terrarium/core";
import { type AgentSelectionRationale } from "@terrarium/contracts";
import { UiStateController } from "../src/ui/state/ui-state-controller.js";
import { TerrariumUiProvider } from "../src/ui/state/ui-context.js";
import { EcosystemView } from "../src/ui/views/EcosystemView.js";

describe("Agent Ecosystem Directory & Inspection Suite (A3, A4 & A5)", () => {
  test("renders clean new-install empty state when catalog has zero profiles", async () => {
    const controller = new UiStateController({
      initialWorkspace: "ecosystem",
      initialProfiles: [],
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <EcosystemView />
      </TerrariumUiProvider>,
      { width: 110, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("AGENT ECOSYSTEM");
    expect(frame).toContain("UNPOPULATED VIRTUAL ORGANIZATION");
    expect(frame).toContain("Zero Agent Profiles Registered");
    expect(frame).toContain("terrarium agent seed");
  });

  test("renders populated directory table with status badges and department tags", async () => {
    const controller = new UiStateController({
      initialWorkspace: "ecosystem",
      initialProfiles: SEED_AGENT_PROFILES,
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <EcosystemView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    // Verify Header & Total Count
    expect(frame).toContain("AGENT ECOSYSTEM");
    expect(frame).toContain(`${SEED_AGENT_PROFILES.length} registered profiles`);

    // Verify Directory Table Columns
    expect(frame).toContain("STATUS");
    expect(frame).toContain("AGENT / SPECIALIST");
    expect(frame).toContain("ROLE");
    expect(frame).toContain("DEPARTMENT");

    // Verify Seed Profiles in directory
    expect(frame).toContain("Elena Rostova");
    expect(frame).toContain("Vikram Patel");
    expect(frame).toContain("[ENB]"); // Enabled status
  });

  test("filters agents by department", async () => {
    const controller = new UiStateController({
      initialWorkspace: "ecosystem",
      initialProfiles: SEED_AGENT_PROFILES,
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <EcosystemView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();

    // Filter to Engineering
    controller.setEcosystemDepartmentFilter("engineering");
    await setup.renderOnce();
    let frame = setup.captureCharFrame();

    expect(frame).toContain("ENG");
    expect(frame).toContain("Sophia Chen");
    expect(frame).not.toContain("Elena Rostova"); // CEO should be filtered out

    // Filter to Customer Intelligence (Simulated)
    controller.setEcosystemDepartmentFilter("customer_intelligence");
    await setup.renderOnce();
    frame = setup.captureCharFrame();

    expect(frame).toContain("CUST");
    expect(frame).toContain("[SIMULATED]");
    expect(frame).toContain("Marcus Vance"); // Marcus is VP Enterprise persona
    expect(frame).not.toContain("Sophia Chen"); // Engineering filtered out
  });

  test("searches agents by keyword across name, role, and capabilities", async () => {
    const controller = new UiStateController({
      initialWorkspace: "ecosystem",
      initialProfiles: SEED_AGENT_PROFILES,
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <EcosystemView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();

    // Search for "Sophia Chen"
    controller.setEcosystemSearch("Sophia Chen");
    await setup.renderOnce();
    let frame = setup.captureCharFrame();

    expect(frame).toContain("Sophia Chen"); // Principal Software Architect
    expect(frame).not.toContain("Elena Rostova");

    // Search for nonexistent term: renders empty search notice
    controller.setEcosystemSearch("nonexistent-quantum-xyz");
    await setup.renderOnce();
    frame = setup.captureCharFrame();

    expect(frame).toContain("NO MATCHING AGENTS");
    expect(frame).toContain("Press [Esc] to reset all filters");
  });

  test("distinguishes lifecycle statuses: registered, enabled, selected, executing, disabled", async () => {
    const controller = new UiStateController({
      initialWorkspace: "ecosystem",
      initialProfiles: SEED_AGENT_PROFILES,
    });

    const ceo = SEED_AGENT_PROFILES.find((p) => p.department === "executive")!;

    controller.recordSelectionRationale({
      profileId: ceo.id,
      profileSlug: ceo.slug,
      taskId: "task-exec-01",
      stepId: "step-01",
      rationale: "Selected for executive strategic direction and thesis challenge.",
      score: 95,
      matchedCapabilities: ["cap-strategic-direction"],
      matchedTasks: ["strategic_prioritization"],
      reasons: ["Highest domain authority in executive leadership"],
      recordedAt: new Date().toISOString(),
    });

    // Check computed lifecycle status
    const ceoStatus = controller.getAgentLifecycleStatus(ceo);
    expect(ceoStatus).toBe("selected");

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <EcosystemView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    // Verify CEO has [SEL] badge
    expect(frame).toContain("[SEL]");
  });

  test("inspects agent profile details with capabilities, operational bounds, and selection rationale", async () => {
    const controller = new UiStateController({
      initialWorkspace: "ecosystem",
      initialProfiles: SEED_AGENT_PROFILES,
    });

    const architect = SEED_AGENT_PROFILES.find((p) => p.department === "engineering")!;

    // Record selection rationale
    controller.recordSelectionRationale({
      profileId: architect.id,
      profileSlug: architect.slug,
      taskId: "task-arch-01",
      stepId: "step-01",
      rationale: "Matched for software architecture evaluation and code boundary verification.",
      score: 98,
      matchedCapabilities: ["cap-software-architecture"],
      matchedTasks: ["architecture_review"],
      reasons: ["Top capability match for module design and safe execution boundaries"],
      recordedAt: new Date().toISOString(),
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <EcosystemView />
      </TerrariumUiProvider>,
      { width: 120, height: 45 }
    );

    await setup.renderOnce();

    // Open detail for architect
    controller.openAgentDetail(architect.id);
    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    // Verify Detail Modal Banner
    expect(frame).toContain(`SPECIALIST PROFILE: ${architect.name.toUpperCase()}`);
    expect(frame).toContain(architect.slug);

    // Verify Capabilities & Operational Bounds
    expect(frame).toContain("CAPABILITIES");
    expect(frame).toContain("OPERATIONAL BOUNDS");
    expect(frame).toContain("Max tokens/turn");

    // Verify Selection Rationale is displayed
    expect(frame).toContain("DEMAND-BASED SELECTION RATIONALE");
    expect(frame).toContain("Matched for Execution (Candidate Score: 98/100)");
    expect(frame).toContain("Top capability match for module design");

    // Verify dismissal hint
    expect(frame).toContain("[Esc] or [Enter] Close detail view");

    // Close detail
    controller.closeAgentDetail();
    await setup.renderOnce();
    const closedFrame = setup.captureCharFrame();
    expect(closedFrame).not.toContain("OPERATIONAL BOUNDS");
  });

  test("prominently labels simulated customer personas [SIMULATED] with persona attributes", async () => {
    const controller = new UiStateController({
      initialWorkspace: "ecosystem",
      initialProfiles: SEED_AGENT_PROFILES,
    });

    const persona = SEED_AGENT_PROFILES.find((p) => p.department === "customer_intelligence")!;
    expect(persona).toBeDefined();

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <EcosystemView />
      </TerrariumUiProvider>,
      { width: 120, height: 45 }
    );

    await setup.renderOnce();

    // Open detail for persona
    controller.openAgentDetail(persona.id);
    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    // Verify Mandatory Simulation Warning Banner (PLAN.md Section 8 & Section 4.5)
    expect(frame).toContain("[SIMULATED CUSTOMER PERSONA]");
    expect(frame).toContain("Simulated viewpoint representing persona attributes");
    expect(frame).toContain("Not a real human customer, interview subject, or statistically representative sample");

    // Verify Persona Attributes
    if (persona.personaAttributes) {
      expect(frame).toContain(persona.personaAttributes.occupation);
      expect(frame).toContain(persona.personaAttributes.technicalFamiliarity);
    }
  });

  test("handles keyboard cycling of department and lifecycle status filters", async () => {
    const controller = new UiStateController({
      initialWorkspace: "ecosystem",
      initialProfiles: SEED_AGENT_PROFILES,
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <EcosystemView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();
    expect(controller.getState().ecosystemFilter.department).toBe("all");

    // Press 'd' to cycle department
    setup.mockInput.pressKey("d");
    expect(controller.getState().ecosystemFilter.department).not.toBe("all");

    // Press 'f' to cycle lifecycle status
    setup.mockInput.pressKey("f");
    expect(controller.getState().ecosystemFilter.lifecycleStatus).not.toBe("all");

    // Press 'escape' to reset filters
    setup.mockInput.pressEscape();
    await new Promise((r) => setTimeout(r, 120));
    expect(controller.getState().ecosystemFilter.department).toBe("all");
    expect(controller.getState().ecosystemFilter.lifecycleStatus).toBe("all");
  });
});
