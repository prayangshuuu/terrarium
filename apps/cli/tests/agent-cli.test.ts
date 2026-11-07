import { describe, expect, it } from "bun:test";
import { createAgentRegistry } from "@terrarium/core";
import {
  handleAgentInspect,
  handleAgentList,
  handleAgentSearch,
  handleDepartmentList,
} from "../src/commands/agent-commands.ts";

describe("CLI Agent Directory Commands", () => {
  const registry = createAgentRegistry();

  it("lists all seeded agent profiles in formatted table", async () => {
    const res = await handleAgentList(registry);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("Terrarium Agent Profile Directory");
      expect(res.data).toContain("chief-executive-officer");
      expect(res.data).toContain("principal-software-architect");
      expect(res.data).toContain("smb-founder-persona");
    }
  });

  it("filters agent profiles by department", async () => {
    const res = await handleAgentList(registry, { department: "engineering" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("principal-software-architect");
      expect(res.data).toContain("senior-backend-engineer");
      expect(res.data).not.toContain("chief-executive-officer");
    }
  });

  it("searches agent profiles by keyword", async () => {
    const res = await handleAgentSearch(registry, "sqlite");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("senior-backend-engineer");
      expect(res.data).not.toContain("chief-executive-officer");
    }
  });

  it("inspects an agent profile card by slug", async () => {
    const res = await handleAgentInspect(registry, "principal-software-architect");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("Sophia Chen (Principal Architect)");
      expect(res.data).toContain("Operational Constraints:");
      expect(res.data).toContain("Max Tokens/Turn:      6000");
      expect(res.data).toContain("Architecture Review");
    }
  });

  it("inspects a simulated customer persona card showing persona attributes", async () => {
    const res = await handleAgentInspect(registry, "smb-founder-persona");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("Simulated Persona Profile:");
      expect(res.data).toContain("Bootstrapped SaaS Founder");
      expect(res.data).toContain("Price Sensitivity:    high");
    }
  });

  it("returns error when inspecting non-existent profile", async () => {
    const res = await handleAgentInspect(registry, "non-existent-agent");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("PROFILE_NOT_FOUND");
    }
  });

  it("lists all 10 departments and taxonomies", async () => {
    const res = await handleDepartmentList(registry);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("Executive Leadership");
      expect(res.data).toContain("Engineering");
      expect(res.data).toContain("Customer Intelligence (Simulated)");
      expect(res.data).toContain("Legal & Risk Analysis");
      expect(res.data).toContain("Security & Compliance");
    }
  });
});
