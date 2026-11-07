import { describe, it, expect } from "bun:test";
import {
  MEMORY_CATEGORIES,
  MEMORY_CONFIDENCE_LEVELS,
  MEMORY_FRESHNESS_STATUSES,
  MEMORY_CONFLICT_RESOLUTIONS,
  MEMORY_SOURCE_TYPES,
  validateMemoryProvenance,
  validateMemoryItem,
  validateArtifactReference,
  validateAgentContextPackage,
  type MemoryItem,
  type AgentContextPackage,
  MemoryNotFoundError,
  MemoryConflictError,
  StaleMemoryError,
  ContextBudgetExceededError,
  CrossProjectContextLeakError,
  MEMORY_FRESHNESS_UI,
  MEMORY_CONFIDENCE_UI,
  MEMORY_CATEGORY_UI,
} from "../src/index.ts";

describe("Memory & Context Domain Contracts Suite (A1 & A5)", () => {
  const now = new Date().toISOString();

  it("exports canonical memory categories matching PLAN.md Section 14", () => {
    expect(MEMORY_CATEGORIES).toContain("project_overview");
    expect(MEMORY_CATEGORIES).toContain("confirmed_requirement");
    expect(MEMORY_CATEGORIES).toContain("decision_rationale");
    expect(MEMORY_CATEGORIES).toContain("architecture_knowledge");
    expect(MEMORY_CATEGORIES).toContain("research_finding");
    expect(MEMORY_CATEGORIES).toContain("open_question");
    expect(MEMORY_CATEGORIES).toContain("known_risk");
    expect(MEMORY_CATEGORIES).toContain("agent_summary");
    expect(MEMORY_CATEGORIES).toContain("user_preference");
    expect(MEMORY_CATEGORIES.length).toBe(9);
  });

  it("exports canonical freshness and confidence values", () => {
    expect(MEMORY_FRESHNESS_STATUSES).toEqual(["fresh", "stale", "expired", "superseded"]);
    expect(MEMORY_CONFIDENCE_LEVELS).toEqual(["confirmed", "hypothesis", "inferred", "simulated"]);
    expect(MEMORY_CONFLICT_RESOLUTIONS).toEqual([
      "unresolved",
      "superseded",
      "reconciled",
      "preserved_disagreement",
    ]);
    expect(MEMORY_SOURCE_TYPES).toContain("file");
    expect(MEMORY_SOURCE_TYPES).toContain("task");
    expect(MEMORY_SOURCE_TYPES).toContain("debate");
    expect(MEMORY_SOURCE_TYPES).toContain("tool_call");
  });

  it("validates MemoryProvenance successfully", () => {
    const valid = {
      sourceType: "file",
      sourceReference: "file:///docs/PLAN.md#L510",
      author: "agent-architect-01",
      rationale: "Established SQLite WAL mode invariant",
    };
    const res = validateMemoryProvenance(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.sourceType).toBe("file");
      expect(res.data.author).toBe("agent-architect-01");
    }
  });

  it("validates enhanced MemoryItem with ownership, provenance, and freshness", () => {
    const item = {
      id: "mem-arch-001",
      category: "decision_rationale",
      key: "persistence_engine",
      content: "Chose SQLite with WAL mode over external database servers.",
      confidence: "confirmed",
      projectId: "proj-terrarium",
      taskId: "task-infra-01",
      owner: "backend-lead",
      provenance: {
        sourceType: "task",
        sourceReference: "task:task-infra-01",
        author: "backend-lead",
        rationale: "Zero-dependency embedded file database simplifies deployment",
      },
      tags: ["architecture", "persistence", "sqlite"],
      isArchived: false,
      lastValidatedAt: now,
      freshnessStatus: "fresh",
      isConflicted: false,
      createdAt: now,
      updatedAt: now,
    };

    const res = validateMemoryItem(item);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.projectId).toBe("proj-terrarium");
      expect(res.data.freshnessStatus).toBe("fresh");
      expect(res.data.provenance?.sourceType).toBe("task");
      expect(res.data.isConflicted).toBe(false);
    }
  });

  it("defaults projectId to 'default' when missing for backward compatibility", () => {
    const legacyItem = {
      id: "mem-legacy-01",
      category: "project_overview",
      key: "overview",
      content: "TERRARIUM multi-agent platform",
      confidence: "confirmed",
      tags: [],
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    const res = validateMemoryItem(legacyItem);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.projectId).toBe("default");
      expect(res.data.freshnessStatus).toBe("fresh");
      expect(res.data.isConflicted).toBe(false);
    }
  });

  it("validates MemoryItem with conflict tracking metadata", () => {
    const conflictedItem = {
      id: "mem-conflicted-01",
      category: "architecture_knowledge",
      key: "auth_strategy",
      content: "Use OAuth2 PKCE without sessions",
      confidence: "inferred",
      projectId: "proj-terrarium",
      isConflicted: true,
      conflictWithId: "mem-auth-orig",
      conflictReason: "Contradicts confirmed requirement for session tokens in CLI",
      conflictResolution: "unresolved",
      tags: ["auth"],
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    const res = validateMemoryItem(conflictedItem);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.isConflicted).toBe(true);
      expect(res.data.conflictWithId).toBe("mem-auth-orig");
      expect(res.data.conflictResolution).toBe("unresolved");
    }
  });

  it("validates ArtifactReference", () => {
    const ref = {
      id: "art-report-01",
      title: "Architecture Assessment Report",
      pathOrUri: "docs/reports/ARCH_REPORT.md",
      artifactType: "markdown_report",
      summary: "Evaluated hexagonal architecture boundaries across packages",
      relevanceScore: 0.92,
    };
    const res = validateArtifactReference(ref);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.relevanceScore).toBe(0.92);
      expect(res.data.artifactType).toBe("markdown_report");
    }
  });

  it("validates AgentContextPackage with scoped context and token budgets", () => {
    const pkg = {
      id: "ctx-pkg-001",
      projectId: "proj-terrarium",
      taskId: "task-code-review-01",
      agentSlug: "senior-backend-dev",
      department: "engineering",
      assembledAt: now,
      taskContext: {
        taskId: "task-code-review-01",
        title: "Review SQLite persistence layer",
        description: "Ensure WAL mode and busy_timeout are configured properly",
        category: "engineering",
        priority: "high",
        inputs: { repository: "terrarium" },
      },
      relevantMemories: [],
      durableDecisions: [],
      activeConstraints: ["No external database dependencies allowed", "Zero data loss under WAL crash"],
      userPreferences: [],
      artifactReferences: [],
      conversationSummary: "Previous discussions settled on SQLite WAL mode and Bun native driver.",
      tokenEstimate: 450,
      tokenLimit: 4000,
      warnings: ["1 stale memory item detected; revalidate before quoting as fact"],
    };

    const res = validateAgentContextPackage(pkg);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.agentSlug).toBe("senior-backend-dev");
      expect(res.data.department).toBe("engineering");
      expect(res.data.activeConstraints.length).toBe(2);
      expect(res.data.tokenEstimate).toBe(450);
      expect(res.data.warnings.length).toBe(1);
    }
  });

  it("constructs typed memory domain errors correctly", () => {
    const notFound = new MemoryNotFoundError("mem-999", "proj-alpha");
    expect(notFound.code).toBe("NOT_FOUND");
    expect(notFound.message).toContain("mem-999");
    expect(notFound.message).toContain("proj-alpha");

    const conflict = new MemoryConflictError("mem-100", "auth.method", "New method contradicts old JWT token choice");
    expect(conflict.code).toBe("MEMORY_CONFLICT");
    expect(conflict.existingId).toBe("mem-100");
    expect(conflict.incomingKey).toBe("auth.method");

    const stale = new StaleMemoryError("mem-200", 45);
    expect(stale.code).toBe("STALE_MEMORY");
    expect(stale.ageDays).toBe(45);

    const budget = new ContextBudgetExceededError("researcher-01", 12000, 8000);
    expect(budget.code).toBe("CONTEXT_BUDGET_EXCEEDED");
    expect(budget.tokenEstimate).toBe(12000);

    const crossProject = new CrossProjectContextLeakError("proj-A", "proj-B");
    expect(crossProject.code).toBe("CROSS_PROJECT_CONTEXT_LEAK");
    expect(crossProject.message).toContain("cannot access project 'proj-B'");
  });

  it("verifies UI visual metadata for freshness, confidence, and categories", () => {
    expect(MEMORY_FRESHNESS_UI.fresh.glyph).toBe("🟢");
    expect(MEMORY_FRESHNESS_UI.stale.glyph).toBe("🟡");
    expect(MEMORY_FRESHNESS_UI.expired.glyph).toBe("🔴");
    expect(MEMORY_FRESHNESS_UI.superseded.glyph).toBe("⚪");

    expect(MEMORY_CONFIDENCE_UI.confirmed.badge).toBe("[CONFIRMED]");
    expect(MEMORY_CONFIDENCE_UI.hypothesis.badge).toBe("[HYPOTHESIS]");

    expect(MEMORY_CATEGORY_UI.decision_rationale.label).toBe("Decision Record");
    expect(MEMORY_CATEGORY_UI.known_risk.icon).toBe("⚠️");
  });
});
