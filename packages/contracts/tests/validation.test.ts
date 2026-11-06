import { describe, expect, it } from "bun:test";
import {
  DEPARTMENTS,
  USER_FACING_TERMS,
  evaluateBudget,
  getDepartmentInfo,
  validateAgentCapability,
  validateAgentProfile,
  validateApprovalRequest,
  validateArtifact,
  validateBudgetConfig,
  validateDepartment,
  validateDomainEvent,
  validateExecution,
  validateMemoryItem,
  validateMessage,
  validateModelInfo,
  validateProviderInfo,
  validateReport,
  validateReportFinding,
  validateSession,
  validateTask,
  validateTaskCreateInput,
  validateTaskResult,
  type AgentProfile,
  type ApprovalRequest,
  type Artifact,
  type DomainEvent,
  type Execution,
  type MemoryItem,
  type Message,
  type ProviderInfo,
  type Report,
  type Session,
  type Task,
  type TaskResult,
} from "../src/index.ts";

describe("Domain Contracts Boundary Validation", () => {
  const now = new Date().toISOString();

  describe("AgentProfile & Capabilities Validation", () => {
    it("validates a compliant agent profile", () => {
      const validProfile = {
        id: "agent-arch-01",
        slug: "software-architect",
        name: "Software Architect",
        displayName: "Principal Architect",
        department: "engineering",
        role: "Software Architecture Specialist",
        description: "Designs technical architecture, interfaces, and decoupling strategies.",
        systemPromptTemplate: "You are the Principal Architect. Provide clear architectural boundaries.",
        capabilities: [
          {
            id: "cap-arch-review",
            name: "Architecture Review",
            description: "Evaluates coupling, module boundaries, and maintainability.",
            department: "engineering",
            requiredPermissions: ["repo:read"],
            isConsequential: false,
          },
        ],
        limits: {
          maxTokensPerTurn: 4096,
          maxDelegationDepth: 2,
          maxChildrenTasks: 5,
        },
        modelPreference: {
          tier: "advanced",
          preferredProvider: "anthropic",
          preferredModel: "claude-3-7-sonnet",
        },
        status: "available",
        tags: ["architecture", "systems", "core"],
        createdAt: now,
        updatedAt: now,
      };

      const res = validateAgentProfile(validProfile);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe("agent-arch-01");
        expect(res.data.department).toBe("engineering");
        expect(res.data.capabilities.length).toBe(1);
      }
    });

    it("validates a simulated customer persona profile", () => {
      const personaProfile = {
        id: "agent-persona-01",
        slug: "smb-founder-persona",
        name: "SMB Founder Persona",
        displayName: "Sarah (Early-Stage SaaS Founder)",
        department: "customer_intelligence",
        role: "Simulated Customer Persona",
        description: "Simulates early-stage founder reactions to pricing and onboarding workflows.",
        systemPromptTemplate: "Simulate responses as an early-stage SaaS founder.",
        capabilities: [],
        limits: {
          maxTokensPerTurn: 2048,
          maxDelegationDepth: 0,
          maxChildrenTasks: 0,
        },
        modelPreference: {
          tier: "standard",
        },
        status: "available",
        tags: ["persona", "customer-simulation", "saas"],
        personaAttributes: {
          occupation: "Bootstrapped SaaS Founder",
          technicalFamiliarity: "intermediate",
          priceSensitivity: "high",
          buyingCriteria: ["fast time-to-value", "low monthly cost"],
          adoptionBarriers: ["steep learning curve"],
        },
        createdAt: now,
        updatedAt: now,
      };

      const res = validateAgentProfile(personaProfile);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.personaAttributes?.priceSensitivity).toBe("high");
        expect(res.data.department).toBe("customer_intelligence");
      }
    });

    it("rejects invalid agent slug with uppercase or special characters", () => {
      const invalid = {
        id: "agent-01",
        slug: "Invalid_Slug!",
        name: "Test",
        displayName: "Test",
        department: "engineering",
        role: "Test",
        description: "Test",
        systemPromptTemplate: "Test",
        limits: { maxTokensPerTurn: 1000, maxDelegationDepth: 1, maxChildrenTasks: 1 },
        modelPreference: { tier: "standard" },
        status: "available",
        createdAt: now,
        updatedAt: now,
      };
      const res = validateAgentProfile(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => i.path === "agentProfile.slug")).toBe(true);
      }
    });

    it("rejects limits outside safe operational bounds", () => {
      const invalid = {
        id: "agent-02",
        slug: "deep-delegator",
        name: "Test",
        displayName: "Test",
        department: "engineering",
        role: "Test",
        description: "Test",
        systemPromptTemplate: "Test",
        limits: { maxTokensPerTurn: 50, maxDelegationDepth: 99, maxChildrenTasks: 999 }, // 50 < 100 min tokens, 99 > 10 depth
        modelPreference: { tier: "standard" },
        status: "available",
        createdAt: now,
        updatedAt: now,
      };
      const res = validateAgentProfile(invalid);
      expect(res.success).toBe(false);
    });
  });

  describe("Department Verification & Canonical Terminology", () => {
    it("recognizes all 10 standard departments from PLAN.md", () => {
      const depts: import("../src/index.ts").AgentDepartment[] = [
        "executive",
        "engineering",
        "customer_intelligence",
        "product",
        "design",
        "marketing",
        "security",
        "research",
        "documentation",
        "legal",
      ];
      for (const d of depts) {
        const res = validateDepartment(d);
        expect(res.success).toBe(true);
        const info = getDepartmentInfo(d);
        expect(info.id).toBe(d);
      }
    });

    it("flags customer_intelligence department as simulated personas", () => {
      const info = DEPARTMENTS.customer_intelligence;
      expect(info.isSimulatedPersona).toBe(true);
      expect(USER_FACING_TERMS.SIMULATED_PERSONA).toBe("Customer Persona (Simulated)");
    });

    it("rejects unrecognized department strings", () => {
      const res = validateDepartment("cryptocurrency_trading");
      expect(res.success).toBe(false);
    });
  });

  describe("Task & Step Validation", () => {
    it("validates TaskCreateInput and applies default priority", () => {
      const input = {
        title: "Review workspace package boundaries",
        description: "Examine unidirectional package imports between contracts, config, and core.",
        department: "engineering",
      };
      const res = validateTaskCreateInput(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.priority).toBe("medium");
        expect(res.data.title).toBe("Review workspace package boundaries");
      }
    });

    it("validates full Task entity with context references", () => {
      const taskObj = {
        id: "task-100",
        title: "Full workspace type check",
        description: "Execute tsc across all workspaces.",
        department: "engineering",
        status: "planned",
        priority: "high",
        contextRefs: [
          {
            type: "file",
            target: "packages/contracts/src/index.ts",
            description: "Contracts root export",
          },
        ],
        expectedDeliverables: ["TypeScript report"],
        delegationDepth: 0,
        createdAt: now,
        updatedAt: now,
      };
      const res = validateTask(taskObj);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.contextRefs.length).toBe(1);
        expect(res.data.contextRefs[0]?.type).toBe("file");
      }
    });

    it("rejects task with negative delegation depth or empty title", () => {
      const bad = {
        id: "task-bad",
        title: "",
        description: "No title",
        department: "engineering",
        status: "planned",
        priority: "medium",
        delegationDepth: -1,
        createdAt: now,
        updatedAt: now,
      };
      const res = validateTask(bad);
      expect(res.success).toBe(false);
    });
  });

  describe("Execution & Metrics Validation", () => {
    it("validates execution with accurate token and duration metrics", () => {
      const execObj = {
        id: "exec-01",
        taskId: "task-100",
        agentProfileId: "agent-arch-01",
        status: "completed",
        provider: "anthropic",
        model: "claude-3-7-sonnet",
        metrics: {
          tokensPrompt: 1200,
          tokensCompletion: 450,
          tokensTotal: 1650,
          estimatedCostUsd: 0.012,
          durationMs: 820,
        },
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        finishedAt: now,
      };
      const res = validateExecution(execObj);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.metrics.tokensTotal).toBe(1650);
      }
    });

    it("rejects negative execution metrics", () => {
      const bad = {
        id: "exec-bad",
        taskId: "task-100",
        agentProfileId: "agent-arch-01",
        status: "running",
        provider: "anthropic",
        model: "claude-3-7-sonnet",
        metrics: {
          tokensPrompt: -10,
          tokensCompletion: 100,
          tokensTotal: 90,
          estimatedCostUsd: -0.05,
          durationMs: 10,
        },
        createdAt: now,
        updatedAt: now,
      };
      const res = validateExecution(bad);
      expect(res.success).toBe(false);
    });
  });

  describe("Session & Message Validation", () => {
    it("validates interactive session and citations", () => {
      const sessionObj = {
        id: "sess-01",
        title: "Architecture Discussion with Principal Architect",
        mode: "interactive",
        status: "active",
        participantAgentIds: ["agent-arch-01"],
        createdAt: now,
        updatedAt: now,
      };
      const sRes = validateSession(sessionObj);
      expect(sRes.success).toBe(true);

      const msgObj = {
        id: "msg-01",
        sessionId: "sess-01",
        senderId: "user-owner",
        senderType: "user",
        role: "user",
        content: "How should we organize shared domain models?",
        createdAt: now,
        updatedAt: now,
      };
      const mRes = validateMessage(msgObj);
      expect(mRes.success).toBe(true);
    });
  });

  describe("Artifact & Approval Gates Validation", () => {
    it("validates artifact metadata and verification status", () => {
      const artifactObj = {
        id: "art-01",
        taskId: "task-100",
        agentId: "agent-arch-01",
        title: "Workspace Boundaries Specification",
        artifactType: "architecture_spec",
        path: "docs/architecture/WORKSPACE_BOUNDARIES.md",
        mimeType: "text/markdown",
        sizeBytes: 4096,
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      };
      const res = validateArtifact(artifactObj);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.isVerified).toBe(true);
      }
    });

    it("validates consequential action approval request", () => {
      const approvalObj = {
        id: "appr-01",
        taskId: "task-100",
        actionType: "git_push",
        description: "Push validated monorepo commit to origin main",
        status: "pending",
        requestedByAgentId: "agent-arch-01",
        requestedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const res = validateApprovalRequest(approvalObj);
      expect(res.success).toBe(true);
    });

    it("rejects unauthorized approval action types", () => {
      const bad = {
        id: "appr-bad",
        taskId: "task-100",
        actionType: "launch_nuclear_missile",
        description: "Invalid action",
        status: "pending",
        requestedByAgentId: "agent-arch-01",
        requestedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const res = validateApprovalRequest(bad);
      expect(res.success).toBe(false);
    });
  });

  describe("Budget Management & Limit Enforcement", () => {
    it("validates budget configuration and evaluates thresholds accurately", () => {
      const configRes = validateBudgetConfig({
        scope: "task",
        maxTokens: 10000,
        maxSpendUsd: 1.0,
        warningThresholdPercent: 80,
        isHardLimit: true,
      });
      expect(configRes.success).toBe(true);

      if (configRes.success) {
        const config = configRes.data;

        // Normal usage: 50%
        const eval1 = evaluateBudget(config, 5000, 0.5);
        expect(eval1.isWarning).toBe(false);
        expect(eval1.isExceeded).toBe(false);

        // Warning threshold reached: 85%
        const eval2 = evaluateBudget(config, 8500, 0.85);
        expect(eval2.isWarning).toBe(true);
        expect(eval2.isExceeded).toBe(false);

        // Limit exceeded: 105%
        const eval3 = evaluateBudget(config, 10500, 1.05);
        expect(eval3.isWarning).toBe(true);
        expect(eval3.isExceeded).toBe(true);
        expect(eval3.exceededError?.name).toBe("BudgetExceededError");
        expect(eval3.exceededError?.unit).toBe("tokens");
      }
    });
  });

  describe("Reports & Preserved Disagreements", () => {
    it("validates report with structured findings", () => {
      const reportObj = {
        id: "rep-01",
        taskId: "task-100",
        title: "Architecture Review Report",
        reportType: "architecture_review",
        summary: "Verified unidirectional dependencies and contracts isolation.",
        markdownContent: "# Architecture Review\n\nAll boundaries intact.",
        findings: [
          {
            id: "find-01",
            title: "Leaf contracts isolation verified",
            severity: "info",
            category: "architecture",
            location: "packages/contracts",
            explanation: "Contracts package contains zero runtime dependencies.",
            recommendation: "Maintain leaf purity.",
            confidence: "high",
            isSimulated: false,
          },
        ],
        agentsInvolved: ["agent-arch-01"],
        status: "final",
        createdAt: now,
        updatedAt: now,
      };
      const res = validateReport(reportObj);
      expect(res.success).toBe(true);
    });

    it("validates task result with preserved disagreements per core principles", () => {
      const resultObj = {
        id: "res-01",
        taskId: "task-100",
        leadAgentId: "agent-arch-01",
        success: true,
        summary: "Package contracts established cleanly.",
        evidence: [
          {
            claim: "Unidirectional import hierarchy holds",
            confidence: "verified",
            sourceReference: "packages/contracts/package.json",
          },
        ],
        disagreements: [
          {
            topic: "Zod vs. Pure TypeScript schema validation in leaf contracts",
            positions: [
              {
                agentId: "agent-arch-01",
                role: "Principal Architect",
                stance: "Pure TypeScript",
                argument: "Leaves leaf contracts zero-dependency and eliminates version mismatch risks.",
              },
              {
                agentId: "agent-sec-01",
                role: "CISO",
                stance: "Zod Runtime Library",
                argument: "Standardizes parser ergonomics across API boundaries.",
              },
            ],
            resolutionStatus: "reconciled",
            synthesisNotes: "Adopted pure TypeScript for @terrarium/contracts to preserve zero-dependency leaf invariant.",
          },
        ],
        unresolvedQuestions: [],
        artifactIds: ["art-01"],
        metrics: {
          tokensPrompt: 500,
          tokensCompletion: 250,
          tokensTotal: 750,
          estimatedCostUsd: 0.005,
          durationMs: 320,
        },
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const res = validateTaskResult(resultObj);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.disagreements.length).toBe(1);
        expect(res.data.disagreements[0]?.positions.length).toBe(2);
      }
    });
  });

  describe("Memory Item Validation", () => {
    it("validates durable project memory with confidence level", () => {
      const memObj = {
        id: "mem-01",
        category: "architecture_knowledge",
        key: "package_dependency_rule",
        content: "@terrarium/contracts must remain leaf level with zero external dependencies.",
        confidence: "confirmed",
        tags: ["architecture", "invariants"],
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };
      const res = validateMemoryItem(memObj);
      expect(res.success).toBe(true);
    });
  });
});
