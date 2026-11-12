/**
 * @terrarium/core - tests/customer-simulation.test.ts
 *
 * Test suite for CustomerSimulator synthetic research engine.
 * Aligns strictly with PLAN.md Section 8 and Prompt 18.
 */

import { describe, it, expect } from "bun:test";
import { CustomerSimulator, CANONICAL_SIMULATION_PERSONAS } from "../src/reports/customer-simulator.ts";
import { SIMULATED_RESEARCH_DISCLAIMER } from "@terrarium/contracts";

describe("Customer Simulation Engine Suite (A2)", () => {
  it("runs simulation across all canonical personas and produces structured feedback", () => {
    const result = CustomerSimulator.runSimulation({
      concept: "Terrarium Multi-Agent CLI and OpenTUI Orchestration Platform",
      scenario: "Local engineering workflow with least-privilege sandboxing",
    });

    expect(result.metadata.personas.length).toBe(CANONICAL_SIMULATION_PERSONAS.length);
    expect(result.metadata.disclaimer).toBe(SIMULATED_RESEARCH_DISCLAIMER);
    expect(result.metadata.simulatedFeedback.length).toBe(CANONICAL_SIMULATION_PERSONAS.length);

    // Verify persona diversity: not all positive!
    const sentiments = result.metadata.simulatedFeedback.map((f) => f.sentiment);
    expect(sentiments).toContain("skeptical");
    expect(sentiments).toContain("positive");

    // Verify objections and barriers are captured
    const enterpriseFb = result.metadata.simulatedFeedback.find((f) => f.personaId === "persona_enterprise_it");
    expect(enterpriseFb).toBeDefined();
    expect(enterpriseFb?.objections.length).toBeGreaterThan(0);
    expect(enterpriseFb?.pricingSensitivityHypothesis).toBeDefined();

    const indieFb = result.metadata.simulatedFeedback.find((f) => f.personaId === "persona_indie_dev");
    expect(indieFb).toBeDefined();
    expect(indieFb?.pricingSensitivityHypothesis?.includes("BYOK")).toBe(true);
  });

  it("extracts meaningful persona disagreements per PLAN.md Section 8.3 & 9", () => {
    const result = CustomerSimulator.runSimulation({
      concept: "Automated Code Generation and Patch Application",
    });

    expect(result.disagreements.length).toBeGreaterThanOrEqual(1);

    const governanceDisagreement = result.disagreements.find((d) => d.id === "dis_governance_vs_velocity");
    expect(governanceDisagreement).toBeDefined();
    expect(governanceDisagreement?.perspectives.length).toBe(2);
    expect(governanceDisagreement?.perspectives[0]!.isSimulatedPersona).toBe(true);
    expect(governanceDisagreement?.tradeOffImplication).toBeDefined();
  });

  it("generates evidence items tagged with simulated_feedback and persona ID", () => {
    const result = CustomerSimulator.runSimulation({
      concept: "OpenTUI Terminal Interface",
    });

    expect(result.evidence.length).toBeGreaterThan(0);
    for (const ev of result.evidence) {
      if (ev.claimType === "simulated_feedback") {
        expect(ev.isVerified).toBe(false);
        expect(ev.simulatedPersonaId).toBeDefined();
        expect(ev.tags).toContain("simulation");
      }
    }
  });

  it("produces prioritized actionable recommendations (P0, P1, P2)", () => {
    const result = CustomerSimulator.runSimulation({
      concept: "Terminal Agent Orchestration",
    });

    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
    const p0 = result.recommendations.find((r) => r.priority === "P0");
    const p1 = result.recommendations.find((r) => r.priority === "P1");
    const p2 = result.recommendations.find((r) => r.priority === "P2");

    expect(p0).toBeDefined();
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p0?.ownerRole).toBeDefined();
    expect(p0?.nextActions && p0.nextActions.length > 0).toBe(true);
  });
});
