/**
 * @terrarium/contracts - tests/planning-contracts.test.ts
 *
 * Boundary validation and lifecycle tests for planning domain models.
 */

import { describe, expect, it } from "bun:test";
import {
  TASK_TYPES,
  RISK_LEVELS,
  UNCERTAINTY_LEVELS,
  PLAN_STATUSES,
  PROJECT_SCOPES,
  validateProjectContext,
  validateRiskAssessment,
  validateUncertaintyAssessment,
  validateClarificationQuestion,
  validatePlanStep,
  validateTaskPlan,
  type TaskPlan,
  type PlanStep,
} from "../src/index.ts";

describe("Planning Contracts & Schema Validation", () => {
  const now = new Date().toISOString();

  it("verifies defined domain constants", () => {
    expect(TASK_TYPES).toContain("architecture_review");
    expect(TASK_TYPES).toContain("code_generation");
    expect(TASK_TYPES).toContain("bug_fix");
    expect(TASK_TYPES).toContain("security_audit");
    expect(TASK_TYPES).toContain("customer_simulation");
    expect(TASK_TYPES).toContain("unsupported");

    expect(RISK_LEVELS).toEqual(["low", "medium", "high", "critical"]);
    expect(UNCERTAINTY_LEVELS).toEqual(["low", "medium", "high"]);
    expect(PLAN_STATUSES).toEqual(["draft", "ready", "needs_clarification", "rejected", "approved"]);
    expect(PROJECT_SCOPES).toEqual(["conceptual", "single_file", "multi_file", "module", "full_codebase"]);
  });

  describe("validateProjectContext", () => {
    it("validates a compliant project context", () => {
      const res = validateProjectContext({
        name: "terrarium",
        rootDir: "/workspace/terrarium",
        scope: "multi_file",
        detectedLanguages: ["typescript"],
        detectedFrameworks: ["bun"],
        fileTargets: ["src/index.ts"],
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("terrarium");
        expect(res.data.scope).toBe("multi_file");
        expect(res.data.fileTargets).toEqual(["src/index.ts"]);
      }
    });

    it("defaults scope to conceptual when omitted", () => {
      const res = validateProjectContext({});
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.scope).toBe("conceptual");
      }
    });

    it("rejects invalid scope", () => {
      const res = validateProjectContext({ scope: "invalid_scope" });
      expect(res.success).toBe(false);
    });
  });

  describe("validateRiskAssessment", () => {
    it("validates a valid risk assessment", () => {
      const res = validateRiskAssessment({
        level: "high",
        score: 75,
        factors: ["Deletes database tables", "Modifies production secrets"],
        mitigations: ["Require manual user approval before execution"],
        requiresApproval: true,
        sensitiveOperations: ["db_drop", "secret_write"],
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.level).toBe("high");
        expect(res.data.score).toBe(75);
        expect(res.data.requiresApproval).toBe(true);
        expect(res.data.factors.length).toBe(2);
      }
    });

    it("rejects score outside 0-100", () => {
      const res = validateRiskAssessment({
        level: "low",
        score: 150,
      });
      expect(res.success).toBe(false);
    });
  });

  describe("validateUncertaintyAssessment", () => {
    it("validates compliant uncertainty assessment", () => {
      const res = validateUncertaintyAssessment({
        level: "medium",
        score: 45,
        reasons: ["Target file path not specified"],
        missingInformation: ["Target component path"],
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.level).toBe("medium");
        expect(res.data.score).toBe(45);
      }
    });
  });

  describe("validateClarificationQuestion", () => {
    it("validates clarification question", () => {
      const res = validateClarificationQuestion({
        id: "q_target_file",
        question: "Which file contains the bug you want to fix?",
        rationale: "Multiple files match the description 'auth handler'",
        criticality: "blocking",
        category: "target",
        suggestedOptions: ["packages/core/src/auth.ts", "apps/cli/src/auth.ts"],
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe("q_target_file");
        expect(res.data.criticality).toBe("blocking");
        expect(res.data.suggestedOptions?.length).toBe(2);
      }
    });
  });

  describe("validatePlanStep", () => {
    it("validates compliant plan step", () => {
      const step: PlanStep = {
        id: "step_1",
        stepIndex: 0,
        title: "Analyze Architecture",
        description: "Review domain contracts and boundaries",
        department: "engineering",
        candidateCapabilities: ["architecture_analysis"],
        candidateAgentSlugs: ["principal-software-architect"],
        dependsOn: [],
        estimatedTokens: 3000,
        estimatedDurationMs: 5000,
        estimatedCostUsd: 0.03,
        requiresApproval: false,
        completionCriteria: ["Architecture summary generated"],
      };

      const res = validatePlanStep(step);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe("step_1");
        expect(res.data.department).toBe("engineering");
      }
    });

    it("rejects step with negative duration or invalid department", () => {
      const res = validatePlanStep({
        id: "step_1",
        stepIndex: 0,
        title: "Bad Step",
        description: "Bad",
        department: "unknown_department",
        estimatedTokens: 100,
        estimatedDurationMs: -50,
        estimatedCostUsd: 0.01,
      });
      expect(res.success).toBe(false);
    });
  });

  describe("validateTaskPlan", () => {
    it("validates a full TaskPlan", () => {
      const plan: TaskPlan = {
        id: "plan-test-01",
        taskId: "task-test-01",
        rawInput: "Review architecture of packages/core",
        normalizedInput: "Review architecture of packages/core",
        classification: {
          taskType: "architecture_review",
          confidence: 0.9,
          primaryDepartment: "engineering",
          secondaryDepartments: ["research"],
          requiredCapabilities: ["architecture_analysis"],
          expectedOutputs: ["architecture_review_report"],
          projectContext: {
            scope: "module",
            fileTargets: ["packages/core"],
          },
          risk: {
            level: "low",
            score: 10,
            factors: ["Read-only inspection"],
            mitigations: [],
            requiresApproval: false,
            sensitiveOperations: [],
          },
          uncertainty: {
            level: "low",
            score: 15,
            reasons: [],
            missingInformation: [],
          },
          isSupported: true,
        },
        steps: [
          {
            id: "step_1",
            stepIndex: 0,
            title: "Inspect packages/core contracts",
            description: "Analyze exported interfaces and dependencies",
            department: "engineering",
            candidateCapabilities: ["architecture_analysis"],
            candidateAgentSlugs: ["principal-software-architect"],
            dependsOn: [],
            estimatedTokens: 2500,
            estimatedDurationMs: 4000,
            estimatedCostUsd: 0.025,
            requiresApproval: false,
            completionCriteria: ["Inspection findings recorded"],
          },
        ],
        budgetEstimate: {
          totalEstimatedTokens: 2500,
          totalEstimatedCostUsd: 0.025,
          estimatedDurationMs: 4000,
          modelTierDistribution: { fast: 0, standard: 1, advanced: 0 },
        },
        selectionRationale: {
          taskTypeRationale: "Matched keyword 'architecture review'",
          departmentRationale: "Engineering owns system architecture",
          capabilityRationale: "Requires architecture_analysis capability",
          stepSequenceRationale: "Single-step read-only analysis",
          riskMitigationRationale: "Low risk; read-only operations",
        },
        clarificationQuestions: [],
        completionCriteria: ["All inspection findings completed"],
        status: "ready",
        createdAt: now,
        updatedAt: now,
      };

      const res = validateTaskPlan(plan);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe("plan-test-01");
        expect(res.data.status).toBe("ready");
        expect(res.data.steps.length).toBe(1);
      }
    });
  });
});
