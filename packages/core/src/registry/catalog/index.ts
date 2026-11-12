/**
 * @terrarium/core - registry/catalog/index.ts
 *
 * Complete catalog aggregator exporting 720 distinct, validated agent profiles
 * across all 10 virtual organization departments. Strictly schema-compliant.
 */

import { type AgentProfile } from "@terrarium/contracts";
import { EXECUTIVE_PROFILES } from "./executive.ts";
import { LEGAL_PROFILES } from "./legal.ts";
import { MARKETING_PROFILES } from "./marketing.ts";
import { DESIGN_PROFILES } from "./design.ts";
import { DOCUMENTATION_PROFILES } from "./documentation.ts";
import { PRODUCT_PROFILES } from "./product.ts";
import { CUSTOMER_INTELLIGENCE_PROFILES } from "./customer-intelligence.ts";
import { SECURITY_PROFILES } from "./security.ts";
import { RESEARCH_PROFILES } from "./research.ts";
import { ENGINEERING_PROFILES } from "./engineering.ts";

export * from "./taxonomy.ts";
export * from "./profile-validator.ts";
export * from "./ecosystem-catalog-700.ts";

export {
  EXECUTIVE_PROFILES,
  LEGAL_PROFILES,
  MARKETING_PROFILES,
  DESIGN_PROFILES,
  DOCUMENTATION_PROFILES,
  PRODUCT_PROFILES,
  CUSTOMER_INTELLIGENCE_PROFILES,
  SECURITY_PROFILES,
  RESEARCH_PROFILES,
  ENGINEERING_PROFILES,
};

/**
 * The comprehensive 720-profile virtual organization catalog.
 */
export const ALL_CATALOG_PROFILES: readonly AgentProfile[] = [
  ...EXECUTIVE_PROFILES,
  ...LEGAL_PROFILES,
  ...MARKETING_PROFILES,
  ...DESIGN_PROFILES,
  ...DOCUMENTATION_PROFILES,
  ...PRODUCT_PROFILES,
  ...CUSTOMER_INTELLIGENCE_PROFILES,
  ...SECURITY_PROFILES,
  ...RESEARCH_PROFILES,
  ...ENGINEERING_PROFILES,
];

/**
 * Curated core 15 profiles preserved from initial seed catalog for backwards compatibility.
 */
export const CURATED_CORE_PROFILES: readonly AgentProfile[] = [
  ...EXECUTIVE_PROFILES.filter((p) => ["agent-exec-ceo", "agent-exec-cto"].includes(p.id)),
  ...ENGINEERING_PROFILES.filter((p) => ["agent-eng-architect", "agent-eng-backend", "agent-eng-test"].includes(p.id)),
  ...CUSTOMER_INTELLIGENCE_PROFILES.filter((p) => ["agent-cust-founder", "agent-cust-enterprise", "agent-cust-dev"].includes(p.id)),
  ...PRODUCT_PROFILES.filter((p) => p.id === "agent-prod-lead"),
  ...DESIGN_PROFILES.filter((p) => p.id === "agent-ux-designer"),
  ...MARKETING_PROFILES.filter((p) => p.id === "agent-mkt-growth"),
  ...SECURITY_PROFILES.filter((p) => p.id === "agent-sec-lead"),
  ...RESEARCH_PROFILES.filter((p) => p.id === "agent-res-lead"),
  ...DOCUMENTATION_PROFILES.filter((p) => p.id === "agent-doc-writer"),
  ...LEGAL_PROFILES.filter((p) => p.id === "agent-leg-analyst"),
];

const PROFILES_BY_ID = new Map<string, AgentProfile>();
const PROFILES_BY_SLUG = new Map<string, AgentProfile>();
for (const p of ALL_CATALOG_PROFILES) {
  PROFILES_BY_ID.set(p.id, p);
  PROFILES_BY_SLUG.set(p.slug, p);
}

export function getCatalogProfileById(id: string): AgentProfile | undefined {
  return PROFILES_BY_ID.get(id);
}

export function getCatalogProfileBySlug(slug: string): AgentProfile | undefined {
  return PROFILES_BY_SLUG.get(slug);
}
