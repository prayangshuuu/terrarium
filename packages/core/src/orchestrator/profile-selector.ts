/**
 * @terrarium/core - orchestrator/profile-selector.ts
 *
 * Demand-based agent profile selector evaluating relevance, capability, uncertainty,
 * risk, permissions, and budget constraints.
 *
 * Invariant: Strictly separates declarative profile selection from runtime execution creation.
 * Aligns with PLAN.md Section 5.1 & PLAN_CONTEXT.md Section 5.
 */

import {
  type AgentMatchScore,
  type AgentProfile,
  type AgentRegistry,
  type ProfileSelectionCriteria,
  type ProfileSelectionDecision,
  type Result,
  type TerrariumError,
  ok,
  fail,
  NotFoundError,
} from "@terrarium/contracts";

export interface ProfileSelectorOptions {
  readonly registry: AgentRegistry;
}

export class ProfileSelector {
  private readonly registry: AgentRegistry;

  constructor(options: ProfileSelectorOptions) {
    this.registry = options.registry;
  }

  /**
   * Selects the single best-matching agent profile for an execution step.
   * Strictly declarative: computes decision and explainability WITHOUT creating Execution instances.
   */
  async selectProfileForStep(
    criteria: ProfileSelectionCriteria
  ): Promise<Result<ProfileSelectionDecision, TerrariumError>> {
    const listRes = await this.registry.list();
    if (!listRes.success) {
      return fail(listRes.error);
    }

    const allProfiles = listRes.data;
    const scoredCandidates: AgentMatchScore[] = [];

    for (const profile of allProfiles) {
      if (profile.status !== "available") {
        continue;
      }

      // Hard Permission Gate: Profile must declare required permissions
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

      // 1. Department match
      if (profile.department === criteria.department) {
        score += 35;
        reasons.push(`Exact department match (${profile.department})`);
      } else if (criteria.step.department === profile.department) {
        score += 25;
        reasons.push(`Matches step department (${profile.department})`);
      }

      // 2. Task Type match
      const taskTypeLower = criteria.taskType.toLowerCase();
      if (profile.supportedTasks.some((t) => t.toLowerCase() === taskTypeLower)) {
        score += 35;
        matchedTasks.push(criteria.taskType);
        reasons.push(`Declared support for task '${criteria.taskType}'`);
      }

      // 3. Capability match
      const reqCaps = criteria.requiredCapabilities.length > 0
        ? criteria.requiredCapabilities
        : criteria.step.candidateCapabilities;

      for (const reqCap of reqCaps) {
        const reqLower = reqCap.toLowerCase();
        const found = profile.capabilities.find((c) => {
          const nameLower = c.name.toLowerCase();
          const idLower = c.id.toLowerCase();
          const catLower = c.category?.toLowerCase() ?? "";
          return (
            idLower === reqLower ||
            nameLower === reqLower ||
            catLower === reqLower ||
            c.keywords?.some((k) => {
              const kLower = k.toLowerCase();
              return kLower === reqLower || reqLower.includes(kLower) || kLower.includes(reqLower);
            })
          );
        });

        if (found) {
          score += 25;
          matchedCapabilities.push(found.id);
          reasons.push(`Possesses capability '${found.name}'`);
        }
      }

      // 4. Uncertainty sensitivity: high uncertainty favors analytical/research profiles
      if (criteria.uncertaintyLevel === "high") {
        const hasDeepAnalysis = profile.capabilities.some(
          (c) =>
            c.category === "architecture" ||
            c.category === "strategy" ||
            c.category === "synthesis" ||
            c.id.includes("research") ||
            c.id.includes("investigation")
        );
        if (hasDeepAnalysis) {
          score += 20;
          reasons.push("Preferred for high epistemic uncertainty investigation");
        }
      }

      // 5. Risk sensitivity: high or critical risk favors security/reliability profiles
      if (criteria.riskLevel === "high" || criteria.riskLevel === "critical") {
        const hasRiskMitigation =
          profile.capabilities.some(
            (c) =>
              c.category === "security" ||
              c.category === "quality" ||
              c.category === "contracts"
          ) ||
          profile.permissions.includes("eval:security") ||
          profile.permissions.includes("audit:code");
        if (hasRiskMitigation) {
          score += 25;
          reasons.push("Strong safety & risk verification capability");
        }
      }

      // 6. Budget awareness: when budget is low, prioritize fast-tier models
      if (criteria.budgetRemainingUsd < 0.15) {
        if (profile.modelPreference.tier === "fast") {
          score += 20;
          reasons.push("Fast model tier preferred for remaining budget preservation");
        } else if (profile.modelPreference.tier === "advanced") {
          score -= 15;
          reasons.push("Advanced model tier penalized due to tight remaining budget");
        }
      }

      // 7. Approved plan affinity: candidate slug specified in plan step
      if (criteria.step.candidateAgentSlugs.includes(profile.slug)) {
        score += 15;
        reasons.push("Designated candidate in approved plan step");
      }

      if (score > 0) {
        scoredCandidates.push({
          profile,
          score,
          reasons,
          matchedCapabilities,
          matchedTasks,
        });
      }
    }

    if (scoredCandidates.length === 0) {
      return fail(
        new NotFoundError(
          "AgentProfile",
          `department:${criteria.department},capabilities:${criteria.requiredCapabilities.join(",")}`
        )
      );
    }

    // Sort descending by score, tie-break alphabetically by display name
    scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.profile.displayName.localeCompare(b.profile.displayName);
    });

    const topMatch = scoredCandidates[0]!;
    const dormantCount = allProfiles.length - 1;

    const rationale = `Selected '${topMatch.profile.displayName}' [${topMatch.profile.slug}] (score: ${topMatch.score}) based on: ${topMatch.reasons.join(
      "; "
    )}. ${dormantCount} registered profiles remain dormant.`;

    return ok({
      stepId: criteria.step.id,
      selectedProfile: topMatch.profile,
      candidateScores: scoredCandidates,
      rationale,
      dormantProfileCount: dormantCount,
    });
  }

  /**
   * Compiles an activation audit demonstrating which profiles were activated vs remaining dormant.
   */
  async getDormancyReport(
    activeProfileIds: ReadonlySet<string>
  ): Promise<Result<{ active: AgentProfile[]; dormant: AgentProfile[] }, TerrariumError>> {
    const listRes = await this.registry.list();
    if (!listRes.success) {
      return fail(listRes.error);
    }

    const active: AgentProfile[] = [];
    const dormant: AgentProfile[] = [];

    for (const profile of listRes.data) {
      if (activeProfileIds.has(profile.id) || activeProfileIds.has(profile.slug)) {
        active.push(profile);
      } else {
        dormant.push(profile);
      }
    }

    return ok({ active, dormant });
  }
}

/**
 * Factory for ProfileSelector.
 */
export function createProfileSelector(options: ProfileSelectorOptions): ProfileSelector {
  return new ProfileSelector(options);
}
