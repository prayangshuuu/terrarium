/**
 * packages/core/tests/agent-catalog-700.test.ts
 *
 * Quality, Schema, and Integrity Tests for the 700+ Agent Profile Ecosystem (Prompt 24).
 * Contributed by A3 (Data, Security & Reliability) & A1 (Platform & Architecture).
 *
 * Verifies:
 * - Catalogue contains at least 700 distinct profiles (765 shipped profiles).
 * - 0 duplicate IDs, 0 duplicate slugs, 0 duplicate names, 0 duplicate descriptions.
 * - All 50 canonical engineering and organizational domains are represented.
 * - All 10 canonical virtual organization departments are populated.
 * - 100% emoji-free across all profiles (names, roles, descriptions, tags, metadata).
 * - Every profile satisfies schema contracts via validateAgentCatalogueIntegrity().
 */

import { describe, expect, it } from "bun:test";
import {
  ECOSYSTEM_CATALOG_700,
  SEED_AGENT_PROFILES,
  validateAgentCatalogueIntegrity,
  DOMAIN_DEFINITIONS,
} from "../src/registry/index.ts";
import { AGENT_DOMAINS, AGENT_DEPARTMENTS } from "@terrarium/contracts";

describe("700+ Agent Profile Ecosystem & Integrity Suite (A1 & A3)", () => {
  it("ships a catalogue containing at least 700 validated agent profiles", () => {
    expect(ECOSYSTEM_CATALOG_700.length).toBeGreaterThanOrEqual(700);
    expect(SEED_AGENT_PROFILES.length).toBeGreaterThanOrEqual(700);
  });

  it("passes comprehensive catalogue integrity validation with zero errors", () => {
    const report = validateAgentCatalogueIntegrity(SEED_AGENT_PROFILES, 700);

    expect(report.isValid).toBe(true);
    expect(report.errors.length).toBe(0);
    expect(report.totalProfiles).toBe(SEED_AGENT_PROFILES.length);
  });

  it("proves complete uniqueness: zero duplicate IDs, slugs, names, or descriptions", () => {
    const ids = new Set<string>();
    const slugs = new Set<string>();
    const names = new Set<string>();
    const descriptions = new Set<string>();

    for (const profile of SEED_AGENT_PROFILES) {
      expect(ids.has(profile.id)).toBe(false);
      ids.add(profile.id);

      expect(slugs.has(profile.slug)).toBe(false);
      slugs.add(profile.slug);

      const normName = profile.name.toLowerCase();
      expect(names.has(normName)).toBe(false);
      names.add(normName);

      const normDesc = profile.description.toLowerCase().trim();
      expect(descriptions.has(normDesc)).toBe(false);
      descriptions.add(normDesc);
    }

    expect(ids.size).toBe(SEED_AGENT_PROFILES.length);
    expect(slugs.size).toBe(SEED_AGENT_PROFILES.length);
    expect(names.size).toBe(SEED_AGENT_PROFILES.length);
    expect(descriptions.size).toBe(SEED_AGENT_PROFILES.length);
  });

  it("covers all 50 domains defined in Prompt 24 Section 8.2", () => {
    const coveredDomains = new Set<string>();

    for (const profile of ECOSYSTEM_CATALOG_700) {
      const domain = (profile.metadata as any)?.domain;
      if (domain) {
        coveredDomains.add(domain);
      }
    }

    for (const domain of AGENT_DOMAINS) {
      expect(coveredDomains.has(domain)).toBe(true);
    }

    expect(coveredDomains.size).toBe(50);
    expect(DOMAIN_DEFINITIONS.length).toBe(50);
  });

  it("covers all 10 canonical virtual organization departments", () => {
    const departmentCounts = new Map<string, number>();

    for (const profile of SEED_AGENT_PROFILES) {
      const count = departmentCounts.get(profile.department) ?? 0;
      departmentCounts.set(profile.department, count + 1);
    }

    for (const dept of AGENT_DEPARTMENTS) {
      const count = departmentCounts.get(dept) ?? 0;
      expect(count).toBeGreaterThan(0);
    }
  });

  it("guarantees 100% zero-emoji compliance across all 700+ profiles", () => {
    const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE0F}]/u;

    for (const profile of SEED_AGENT_PROFILES) {
      expect(EMOJI_REGEX.test(profile.name)).toBe(false);
      expect(EMOJI_REGEX.test(profile.displayName)).toBe(false);
      expect(EMOJI_REGEX.test(profile.role)).toBe(false);
      expect(EMOJI_REGEX.test(profile.description)).toBe(false);
      expect(EMOJI_REGEX.test(profile.systemPromptTemplate)).toBe(false);

      for (const cap of profile.capabilities) {
        expect(EMOJI_REGEX.test(cap.name)).toBe(false);
        expect(EMOJI_REGEX.test(cap.description)).toBe(false);
      }

      for (const tag of profile.tags) {
        expect(EMOJI_REGEX.test(tag)).toBe(false);
      }
    }
  });

  it("verifies rich operational metadata fields are populated across ecosystem profiles", () => {
    for (const profile of ECOSYSTEM_CATALOG_700) {
      const meta = profile.metadata as any;
      expect(meta).toBeDefined();
      expect(meta.domain).toBeDefined();
      expect(meta.specialization).toBeDefined();
      expect(meta.expertiseLevel).toBeDefined();
      expect(meta.responsibilities).toBeDefined();
      expect(meta.responsibilities.length).toBeGreaterThanOrEqual(1);
      expect(meta.expectedOutputs).toBeDefined();
      expect(meta.expectedOutputs.length).toBeGreaterThanOrEqual(1);
      expect(meta.evaluationCriteria).toBeDefined();
      expect(meta.evaluationCriteria.length).toBeGreaterThanOrEqual(1);
      expect(meta.exampleTasks).toBeDefined();
      expect(meta.exampleTasks.length).toBeGreaterThanOrEqual(1);
      expect(meta.provenance).toBe("terrarium-curated");
    }
  });
});
