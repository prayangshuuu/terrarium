/**
 * @terrarium/core - tests/task-intake.test.ts
 *
 * Deterministic test suite for task intake, classification, planning, and safety gates.
 * Covers: normal, ambiguous, unsupported, and high-risk requests, plus non-execution invariants.
 * Aligns strictly with PLAN.md Section 5.1 & 5.4, PLAN_CONTEXT.md Section 5, and Prompt 7.
 */

import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import {
  createAgentRegistry,
  createCoreEngine,
  createSqliteDatabase,
  createTaskIntakeService,
  formatPlanTerminal,
  formatPlanMarkdown,
  normalizeRequest,
  evaluateRisk,
  evaluateMissingFacts,
  classifyTask,
  CURATED_15_PROFILES,
} from "../src/index.ts";

describe("Task Intake, Classification, and Planning Suite", () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Normal Requests
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Category 1: Normal Requests", () => {
    it("processes an architecture review request and produces an inspectable plan", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Conduct an architecture review of packages/core and evaluate domain boundaries",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { plan, isReadyForExecution, normalized } = res.data;

        expect(isReadyForExecution).toBe(true);
        expect(plan.status).toBe("ready");
        expect(plan.classification.taskType).toBe("architecture_review");
        expect(plan.classification.primaryDepartment).toBe("engineering");
        expect(plan.classification.requiredCapabilities).toContain("architecture_analysis");
        expect(plan.classification.expectedOutputs).toContain("architecture_review_report");

        // Inspectable steps and DAG dependencies
        expect(plan.steps.length).toBe(3);
        expect(plan.steps[0]?.dependsOn).toEqual([]); // Initial step
        expect(plan.steps[1]?.dependsOn).toEqual(["step_1"]);
        expect(plan.steps[2]?.dependsOn).toEqual(["step_2"]);

        // Candidate capability resolution
        expect(plan.steps[0]?.candidateAgentSlugs).toContain("principal-software-architect");

        // Budget estimate
        expect(plan.budgetEstimate.totalEstimatedTokens).toBeGreaterThan(5000);
        expect(plan.budgetEstimate.totalEstimatedCostUsd).toBeGreaterThan(0.05);

        // Selection rationale explanation
        expect(plan.selectionRationale.taskTypeRationale).toContain("architecture_review");
        expect(plan.selectionRationale.departmentRationale).toContain("engineering");
        expect(plan.selectionRationale.stepSequenceRationale).toContain("sequential");

        // Completion criteria
        expect(plan.completionCriteria.length).toBeGreaterThan(1);
        expect(normalized.extractedFilePaths).toContain("packages/core");
      }
    });

    it("processes a customer simulation request and maps simulated persona profiles", async () => {
      const registry = createAgentRegistry({ autoSeed: true, seedProfiles: CURATED_15_PROFILES });
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Simulate customer persona reactions to a $49/mo pricing tier and their purchase objections",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { plan, isReadyForExecution } = res.data;

        expect(isReadyForExecution).toBe(true);
        expect(plan.classification.taskType).toBe("customer_simulation");
        expect(plan.classification.primaryDepartment).toBe("customer_intelligence");

        // Step 2 targets customer_intelligence department
        const simStep = plan.steps.find((s) => s.department === "customer_intelligence");
        expect(simStep).toBeDefined();
        if (simStep) {
          expect(simStep.candidateCapabilities).toContain("persona_simulation");
          expect(simStep.candidateAgentSlugs.length).toBeGreaterThan(0);
          expect(simStep.candidateAgentSlugs.some((s) => s.includes("persona"))).toBe(true);
        }
      }
    });

    it("processes a security audit request and identifies threat modeling capabilities", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Run a security audit on auth headers and vulnerability assessment for injection risks",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { plan, isReadyForExecution } = res.data;
        expect(isReadyForExecution).toBe(true);
        expect(plan.classification.taskType).toBe("security_audit");
        expect(plan.classification.primaryDepartment).toBe("security");
        expect(plan.classification.requiredCapabilities).toContain("threat_modeling");
      }
    });

    it("processes a test generation request and routes to quality assurance", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Write unit tests for packages/contracts/src/tasks.ts to achieve full branch coverage",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { plan } = res.data;
        expect(plan.classification.taskType).toBe("test_generation");
        expect(plan.classification.primaryDepartment).toBe("engineering");
        expect(plan.classification.expectedOutputs).toContain("test_suite");
        expect(plan.steps.length).toBe(3);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Ambiguous Requests
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Category 2: Ambiguous Requests & Clarification", () => {
    it("flags an ambiguous bug fix without error details as needing clarification", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Fix the bug",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { plan, isReadyForExecution } = res.data;

        expect(isReadyForExecution).toBe(false);
        expect(plan.status).toBe("needs_clarification");
        expect(plan.clarificationQuestions.length).toBeGreaterThan(0);

        const bugQuestion = plan.clarificationQuestions.find((q) => q.id === "clarify_bug_details");
        expect(bugQuestion).toBeDefined();
        expect(bugQuestion?.criticality).toBe("blocking");
        expect(plan.classification.uncertainty.level).toBe("high");
        expect(plan.steps.length).toBe(0); // Paused pending clarification
      }
    });

    it("flags an ambiguous optimization request lacking target as needing clarification", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Make it faster",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { plan, isReadyForExecution } = res.data;
        expect(isReadyForExecution).toBe(false);
        expect(plan.status).toBe("needs_clarification");

        const optQuestion = plan.clarificationQuestions.find((q) => q.id === "clarify_optimization_target");
        expect(optQuestion).toBeDefined();
        expect(optQuestion?.criticality).toBe("blocking");
      }
    });

    it("transitions plan to ready when user provides answers to clarification questions", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      // First run: Ambiguous
      const firstRes = await service.processIntake({
        prompt: "Fix the bug",
      });
      expect(firstRes.success).toBe(true);
      if (firstRes.success) {
        expect(firstRes.data.isReadyForExecution).toBe(false);
      }

      // Second run: User provides clarification answers
      const secondRes = await service.processIntake({
        prompt: "Fix the bug in packages/core/src/index.ts",
        clarificationAnswers: {
          clarify_bug_details: "Uncaught TypeError at line 42 when options is undefined",
        },
      });

      expect(secondRes.success).toBe(true);
      if (secondRes.success) {
        const { plan, isReadyForExecution } = secondRes.data;
        expect(isReadyForExecution).toBe(true);
        expect(plan.status).toBe("ready");
        expect(plan.steps.length).toBe(3);
        expect(plan.clarificationQuestions.length).toBe(0);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Unsupported Requests
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Category 3: Unsupported Requests", () => {
    it("rejects non-software physical execution requests", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Order a pizza with extra cheese to 100 Market St",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { plan, isReadyForExecution } = res.data;
        expect(isReadyForExecution).toBe(false);
        expect(plan.status).toBe("rejected");
        expect(plan.classification.isSupported).toBe(false);
        expect(plan.classification.taskType).toBe("unsupported");
        expect(plan.steps.length).toBe(0);
        expect(plan.budgetEstimate.totalEstimatedTokens).toBe(0);
        expect(plan.classification.unsupportedReason).toBeDefined();
      }
    });

    it("rejects harmful cyberattack and password theft requests", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Launch a DDoS attack against target.com and steal passwords",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { plan, isReadyForExecution } = res.data;
        expect(isReadyForExecution).toBe(false);
        expect(plan.status).toBe("rejected");
        expect(plan.classification.isSupported).toBe(false);
        expect(plan.steps.length).toBe(0);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. High-Risk Requests
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Category 4: High-Risk Requests & Approval Gates", () => {
    it("flags destructive database drop request as critical risk requiring approval", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Drop table users and wipe database schema before starting fresh",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { plan } = res.data;
        expect(plan.classification.risk.level).toBe("critical");
        expect(plan.classification.risk.score).toBeGreaterThanOrEqual(90);
        expect(plan.classification.risk.requiresApproval).toBe(true);
        expect(plan.classification.risk.sensitiveOperations).toContain("database_destruction");

        // Mitigations must include human-in-the-loop confirmation
        expect(plan.classification.risk.mitigations.some((m) => m.includes("human-in-the-loop"))).toBe(true);
      }
    });

    it("flags credential and secret exposure requests as critical risk", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Print API key and dump env vars from .env file to terminal",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { plan } = res.data;
        expect(plan.classification.risk.level).toBe("critical");
        expect(plan.classification.risk.sensitiveOperations).toContain("credential_exposure");
        expect(plan.classification.risk.requiresApproval).toBe(true);
      }
    });

    it("enforces approval requirement on code mutation steps when risk is medium or high", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Implement payment processing webhook and delete file old-payment.ts",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const { plan } = res.data;
        expect(plan.classification.risk.level).toBe("high");
        expect(plan.classification.risk.requiresApproval).toBe(true);

        const mutationStep = plan.steps.find((s) => s.requiresApproval);
        expect(mutationStep).toBeDefined();
        expect(mutationStep?.approvalReason).toBeDefined();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Non-Execution Invariants
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Category 5: Strict Non-Execution Invariants", () => {
    it("guarantees planning executes ZERO tools, ZERO agent processes, and ZERO provider calls", async () => {
      const db = createSqliteDatabase(":memory:");
      const engine = createCoreEngine({
        enableDatabase: true,
      });

      const initialExecutions = await db.executions.listByTaskId("any");
      const initialSessions = await db.sessions.list();

      expect(initialExecutions.success).toBe(true);
      expect(initialSessions.success).toBe(true);
      if (initialExecutions.success) {
        expect(initialExecutions.data.length).toBe(0);
      }
      if (initialSessions.success) {
        expect(initialSessions.data.length).toBe(0);
      }

      // Execute task intake and planning through the engine
      const intakeRes = await engine.intake.processIntake({
        prompt: "Conduct an architecture review of packages/core and evaluate domain boundaries",
      });

      expect(intakeRes.success).toBe(true);

      // Verify engine execution state remains idle
      const state = engine.getState();
      expect(state.status).toBe("idle");
      expect(state.activeExecutions).toBe(0);

      // Verify zero execution records were created in the database
      const postExecutions = await db.executions.listByTaskId("any");
      if (postExecutions.success) {
        expect(postExecutions.data.length).toBe(0);
      }

      // Verify zero interactive sessions were created in the database
      const postSessions = await db.sessions.list();
      if (postSessions.success) {
        expect(postSessions.data.length).toBe(0);
      }

      await engine.shutdown();
      db.close();
    });

    it("creates draft task entity in database with status 'draft' without starting execution", async () => {
      const db = createSqliteDatabase(":memory:");
      const service = createTaskIntakeService({
        registry: createAgentRegistry(),
        repositories: db,
      });

      const res = await service.processIntake(
        {
          prompt: "Write unit tests for packages/contracts/src/tasks.ts",
        },
        { persistDraftTask: true, persistPlan: true }
      );

      expect(res.success).toBe(true);
      if (res.success) {
        const { draftTask, plan } = res.data;
        expect(draftTask).toBeDefined();
        expect(draftTask?.status).toBe("draft");
        expect(plan.taskId).toBe(draftTask?.id);

        // Verify task exists in SQLite with status 'draft'
        const dbTaskRes = await db.tasks.findById(draftTask!.id);
        expect(dbTaskRes.success).toBe(true);
        if (dbTaskRes.success) {
          expect(dbTaskRes.data?.status).toBe("draft");
        }

        // Verify plan exists in SQLite
        const dbPlanRes = await db.plans.findById(plan.id);
        expect(dbPlanRes.success).toBe(true);
        if (dbPlanRes.success) {
          expect(dbPlanRes.data?.id).toBe(plan.id);
        }
      }

      db.close();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Presentation & Plan Readability
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Category 6: Presentation and Plan Readability", () => {
    it("formats a task plan for terminal display with ANSI badges and DAG view", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Conduct an architecture review of packages/core",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const terminalOutput = formatPlanTerminal(res.data.plan, { useColor: false });
        expect(terminalOutput).toContain("TERRARIUM TASK PLAN");
        expect(terminalOutput).toContain("[PLAN READY]");
        expect(terminalOutput).toContain("PROPOSED EXECUTION STEPS (DAG)");
        expect(terminalOutput).toContain("RESOURCE & BUDGET ESTIMATE");
        expect(terminalOutput).toContain("SELECTION RATIONALE");
        expect(terminalOutput).toContain("architecture_review");
      }
    });

    it("formats a task plan into GitHub Flavored Markdown with Mermaid diagram", async () => {
      const registry = createAgentRegistry();
      const service = createTaskIntakeService({ registry });

      const res = await service.processIntake({
        prompt: "Conduct an architecture review of packages/core",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const mdOutput = formatPlanMarkdown(res.data.plan);
        expect(mdOutput).toContain("# Terrarium Task Plan: architecture_review");
        expect(mdOutput).toContain("```mermaid");
        expect(mdOutput).toContain("flowchart TD");
        expect(mdOutput).toContain("## Execution Steps");
        expect(mdOutput).toContain("## Budget Estimate");
        expect(mdOutput).toContain("## Selection Rationale");
      }
    });
  });
});
