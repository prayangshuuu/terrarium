/**
 * @terrarium/core - registry/agent-registry.ts
 *
 * In-memory and SQLite-backed implementation of AgentRegistry.
 * Manages registered agent roles as data configurations completely separate from execution instances.
 * Operations are strictly metadata-driven and never invoke model providers or start sessions.
 * Aligns with PLAN.md Section 4 & 5 and PLAN_CONTEXT.md Section 5.
 */

import {
  type AgentDepartment,
  type AgentProfile,
  type AgentProfileFilter,
  type AgentProfileInput,
  type AgentRegistry,
  type AgentResolveCriteria,
  type AgentSearchQuery,
  type DomainValidationError,
  type NotFoundError,
  type Result,
  type TerrariumError,
  AgentRegistryError,
  ProfileNotFoundError,
  fail,
  ok,
  validateAgentProfile,
} from "@terrarium/contracts";
import { type AgentProfileRepository } from "@terrarium/contracts";
import { SEED_AGENT_PROFILES } from "./seed-catalog.ts";
import { resolveAgentCandidates, scoreAgentCandidates } from "./capability-matcher.ts";

export interface AgentRegistryOptions {
  readonly repository?: AgentProfileRepository;
  readonly seedProfiles?: readonly AgentProfile[];
  readonly autoSeed?: boolean;
}

export class DefaultAgentRegistry implements AgentRegistry {
  private readonly profilesById = new Map<string, AgentProfile>();
  private readonly profilesBySlug = new Map<string, AgentProfile>();
  private readonly repository?: AgentProfileRepository;

  constructor(options: AgentRegistryOptions = {}) {
    this.repository = options.repository;
    const shouldSeed = options.autoSeed ?? true;
    const initialProfiles = options.seedProfiles ?? SEED_AGENT_PROFILES;

    if (shouldSeed) {
      for (const profile of initialProfiles) {
        this.indexProfileInMemory(profile);
      }
    }
  }

  /**
   * Synchronizes seed profiles to persistent storage if repository is provided.
   */
  async syncToRepository(): Promise<Result<number, TerrariumError>> {
    if (!this.repository) {
      return ok(0);
    }

    let syncedCount = 0;
    for (const profile of this.profilesById.values()) {
      const existing = await this.repository.findById(profile.id);
      if (existing.success && !existing.data) {
        const createRes = await this.repository.create(profile);
        if (createRes.success) {
          syncedCount++;
        }
      }
    }

    return ok(syncedCount);
  }

  /**
   * Registers a new agent profile into the registry.
   * Does NOT start a session or invoke any provider.
   */
  async register(input: AgentProfileInput): Promise<Result<AgentProfile, TerrariumError>> {
    const now = new Date().toISOString();
    const id = input.id ?? `agent-${input.slug}-${Date.now().toString(36)}`;

    // Prepare complete profile object for validation
    const candidate: Record<string, unknown> = {
      id,
      slug: input.slug,
      name: input.name,
      displayName: input.displayName ?? `${input.name} (${input.role})`,
      department: input.department,
      role: input.role,
      description: input.description,
      systemPromptTemplate: input.systemPromptTemplate,
      capabilities: input.capabilities ?? [],
      supportedTasks: input.supportedTasks ?? [],
      constraints: input.constraints ?? input.limits ?? {
        maxTokensPerTurn: 4096,
        maxDelegationDepth: 2,
        maxChildrenTasks: 5,
      },
      limits: input.limits ?? input.constraints ?? {
        maxTokensPerTurn: 4096,
        maxDelegationDepth: 2,
        maxChildrenTasks: 5,
      },
      modelPreference: input.modelPreference ?? { tier: "standard" },
      permissions: input.permissions ?? [],
      version: input.version ?? "1.0.0",
      status: input.status ?? "available",
      tags: input.tags ?? [],
      personaAttributes: input.personaAttributes,
      metadata: input.metadata ?? {},
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    const validationResult = validateAgentProfile(candidate);
    if (!validationResult.success) {
      return fail(validationResult.error);
    }

    const validatedProfile = validationResult.data;

    // Check for duplicate ID or slug in memory
    if (this.profilesById.has(validatedProfile.id)) {
      return fail(
        new AgentRegistryError(
          "register",
          `Agent profile with ID '${validatedProfile.id}' is already registered`
        )
      );
    }
    if (this.profilesBySlug.has(validatedProfile.slug)) {
      return fail(
        new AgentRegistryError(
          "register",
          `Agent profile with slug '${validatedProfile.slug}' is already registered`
        )
      );
    }

    // Persist to repository if configured
    if (this.repository) {
      const repoRes = await this.repository.create(validatedProfile);
      if (!repoRes.success) {
        return fail(repoRes.error);
      }
    }

    // Index in memory
    this.indexProfileInMemory(validatedProfile);

    return ok(validatedProfile);
  }

  /**
   * Lists registered agent profiles with optional filtering.
   * Does NOT start a session or invoke any provider.
   */
  async list(filter: AgentProfileFilter = {}): Promise<Result<readonly AgentProfile[], TerrariumError>> {
    let profiles = Array.from(this.profilesById.values());

    if (filter.department) {
      profiles = profiles.filter((p) => p.department === filter.department);
    }

    if (filter.status) {
      profiles = profiles.filter((p) => p.status === filter.status);
    }

    if (filter.tag) {
      profiles = profiles.filter((p) => p.tags.includes(filter.tag!));
    }

    if (filter.modelTier) {
      profiles = profiles.filter((p) => p.modelPreference.tier === filter.modelTier);
    }

    // Sort stably by department, then name
    profiles.sort((a, b) => {
      if (a.department !== b.department) {
        return a.department.localeCompare(b.department);
      }
      return a.name.localeCompare(b.name);
    });

    const pageSize = filter.pageSize ?? filter.limit;
    const offset =
      filter.offset ??
      (filter.page !== undefined && pageSize !== undefined
        ? Math.max(0, (filter.page - 1) * pageSize)
        : undefined);

    if (offset !== undefined) {
      profiles = profiles.slice(offset);
    }

    if (pageSize !== undefined) {
      profiles = profiles.slice(0, pageSize);
    }

    return ok(profiles);
  }

  /**
   * Safely unregisters and removes an agent profile from memory and storage.
   * Does NOT affect past execution records or historical reports.
   */
  async unregister(idOrSlug: string): Promise<Result<boolean, NotFoundError | TerrariumError>> {
    const profile = this.profilesById.get(idOrSlug) ?? this.profilesBySlug.get(idOrSlug);
    if (!profile) {
      return fail(new ProfileNotFoundError(idOrSlug));
    }

    this.profilesById.delete(profile.id);
    this.profilesBySlug.delete(profile.slug);

    if (this.repository) {
      const deleteRes = await this.repository.delete(profile.id);
      if (!deleteRes.success) {
        return fail(deleteRes.error);
      }
    }

    return ok(true);
  }

  /**
   * Imports multiple agent profiles in bulk, validating each against contracts.
   * Does NOT start any agent processes or invoke providers.
   */
  async importProfiles(profiles: readonly AgentProfileInput[]): Promise<Result<number, TerrariumError>> {
    let imported = 0;
    for (const input of profiles) {
      const res = await this.register(input);
      if (res.success) {
        imported++;
      } else {
        return fail(res.error);
      }
    }
    return ok(imported);
  }

  /**
   * Searches agent profiles using full-text and semantic keyword queries.
   * Does NOT start a session or invoke any provider.
   */
  async search(query: AgentSearchQuery): Promise<Result<readonly AgentProfile[], TerrariumError>> {
    const rawQuery = query.query.toLowerCase().trim();
    if (!rawQuery) {
      return this.list({ department: query.department, status: query.status, limit: query.limit });
    }

    let profiles = Array.from(this.profilesById.values());

    if (query.department) {
      profiles = profiles.filter((p) => p.department === query.department);
    }

    if (query.status) {
      profiles = profiles.filter((p) => p.status === query.status);
    }

    // Rank matching profiles
    const matched = profiles.filter((profile) => {
      const matchName = profile.name.toLowerCase().includes(rawQuery);
      const matchSlug = profile.slug.toLowerCase().includes(rawQuery);
      const matchRole = profile.role.toLowerCase().includes(rawQuery);
      const matchDesc = profile.description.toLowerCase().includes(rawQuery);
      const matchTags = profile.tags.some((t) => t.toLowerCase().includes(rawQuery));
      const matchTasks = profile.supportedTasks.some((t) => t.toLowerCase().includes(rawQuery));
      const matchCaps = profile.capabilities.some(
        (c) =>
          c.name.toLowerCase().includes(rawQuery) ||
          c.description.toLowerCase().includes(rawQuery) ||
          c.keywords?.some((k) => k.toLowerCase().includes(rawQuery))
      );

      return matchName || matchSlug || matchRole || matchDesc || matchTags || matchTasks || matchCaps;
    });

    const limit = query.limit ?? 50;
    return ok(matched.slice(0, limit));
  }

  /**
   * Inspects detailed metadata and configuration for a single agent profile.
   * Does NOT start a session or invoke any provider.
   */
  async inspect(idOrSlug: string): Promise<Result<AgentProfile, NotFoundError | TerrariumError>> {
    const profile = this.profilesById.get(idOrSlug) ?? this.profilesBySlug.get(idOrSlug);
    if (!profile) {
      return fail(new ProfileNotFoundError(idOrSlug));
    }
    return ok(profile);
  }

  /**
   * Enables a previously disabled agent profile.
   * Does NOT start a session or invoke any provider.
   */
  async enable(idOrSlug: string): Promise<Result<AgentProfile, NotFoundError | TerrariumError>> {
    const inspectRes = await this.inspect(idOrSlug);
    if (!inspectRes.success) {
      return inspectRes;
    }

    const current = inspectRes.data;
    const updated: AgentProfile = {
      ...current,
      status: "available",
      updatedAt: new Date().toISOString(),
    };

    if (this.repository) {
      const repoRes = await this.repository.update(updated);
      if (!repoRes.success) {
        return fail(repoRes.error);
      }
    }

    this.indexProfileInMemory(updated);
    return ok(updated);
  }

  /**
   * Disables an agent profile, preventing it from being selected by default.
   * Does NOT start a session or invoke any provider.
   */
  async disable(idOrSlug: string, reason?: string): Promise<Result<AgentProfile, NotFoundError | TerrariumError>> {
    const inspectRes = await this.inspect(idOrSlug);
    if (!inspectRes.success) {
      return inspectRes;
    }

    const current = inspectRes.data;
    const updated: AgentProfile = {
      ...current,
      status: "disabled",
      metadata: {
        ...(current.metadata ?? {}),
        disabledReason: reason ?? "Disabled via registry administration",
        disabledAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    if (this.repository) {
      const repoRes = await this.repository.update(updated);
      if (!repoRes.success) {
        return fail(repoRes.error);
      }
    }

    this.indexProfileInMemory(updated);
    return ok(updated);
  }

  /**
   * Validates raw profile data against boundary schemas.
   * Pure schema validation; does not save or invoke providers.
   */
  validate(profile: unknown): Result<AgentProfile, DomainValidationError> {
    return validateAgentProfile(profile);
  }

  /**
   * Resolves the best-matching agent profiles for a given task or capability criteria.
   * Deterministic scoring; does NOT start a session or invoke any provider.
   */
  async resolve(criteria: AgentResolveCriteria): Promise<Result<readonly AgentProfile[], TerrariumError>> {
    const allProfiles = Array.from(this.profilesById.values());
    const matched = resolveAgentCandidates(allProfiles, criteria);
    return ok(matched);
  }

  /**
   * Returns detailed scoring results for candidate resolution.
   */
  async resolveWithScores(criteria: AgentResolveCriteria) {
    const allProfiles = Array.from(this.profilesById.values());
    return scoreAgentCandidates(allProfiles, criteria);
  }

  /**
   * Returns total registered profile count, optionally filtered by department.
   */
  async count(department?: AgentDepartment): Promise<number> {
    if (department) {
      let c = 0;
      for (const p of this.profilesById.values()) {
        if (p.department === department) c++;
      }
      return c;
    }
    return this.profilesById.size;
  }

  private indexProfileInMemory(profile: AgentProfile): void {
    this.profilesById.set(profile.id, profile);
    this.profilesBySlug.set(profile.slug, profile);
  }
}

/**
 * Creates and initializes an AgentRegistry instance.
 */
export function createAgentRegistry(options: AgentRegistryOptions = {}): AgentRegistry {
  return new DefaultAgentRegistry(options);
}
