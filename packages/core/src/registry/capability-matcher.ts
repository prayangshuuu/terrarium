/**
 * @terrarium/core - registry/capability-matcher.ts
 *
 * Multi-factor agent capability matching and resolution engine.
 * Pure deterministic algorithmic evaluation; never invokes model providers or starts sessions.
 * Aligns with PLAN.md Section 5 (Demand-Based Activation and Orchestration).
 */

import {
  type AgentMatchScore,
  type AgentProfile,
  type AgentResolveCriteria,
} from "@terrarium/contracts";

/**
 * Evaluates candidate agent profiles against resolution criteria.
 * Returns scored match records sorted descending by match score.
 */
export function scoreAgentCandidates(
  profiles: readonly AgentProfile[],
  criteria: AgentResolveCriteria
): AgentMatchScore[] {
  const scores: AgentMatchScore[] = [];

  for (const profile of profiles) {
    // 1. Status and disabled check
    if (!criteria.includeDisabled && profile.status === "disabled") {
      continue;
    }
    if (criteria.status && profile.status !== criteria.status) {
      continue;
    }

    // 2. Permission check: profile must satisfy all required permissions
    if (criteria.requiredPermissions && criteria.requiredPermissions.length > 0) {
      const hasAllPermissions = criteria.requiredPermissions.every((perm) =>
        profile.permissions.includes(perm)
      );
      if (!hasAllPermissions) {
        continue;
      }
    }

    let score = 0;
    const reasons: string[] = [];
    const matchedCapabilities: string[] = [];
    const matchedTasks: string[] = [];

    // 3. Department match
    if (criteria.department) {
      if (profile.department === criteria.department) {
        score += 30;
        reasons.push(`Exact department match (${profile.department})`);
      } else {
        // Different department requested; if explicitly filtering by dept, skip
        continue;
      }
    }

    // 4. Task type match
    if (criteria.taskType) {
      const targetTask = criteria.taskType.toLowerCase().trim();
      const directTaskMatch = profile.supportedTasks.some(
        (t) => t.toLowerCase() === targetTask
      );

      if (directTaskMatch) {
        score += 40;
        matchedTasks.push(criteria.taskType);
        reasons.push(`Declared support for task type '${criteria.taskType}'`);
      } else {
        // Partial or keyword task match
        const partialTaskMatch = profile.supportedTasks.some(
          (t) => t.toLowerCase().includes(targetTask) || targetTask.includes(t.toLowerCase())
        );
        if (partialTaskMatch) {
          score += 20;
          matchedTasks.push(criteria.taskType);
          reasons.push(`Partial task match for '${criteria.taskType}'`);
        }
      }
    }

    // 5. Capability requirements
    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      for (const requiredCap of criteria.requiredCapabilities) {
        const reqLower = requiredCap.toLowerCase();
        const found = profile.capabilities.find(
          (c) =>
            c.id.toLowerCase() === reqLower ||
            c.name.toLowerCase() === reqLower ||
            c.category?.toLowerCase() === reqLower ||
            c.keywords?.some((k) => k.toLowerCase() === reqLower)
        );

        if (found) {
          score += 25;
          matchedCapabilities.push(found.id);
          reasons.push(`Possesses required capability '${found.name}'`);
        }
      }

      // If requiredCapabilities were specified and none matched, disqualify
      if (matchedCapabilities.length === 0) {
        continue;
      }
    }

    // 6. Tag matches
    if (criteria.tags && criteria.tags.length > 0) {
      for (const tag of criteria.tags) {
        const tagLower = tag.toLowerCase();
        if (profile.tags.some((t) => t.toLowerCase() === tagLower)) {
          score += 5;
          reasons.push(`Matching tag '${tag}'`);
        }
      }
    }

    // 7. Operational status preferences
    if (profile.status === "available") {
      score += 10;
    }

    // 8. Model tier preference
    if (criteria.preferFastTier && profile.modelPreference.tier === "fast") {
      score += 15;
      reasons.push("Matches preferred fast model tier");
    }

    // Only include if there is a positive match signal or no criteria were specified
    if (score > 0 || (Object.keys(criteria).length === 0)) {
      scores.push({
        profile,
        score,
        matchedCapabilities,
        matchedTasks,
        reasons,
      });
    }
  }

  // Sort by score descending; break ties by name alphabetically
  scores.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.profile.name.localeCompare(b.profile.name);
  });

  return scores;
}

/**
 * Resolves candidate agent profiles matching given criteria.
 */
export function resolveAgentCandidates(
  profiles: readonly AgentProfile[],
  criteria: AgentResolveCriteria
): AgentProfile[] {
  const scored = scoreAgentCandidates(profiles, criteria);
  return scored.map((s) => s.profile);
}
