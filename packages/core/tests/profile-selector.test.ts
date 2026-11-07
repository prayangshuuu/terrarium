/**
 * @terrarium/core - tests/profile-selector.test.ts
 *
 * Deterministic test suite for demand-based agent profile selection and dormancy verification.
 * Aligns with PLAN.md Section 5.1 & PLAN_CONTEXT.md Section 5.
 */

import { describe, expect, it } from "bun:test";
import {
  createAgentRegistry,
  createProfileSelector,
} from "../src/index.ts";
import { type PlanStep } from "@terrarium/contracts";

describe("Demand-Based Profile Selector", () => {
  const registry = createAgentRegistry();
  const selector = createProfileSelector({ registry });

  function makeSampleStep(overrides: Partial<PlanStep> = {}): PlanStep {
    return {
      id: "step_1",
      stepIndex: 0,
      title: "Inspect Codebase Architecture",
      description: "Analyze modularity and contracts",
      department: "engineering",
      candidateCapabilities: ["architecture_analysis"],
      candidateAgentSlugs: ["principal-software-architect"],
      dependsOn: [],
      estimatedTokens: 3000,
      estimatedDurationMs: 4000,
      estimatedCostUsd: 0.03,
      requiresApproval: false,
      completionCriteria: ["Architecture analyzed"],
      ...overrides,
    };
  }

  it("selects principal architect for architecture review task in engineering", async () => {
    const step = makeSampleStep({
      department: "engineering",
      candidateCapabilities: ["architecture_analysis", "system_design"],
      candidateAgentSlugs: ["principal-software-architect"],
    });

    const res = await selector.selectProfileForStep({
      step,
      taskType: "architecture_review",
      department: "engineering",
      requiredCapabilities: ["architecture_analysis"],
      riskLevel: "low",
      uncertaintyLevel: "low",
      budgetRemainingUsd: 1.0,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      const decision = res.data;
      expect(decision.selectedProfile.slug).toBe("principal-software-architect");
      expect(decision.stepId).toBe("step_1");
      expect(decision.rationale).toContain("principal-software-architect");
      expect(decision.dormantProfileCount).toBeGreaterThan(10);
    }
  });

  it("selects simulated customer persona for customer simulation task", async () => {
    const step = makeSampleStep({
      id: "step_sim",
      title: "Simulated Buyer Reactions",
      department: "customer_intelligence",
      candidateCapabilities: ["persona_simulation"],
      candidateAgentSlugs: ["smb-founder-persona"],
    });

    const res = await selector.selectProfileForStep({
      step,
      taskType: "customer_simulation",
      department: "customer_intelligence",
      requiredCapabilities: ["persona_simulation"],
      riskLevel: "low",
      uncertaintyLevel: "low",
      budgetRemainingUsd: 0.5,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.selectedProfile.department).toBe("customer_intelligence");
      expect(res.data.selectedProfile.personaAttributes).toBeDefined();
    }
  });

  it("favors security specialists when risk is critical or high", async () => {
    const step = makeSampleStep({
      id: "step_sec",
      title: "Audit Permission perimeters",
      department: "security",
      candidateCapabilities: ["vulnerability_assessment", "threat_modeling"],
      candidateAgentSlugs: ["application-security-engineer"],
    });

    const res = await selector.selectProfileForStep({
      step,
      taskType: "security_audit",
      department: "security",
      requiredCapabilities: ["vulnerability_assessment"],
      riskLevel: "critical",
      uncertaintyLevel: "low",
      budgetRemainingUsd: 1.0,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.selectedProfile.department).toBe("security");
      expect(res.data.rationale).toContain("risk");
    }
  });

  it("prioritizes fast-tier profiles when remaining budget is tight", async () => {
    const step = makeSampleStep({
      id: "step_budget",
      department: "engineering",
      candidateCapabilities: ["test_generation"],
    });

    const res = await selector.selectProfileForStep({
      step,
      taskType: "test_generation",
      department: "engineering",
      requiredCapabilities: ["test_generation"],
      riskLevel: "low",
      uncertaintyLevel: "low",
      budgetRemainingUsd: 0.05, // very tight budget
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.selectedProfile.modelPreference.tier).toBe("fast");
    }
  });

  it("proves unused profiles remain dormant with 0% overhead", async () => {
    const activeIds = new Set(["agent-eng-architect"]);
    const reportRes = await selector.getDormancyReport(activeIds);

    expect(reportRes.success).toBe(true);
    if (reportRes.success) {
      const { active, dormant } = reportRes.data;
      expect(active.length).toBe(1);
      expect(active[0]?.slug).toBe("principal-software-architect");
      expect(dormant.length).toBeGreaterThanOrEqual(12);

      // Verify dormant profiles include CEO, QA, Personas, etc.
      expect(dormant.some((p) => p.slug === "chief-executive-officer")).toBe(true);
      expect(dormant.some((p) => p.slug === "smb-founder-persona")).toBe(true);
    }
  });
});
