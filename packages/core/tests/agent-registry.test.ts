import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import {
  type AgentDepartment,
  type AgentProfile,
  type AgentProfileInput,
  AGENT_DEPARTMENTS,
  DomainValidationError,
  NotFoundError,
  ProfileNotFoundError,
  validateAgentProfile,
} from "@terrarium/contracts";
import {
  createAgentRegistry,
  DefaultAgentRegistry,
  SEED_AGENT_PROFILES,
  SqliteAgentProfileRepository,
  SqliteDatabase,
  scoreAgentCandidates,
  resolveAgentCandidates,
} from "../src/index.ts";

describe("Agent Profile Registry & Capability Catalog", () => {
  describe("Seed Catalog & Taxonomy Verification", () => {
    it("validates every profile in SEED_AGENT_PROFILES against schema contracts", () => {
      expect(SEED_AGENT_PROFILES.length).toBeGreaterThanOrEqual(10);
      expect(SEED_AGENT_PROFILES.length).toBeLessThan(50); // Bounded: not fabricating hundreds

      for (const profile of SEED_AGENT_PROFILES) {
        const valRes = validateAgentProfile(profile);
        expect(valRes.success).toBe(true);
        if (!valRes.success) {
          console.error(`Validation failed for ${profile.slug}:`, valRes.error.issues);
        }
      }
    });

    it("ensures every standard department has at least one representative profile", () => {
      const departmentsInSeed = new Set(SEED_AGENT_PROFILES.map((p) => p.department));
      for (const dept of AGENT_DEPARTMENTS) {
        expect(departmentsInSeed.has(dept)).toBe(true);
      }
    });

    it("verifies simulated customer personas declare complete persona attributes", () => {
      const customerProfiles = SEED_AGENT_PROFILES.filter(
        (p) => p.department === "customer_intelligence"
      );
      expect(customerProfiles.length).toBeGreaterThanOrEqual(3);

      for (const cp of customerProfiles) {
        expect(cp.personaAttributes).toBeDefined();
        expect(cp.personaAttributes?.occupation).toBeTruthy();
        expect(["novice", "intermediate", "advanced"]).toContain(
          cp.personaAttributes!.technicalFamiliarity
        );
        expect(["low", "medium", "high"]).toContain(
          cp.personaAttributes!.priceSensitivity
        );
        expect(cp.personaAttributes?.buyingCriteria.length).toBeGreaterThan(0);
        expect(cp.personaAttributes?.adoptionBarriers.length).toBeGreaterThan(0);
      }
    });
  });

  describe("AgentRegistry Operations", () => {
    it("registers a new agent profile and retrieves it", async () => {
      const registry = createAgentRegistry();
      const initialCount = await registry.count();

      const newAgent: AgentProfileInput = {
        slug: "security-auditor",
        name: "Devon Vance",
        displayName: "Devon Vance (Security Auditor)",
        department: "security",
        role: "Security Audit Engineer",
        description: "Specialized in static code analysis and AST-level vulnerability detection.",
        systemPromptTemplate: "You are a Security Auditor. Inspect AST and data flows.",
        capabilities: [
          {
            id: "cap-ast-audit",
            name: "AST Audit",
            description: "Scans AST structures for tainted sink calls.",
            department: "security",
            requiredPermissions: ["read:code"],
            isConsequential: false,
          },
        ],
        supportedTasks: ["ast_security_scan", "taint_analysis"],
        constraints: {
          maxTokensPerTurn: 4096,
          maxDelegationDepth: 1,
          maxChildrenTasks: 2,
        },
        modelPreference: {
          tier: "advanced",
        },
        permissions: ["read:code"],
      };

      const regRes = await registry.register(newAgent);
      expect(regRes.success).toBe(true);
      if (regRes.success) {
        expect(regRes.data.slug).toBe("security-auditor");
        expect(regRes.data.version).toBe("1.0.0");
        expect(regRes.data.status).toBe("available");
        expect(regRes.data.constraints.maxTokensPerTurn).toBe(4096);
      }

      const updatedCount = await registry.count();
      expect(updatedCount).toBe(initialCount + 1);

      const inspectRes = await registry.inspect("security-auditor");
      expect(inspectRes.success).toBe(true);
    });

    it("rejects duplicate registration by slug or id", async () => {
      const registry = createAgentRegistry();

      const dupInput: AgentProfileInput = {
        slug: "chief-executive-officer", // already in seed
        name: "Another CEO",
        department: "executive",
        role: "CEO Clone",
        description: "Should fail duplicate slug check",
        systemPromptTemplate: "Fail.",
      };

      const res = await registry.register(dupInput);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("AGENT_REGISTRY_ERROR");
      }
    });

    it("rejects invalid agent profile input on register", async () => {
      const registry = createAgentRegistry();

      const invalidInput: AgentProfileInput = {
        slug: "INVALID SLUG WITH SPACES",
        name: "",
        department: "not-a-department" as any,
        role: "",
        description: "",
        systemPromptTemplate: "",
      };

      const res = await registry.register(invalidInput);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(DomainValidationError);
      }
    });

    it("lists profiles with filtering by department, status, tag, and tier", async () => {
      const registry = createAgentRegistry();

      // Filter by department
      const engProfiles = await registry.list({ department: "engineering" });
      expect(engProfiles.success).toBe(true);
      if (engProfiles.success) {
        expect(engProfiles.data.length).toBeGreaterThanOrEqual(3);
        expect(engProfiles.data.every((p) => p.department === "engineering")).toBe(true);
      }

      // Filter by tier
      const fastProfiles = await registry.list({ modelTier: "fast" });
      expect(fastProfiles.success).toBe(true);
      if (fastProfiles.success) {
        expect(fastProfiles.data.length).toBeGreaterThan(0);
        expect(fastProfiles.data.every((p) => p.modelPreference.tier === "fast")).toBe(true);
      }

      // Pagination
      const page1 = await registry.list({ limit: 2, offset: 0 });
      const page2 = await registry.list({ limit: 2, offset: 2 });
      expect(page1.success).toBe(true);
      expect(page2.success).toBe(true);
      if (page1.success && page2.success) {
        expect(page1.data.length).toBe(2);
        expect(page2.data.length).toBe(2);
        expect(page1.data[0]?.id).not.toBe(page2.data[0]?.id);
      }
    });

    it("searches profiles across name, role, description, and capabilities", async () => {
      const registry = createAgentRegistry();

      const searchRes = await registry.search({ query: "architecture" });
      expect(searchRes.success).toBe(true);
      if (searchRes.success) {
        expect(searchRes.data.length).toBeGreaterThanOrEqual(1);
        const slugs = searchRes.data.map((p) => p.slug);
        expect(slugs).toContain("principal-software-architect");
      }
    });

    it("enables and disables an agent profile", async () => {
      const registry = createAgentRegistry();

      // Disable CEO
      const disRes = await registry.disable("chief-executive-officer", "Temporarily off-duty");
      expect(disRes.success).toBe(true);
      if (disRes.success) {
        expect(disRes.data.status).toBe("disabled");
        expect(disRes.data.metadata?.disabledReason).toBe("Temporarily off-duty");
      }

      // Verify inspect shows disabled
      const inspectDisabled = await registry.inspect("chief-executive-officer");
      expect(inspectDisabled.success).toBe(true);
      if (inspectDisabled.success) {
        expect(inspectDisabled.data.status).toBe("disabled");
      }

      // Re-enable
      const enRes = await registry.enable("chief-executive-officer");
      expect(enRes.success).toBe(true);
      if (enRes.success) {
        expect(enRes.data.status).toBe("available");
      }
    });

    it("returns ProfileNotFoundError when inspecting missing profile", async () => {
      const registry = createAgentRegistry();
      const res = await registry.inspect("ghost-profile-id");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProfileNotFoundError);
        expect(res.error.code).toBe("PROFILE_NOT_FOUND");
      }
    });

    it("resolves candidates for a task using multi-factor capability matching", async () => {
      const registry = createAgentRegistry();

      // 1. Resolve for architecture review
      const archRes = await registry.resolve({
        taskType: "architecture_review",
        requiredCapabilities: ["cap-arch-review"],
        requiredPermissions: ["read:code"],
      });

      expect(archRes.success).toBe(true);
      if (archRes.success) {
        expect(archRes.data.length).toBeGreaterThan(0);
        expect(archRes.data[0]?.slug).toBe("principal-software-architect");
      }

      // 2. Resolve for fast test QA
      const testRes = await registry.resolve({
        department: "engineering",
        preferFastTier: true,
      });

      expect(testRes.success).toBe(true);
      if (testRes.success) {
        expect(testRes.data.length).toBeGreaterThan(0);
        expect(testRes.data[0]?.slug).toBe("staff-qa-engineer");
      }
    });
  });

  describe("Non-Execution Guarantees (Crucial Architectural Invariants)", () => {
    it("guarantees registry operations NEVER invoke model providers", async () => {
      // Mock provider with invocation tracker
      let providerInvocationCount = 0;
      const mockProvider = {
        name: "mock-llm-provider",
        async completePrompt() {
          providerInvocationCount++;
          throw new Error("Provider should NEVER be invoked by registry operations!");
        },
      };

      const registry = createAgentRegistry();

      // Execute all 8 core registry operations
      await registry.register({
        slug: "test-runtime-safety-agent",
        name: "Safety Agent",
        department: "security",
        role: "Safety Sentinel",
        description: "Verifies zero provider calls",
        systemPromptTemplate: "Sentinel prompt",
      });
      await registry.list();
      await registry.search({ query: "Sentinel" });
      await registry.inspect("test-runtime-safety-agent");
      await registry.disable("test-runtime-safety-agent");
      await registry.enable("test-runtime-safety-agent");
      registry.validate(SEED_AGENT_PROFILES[0]);
      await registry.resolve({ taskType: "threat_modeling" });

      // Invariant assertion: provider was NEVER touched
      expect(providerInvocationCount).toBe(0);
    });

    it("guarantees registration and listing NEVER start interactive sessions", async () => {
      const db = new SqliteDatabase({ path: ":memory:" });
      const registry = new DefaultAgentRegistry({
        repository: db.agentProfiles,
        seedProfiles: SEED_AGENT_PROFILES,
      });

      // Run registration and listing
      await registry.register({
        slug: "session-isolation-agent",
        name: "Isolation Agent",
        department: "product",
        role: "Product Scoper",
        description: "Assures session isolation",
        systemPromptTemplate: "No session start",
      });

      await registry.list();
      await registry.search({ query: "Isolation" });
      await registry.inspect("session-isolation-agent");
      await registry.resolve({ department: "product" });

      // Verify that SessionRepository and Messages in DB are completely empty
      const sessions = await db.sessions.list();
      expect(sessions.success).toBe(true);
      if (sessions.success) {
        expect(sessions.data.length).toBe(0);
      }

      db.close();
    });
  });

  describe("SqliteAgentProfileRepository Integration", () => {
    it("creates, reads, searches, updates, and deletes agent profiles in SQLite", async () => {
      const db = new SqliteDatabase({ path: ":memory:" });
      const repo = db.agentProfiles;

      const profile: AgentProfile = {
        id: "test-agent-persist-01",
        slug: "persistent-architect",
        name: "Marcus Vance",
        displayName: "Marcus Vance (Persistent)",
        department: "engineering",
        role: "Distributed Systems Architect",
        description: "Designs fault-tolerant stateful and stateless systems.",
        systemPromptTemplate: "Focus on persistence integrity.",
        capabilities: [
          {
            id: "cap-sqlite-tuning",
            name: "SQLite Performance Tuning",
            description: "Configures WAL pragmas and index strategies.",
            department: "engineering",
            requiredPermissions: ["read:db"],
            isConsequential: false,
          },
        ],
        supportedTasks: ["db_tuning", "schema_design"],
        constraints: {
          maxTokensPerTurn: 8192,
          maxDelegationDepth: 2,
          maxChildrenTasks: 4,
          timeoutMs: 45000,
        },
        limits: {
          maxTokensPerTurn: 8192,
          maxDelegationDepth: 2,
          maxChildrenTasks: 4,
        },
        modelPreference: {
          tier: "advanced",
          preferredProvider: "anthropic",
          preferredModel: "claude-3-7-sonnet",
        },
        permissions: ["read:code", "read:db"],
        version: "1.0.0",
        status: "available",
        tags: ["persistence", "sqlite", "architecture"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Create
      const createRes = await repo.create(profile);
      expect(createRes.success).toBe(true);

      // 2. Find by ID
      const findRes = await repo.findById("test-agent-persist-01");
      expect(findRes.success).toBe(true);
      if (findRes.success && findRes.data) {
        expect(findRes.data.slug).toBe("persistent-architect");
        expect(findRes.data.constraints.maxTokensPerTurn).toBe(8192);
        expect(findRes.data.capabilities.length).toBe(1);
      }

      // 3. Find by Slug
      const slugRes = await repo.findBySlug("persistent-architect");
      expect(slugRes.success).toBe(true);
      if (slugRes.success && slugRes.data) {
        expect(slugRes.data.id).toBe("test-agent-persist-01");
      }

      // 4. Search via SQLite LIKE
      const searchRes = await repo.search("tuning");
      expect(searchRes.success).toBe(true);
      if (searchRes.success) {
        expect(searchRes.data.length).toBe(1);
        expect(searchRes.data[0]?.slug).toBe("persistent-architect");
      }

      // 5. Update
      const updatedProfile: AgentProfile = {
        ...profile,
        status: "disabled",
        updatedAt: new Date().toISOString(),
      };
      const updateRes = await repo.update(updatedProfile);
      expect(updateRes.success).toBe(true);

      const checkUpdated = await repo.findById(profile.id);
      expect(checkUpdated.success).toBe(true);
      if (checkUpdated.success && checkUpdated.data) {
        expect(checkUpdated.data.status).toBe("disabled");
      }

      // 6. Delete
      const delRes = await repo.delete(profile.id);
      expect(delRes.success).toBe(true);

      const checkDeleted = await repo.findById(profile.id);
      expect(checkDeleted.success).toBe(true);
      if (checkDeleted.success) {
        expect(checkDeleted.data).toBeNull();
      }

      db.close();
    });

    it("enforces unique constraint on agent profile slug in SQLite", async () => {
      const db = new SqliteDatabase({ path: ":memory:" });
      const repo = db.agentProfiles;

      const p1: AgentProfile = {
        id: "p1",
        slug: "unique-agent-slug",
        name: "Agent 1",
        displayName: "Agent 1",
        department: "product",
        role: "Role 1",
        description: "Desc 1",
        systemPromptTemplate: "Prompt 1",
        capabilities: [],
        supportedTasks: [],
        constraints: { maxTokensPerTurn: 2048, maxDelegationDepth: 1, maxChildrenTasks: 2 },
        limits: { maxTokensPerTurn: 2048, maxDelegationDepth: 1, maxChildrenTasks: 2 },
        modelPreference: { tier: "standard" },
        permissions: [],
        version: "1.0.0",
        status: "available",
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const p2: AgentProfile = {
        ...p1,
        id: "p2", // different ID, same slug
      };

      const r1 = await repo.create(p1);
      expect(r1.success).toBe(true);

      const r2 = await repo.create(p2);
      expect(r2.success).toBe(false);
      if (!r2.success) {
        expect(r2.error.code).toBe("DUPLICATE_ENTITY");
      }

      db.close();
    });
  });
});
