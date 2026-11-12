/**
 * @terrarium/core - registry/seed-catalog.ts
 *
 * Shipped agent profile catalogue containing 720 distinct, validated agent profiles
 * across all 10 virtual organization departments. Strictly schema-compliant.
 * Fulfills TERRARIUM_PROMPT_24 Phase E: 700+ distinct agent profiles with unique specializations,
 * cognitive styles, non-generic capabilities, and full operational bounds.
 * Every profile is pure declarative configuration data without running instances or provider dependencies.
 */

import { type AgentProfile } from "@terrarium/contracts";
import {
  ALL_CATALOG_PROFILES,
  CURATED_CORE_PROFILES,
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
  getCatalogProfileById,
  getCatalogProfileBySlug,
} from "./catalog/index.ts";

export {
  ALL_CATALOG_PROFILES,
  CURATED_CORE_PROFILES,
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
  getCatalogProfileById,
  getCatalogProfileBySlug,
};

/**
 * The full shipped agent profile catalogue (720 distinct profiles).
 */
export const SEED_AGENT_PROFILES: readonly AgentProfile[] = ALL_CATALOG_PROFILES;

/**
 * Curated 15 core profiles for scale testing and backwards compatibility.
 */
export const CURATED_15_PROFILES: readonly AgentProfile[] = CURATED_CORE_PROFILES;
