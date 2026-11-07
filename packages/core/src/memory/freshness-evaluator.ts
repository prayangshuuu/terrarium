/**
 * @terrarium/core - memory/freshness-evaluator.ts
 *
 * Evaluates memory freshness, age, and staleness based on domain category TTL rules.
 * Aligns with PLAN.md Section 14 (Memory & Knowledge Management) and PLAN_CONTEXT.md Section 6.
 */

import {
  type MemoryCategory,
  type MemoryFreshnessStatus,
  type MemoryItem,
} from "@terrarium/contracts";

/**
 * Category-specific freshness window in milliseconds.
 * Defines the duration after which an unvalidated memory item is deemed stale.
 */
export const CATEGORY_FRESHNESS_WINDOWS_MS: Readonly<Record<MemoryCategory, number>> = {
  // High volatility / rapid invalidation
  open_question: 7 * 24 * 60 * 60 * 1000, // 7 days
  research_finding: 14 * 24 * 60 * 60 * 1000, // 14 days
  agent_summary: 14 * 24 * 60 * 60 * 1000, // 14 days

  // Medium volatility
  known_risk: 30 * 24 * 60 * 60 * 1000, // 30 days
  project_overview: 60 * 24 * 60 * 60 * 1000, // 60 days
  confirmed_requirement: 90 * 24 * 60 * 60 * 1000, // 90 days

  // Durable / architectural decisions
  user_preference: 180 * 24 * 60 * 60 * 1000, // 180 days
  architecture_knowledge: 180 * 24 * 60 * 60 * 1000, // 180 days
  decision_rationale: 365 * 24 * 60 * 60 * 1000, // 1 year
};

export interface FreshnessEvaluation {
  readonly status: MemoryFreshnessStatus;
  readonly ageMs: number;
  readonly ageDays: number;
  readonly freshnessScore: number; // 1.0 = brand new/validated, 0.0 = completely expired
  readonly isStale: boolean;
  readonly requiresRevalidation: boolean;
}

/**
 * Evaluates the freshness status and score of a memory item against current wall-clock time.
 */
export function evaluateMemoryFreshness(
  item: MemoryItem,
  referenceTimeMs = Date.now()
): FreshnessEvaluation {
  // If explicitly marked superseded, honor that status directly
  if (item.freshnessStatus === "superseded") {
    return {
      status: "superseded",
      ageMs: 0,
      ageDays: 0,
      freshnessScore: 0.0,
      isStale: true,
      requiresRevalidation: false,
    };
  }

  // Anchor to lastValidatedAt, or fall back to updatedAt or createdAt
  const anchorTimeStr = item.lastValidatedAt ?? item.updatedAt ?? item.createdAt;
  const anchorTimeMs = new Date(anchorTimeStr).getTime();
  const ageMs = Math.max(0, referenceTimeMs - anchorTimeMs);
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

  const windowMs = CATEGORY_FRESHNESS_WINDOWS_MS[item.category] ?? (30 * 24 * 60 * 60 * 1000);
  const expiryWindowMs = windowMs * 2;

  let status: MemoryFreshnessStatus = "fresh";
  let freshnessScore = 1.0;

  if (ageMs > expiryWindowMs) {
    status = "expired";
    freshnessScore = 0.0;
  } else if (ageMs > windowMs) {
    status = "stale";
    // Linear degradation from 0.5 down to 0.0 during the expiration window
    const progressIntoStale = (ageMs - windowMs) / windowMs;
    freshnessScore = Math.max(0, 0.5 * (1 - progressIntoStale));
  } else {
    status = "fresh";
    // Linear degradation from 1.0 down to 0.5 within the fresh window
    const progress = ageMs / windowMs;
    freshnessScore = 1.0 - 0.5 * progress;
  }

  const isStale = status === "stale" || status === "expired";
  const requiresRevalidation = isStale;

  return {
    status,
    ageMs,
    ageDays,
    freshnessScore: Number(freshnessScore.toFixed(3)),
    isStale,
    requiresRevalidation,
  };
}
