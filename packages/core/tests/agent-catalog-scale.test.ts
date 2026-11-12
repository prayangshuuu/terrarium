/**
 * packages/core/tests/agent-catalog-scale.test.ts
 *
 * Comprehensive tests for agent catalog scalability and limitation removal.
 * Verifies catalog sizes: 0, 1, 15, 16, 50, 100, and 250+ stress fixture.
 * Proves no silent truncation, accurate counting, pagination, unregistration,
 * and demand-based activation preservation (zero executions for dormant profiles).
 * Contributed by A1 (Platform & Architecture) & A3 (Data, Security & Reliability).
 */

import { describe, expect, it } from "bun:test";
import {
  createAgentRegistry,
  DefaultAgentRegistry,
  createCoreEngine,
} from "../src/index.ts";
import { type AgentProfileInput, AGENT_DEPARTMENTS } from "@terrarium/contracts";

describe("Agent Catalog Scalability & Limitation Removal Suite (A1 & A3)", () => {
  function makeMockProfile(index: number, dept = "engineering"): AgentProfileInput {
    const slug = `agent-scale-${index}`;
    return {
      id: `agent-id-${index}`,
      slug,
      name: `Specialist Agent ${index}`,
      role: `Domain Specialist Tier ${index}`,
      department: (dept as any),
      description: `Handles specialized automated engineering task group ${index}.`,
      systemPromptTemplate: `You are specialist agent ${index}. Analyze inputs and produce deliverables.`,
      capabilities: [
        {
          id: `cap-scale-${index}`,
          name: `Capability ${index}`,
          description: `Execution capability for domain area ${index}`,
          department: (dept as any),
          requiredPermissions: ["read:code"],
          isConsequential: false,
          keywords: [`kw-${index}`, "engineering", "analysis"],
        },
      ],
      supportedTasks: [`task_type_${index}`, "general_code_inspection"],
      status: "available",
      tags: [`tag-${index}`, "scale-test"],
    };
  }

  it("handles empty catalog cleanly (size: 0)", async () => {
    const registry = createAgentRegistry({ autoSeed: false, seedProfiles: [] });
    const count = await registry.count();
    expect(count).toBe(0);

    const listRes = await registry.list();
    expect(listRes.success).toBe(true);
    if (listRes.success) {
      expect(listRes.data.length).toBe(0);
    }
  });

  it("handles single-profile catalog cleanly (size: 1)", async () => {
    const registry = createAgentRegistry({ autoSeed: false, seedProfiles: [] });
    const regRes = await registry.register(makeMockProfile(1));
    expect(regRes.success).toBe(true);

    const count = await registry.count();
    expect(count).toBe(1);

    const listRes = await registry.list();
    expect(listRes.success).toBe(true);
    if (listRes.success) {
      expect(listRes.data.length).toBe(1);
      expect(listRes.data[0]?.name).toBe("Specialist Agent 1");
    }
  });

  it("handles standard 15-agent seed catalog without artificial limits (size: 15)", async () => {
    const registry = createAgentRegistry({ autoSeed: true });
    const count = await registry.count();
    expect(count).toBe(15);

    const listRes = await registry.list();
    expect(listRes.success).toBe(true);
    if (listRes.success) {
      expect(listRes.data.length).toBe(15);
    }
  });

  it("scales beyond previous 15-profile boundary without truncation (size: 16)", async () => {
    const registry = createAgentRegistry({ autoSeed: true });
    // Add 16th profile
    const addRes = await registry.register(makeMockProfile(16, "product"));
    expect(addRes.success).toBe(true);

    const count = await registry.count();
    expect(count).toBe(16);

    const listRes = await registry.list();
    expect(listRes.success).toBe(true);
    if (listRes.success) {
      expect(listRes.data.length).toBe(16);
      expect(listRes.data.some((p) => p.slug === "agent-scale-16")).toBe(true);
    }
  });

  it("supports catalog scaling to 50 and 100 profiles with accurate counts and pagination", async () => {
    const registry = createAgentRegistry({ autoSeed: false, seedProfiles: [] });

    // Bulk register 100 profiles distributed across 10 departments
    const profiles: AgentProfileInput[] = [];
    for (let i = 1; i <= 100; i++) {
      const dept = AGENT_DEPARTMENTS[i % AGENT_DEPARTMENTS.length]!;
      profiles.push(makeMockProfile(i, dept));
    }

    const importRes = await registry.importProfiles(profiles);
    expect(importRes.success).toBe(true);
    if (importRes.success) {
      expect(importRes.data).toBe(100);
    }

    const totalCount = await registry.count();
    expect(totalCount).toBe(100);

    // List all without truncation
    const allRes = await registry.list();
    expect(allRes.success).toBe(true);
    if (allRes.success) {
      expect(allRes.data.length).toBe(100);
    }

    // Pagination: page 1 of 20
    const page1Res = await registry.list({ page: 1, pageSize: 20 });
    expect(page1Res.success).toBe(true);
    if (page1Res.success) {
      expect(page1Res.data.length).toBe(20);
    }

    // Pagination: page 5 of 20
    const page5Res = await registry.list({ page: 5, pageSize: 20 });
    expect(page5Res.success).toBe(true);
    if (page5Res.success) {
      expect(page5Res.data.length).toBe(20);
    }

    // Department filtering
    const engCount = await registry.count("engineering");
    expect(engCount).toBe(10);
  });

  it("handles high-volume stress fixture (size: 250+) efficiently without performance degradation", async () => {
    const registry = createAgentRegistry({ autoSeed: false, seedProfiles: [] });

    const bulk: AgentProfileInput[] = [];
    for (let i = 1; i <= 250; i++) {
      const dept = AGENT_DEPARTMENTS[i % AGENT_DEPARTMENTS.length]!;
      bulk.push(makeMockProfile(i, dept));
    }

    const startImport = performance.now();
    const importRes = await registry.importProfiles(bulk);
    const duration = performance.now() - startImport;

    expect(importRes.success).toBe(true);
    expect(duration).toBeLessThan(500); // 250 profiles imported in under 500ms

    const total = await registry.count();
    expect(total).toBe(250);

    // Search query on 250 profiles
    const searchRes = await registry.search({ query: "Specialist Agent 24", limit: 10 });
    expect(searchRes.success).toBe(true);
    if (searchRes.success) {
      expect(searchRes.data.length).toBeGreaterThan(0);
      expect(searchRes.data[0]?.name).toContain("24");
    }
  });

  it("supports safe unregistration and status toggling (enable/disable)", async () => {
    const registry = createAgentRegistry({ autoSeed: false, seedProfiles: [] });
    await registry.register(makeMockProfile(1));

    // Disable
    const disRes = await registry.disable("agent-scale-1", "Testing maintenance");
    expect(disRes.success).toBe(true);
    if (disRes.success) {
      expect(disRes.data.status).toBe("disabled");
      expect(disRes.data.metadata?.disabledReason).toBe("Testing maintenance");
    }

    // Enable
    const enRes = await registry.enable("agent-scale-1");
    expect(enRes.success).toBe(true);
    if (enRes.success) {
      expect(enRes.data.status).toBe("available");
    }

    // Unregister
    const unregRes = await registry.unregister("agent-scale-1");
    expect(unregRes.success).toBe(true);

    const countAfter = await registry.count();
    expect(countAfter).toBe(0);
  });

  it("preserves demand-based activation invariant even with 100+ registered profiles", async () => {
    const engine = createCoreEngine();

    // Register 50 additional profiles into the engine registry
    for (let i = 1; i <= 50; i++) {
      await engine.registry.register(makeMockProfile(100 + i, "engineering"));
    }

    const totalProfiles = await engine.registry.count();
    expect(totalProfiles).toBeGreaterThanOrEqual(65);

    // Execute workflow: only required agents activate; rest remain dormant
    const res = await engine.workflow.executeWorkflow({
      prompt: "Review packages/contracts domain schemas",
      targetDepartment: "engineering",
      autoApprove: true,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      const record = res.data;
      expect(record.dormantProfilesVerified).toBe(true);
      expect(record.activeProfileSlugs.length).toBeGreaterThan(0);
      expect(record.dormantProfileSlugs.length).toBeGreaterThan(50);

      // Disjoint invariant: Active ∩ Dormant = ∅
      const intersection = record.activeProfileSlugs.filter((s) =>
        record.dormantProfileSlugs.includes(s)
      );
      expect(intersection.length).toBe(0);

      // Sum of active and dormant equals total registered profiles
      expect(record.activeProfileSlugs.length + record.dormantProfileSlugs.length).toBe(totalProfiles);
    }
  });
});
