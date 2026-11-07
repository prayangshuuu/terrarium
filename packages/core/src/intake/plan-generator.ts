/**
 * @terrarium/core - intake/plan-generator.ts
 *
 * Deterministic plan synthesis, dependency graphing, candidate capability mapping,
 * budget estimation, and selection rationale explanation.
 * Aligns with PLAN.md Section 5.1 (Activation Policy), Section 5.4 (Task Lifecycle),
 * and Prompt 7 requirements.
 */

import {
  type AgentDepartment,
  type AgentRegistry,
  type ClarificationQuestion,
  type PlanBudgetEstimate,
  type PlanStatus,
  type PlanStep,
  type SelectionRationale,
  type TaskClassification,
  type TaskPlan,
  type TaskType,
} from "@terrarium/contracts";
import { type NormalizedRequest } from "./request-normalizer.ts";

export interface GeneratePlanOptions {
  readonly taskId?: string;
  readonly budgetCapUsd?: number;
  readonly clarificationQuestions?: readonly ClarificationQuestion[];
}

interface StepBlueprint {
  readonly title: string;
  readonly description: string;
  readonly department: AgentDepartment;
  readonly capabilities: readonly string[];
  readonly estimatedTokens: number;
  readonly estimatedDurationMs: number;
  readonly estimatedCostUsd: number;
  readonly requiresApprovalIfRisk?: boolean;
  readonly completionCriteria: readonly string[];
}

/**
 * Deterministic step sequences per task type following hierarchical delegation patterns.
 */
function getStepBlueprints(taskType: TaskType, primaryDept: AgentDepartment): readonly StepBlueprint[] {
  switch (taskType) {
    case "architecture_review":
      return [
        {
          title: "System Context & Boundary Inspection",
          description: "Analyze module dependencies, domain contracts, and package structure.",
          department: primaryDept,
          capabilities: ["architecture_analysis", "code_analysis"],
          estimatedTokens: 3500,
          estimatedDurationMs: 4000,
          estimatedCostUsd: 0.035,
          completionCriteria: ["Module boundaries and dependency relationships mapped"],
        },
        {
          title: "Architectural Trade-Off Evaluation",
          description: "Evaluate design trade-offs, modularity, failure modes, and scalability.",
          department: "engineering",
          capabilities: ["system_design", "technical_evaluation"],
          estimatedTokens: 4500,
          estimatedDurationMs: 6000,
          estimatedCostUsd: 0.045,
          completionCriteria: ["Trade-off matrix and architectural strengths/weaknesses documented"],
        },
        {
          title: "Synthesis & Actionable Review Deliverable",
          description: "Synthesize findings into an inspectable architecture report with concrete recommendations.",
          department: "documentation",
          capabilities: ["technical_writing"],
          estimatedTokens: 3000,
          estimatedDurationMs: 4000,
          estimatedCostUsd: 0.03,
          completionCriteria: ["Architecture review deliverable formatted and verified"],
        },
      ];

    case "security_audit":
      return [
        {
          title: "Surface Threat Modeling & Scope Mapping",
          description: "Map security perimeters, external boundaries, and untrusted input paths.",
          department: "security",
          capabilities: ["threat_modeling"],
          estimatedTokens: 4000,
          estimatedDurationMs: 5000,
          estimatedCostUsd: 0.04,
          completionCriteria: ["Threat vectors and attack surfaces cataloged"],
        },
        {
          title: "Vulnerability Assessment & Permission Audit",
          description: "Inspect authorization gates, secret exposure risks, and code vulnerability patterns.",
          department: "security",
          capabilities: ["vulnerability_assessment"],
          estimatedTokens: 5000,
          estimatedDurationMs: 7000,
          estimatedCostUsd: 0.05,
          completionCriteria: ["Vulnerability findings scored with impact and remediation priority"],
        },
        {
          title: "Hardening & Remediation Checklist",
          description: "Formulate concrete, actionable hardening steps and security checklists.",
          department: "security",
          capabilities: ["security_review"],
          estimatedTokens: 3000,
          estimatedDurationMs: 4000,
          estimatedCostUsd: 0.03,
          completionCriteria: ["Remediation checklist delivered with verification guidelines"],
        },
      ];

    case "customer_simulation":
      return [
        {
          title: "Scenario & Evaluation Framing",
          description: "Define the customer evaluation scenario, feature proposition, and validation criteria.",
          department: "product",
          capabilities: ["user_research"],
          estimatedTokens: 3000,
          estimatedDurationMs: 4000,
          estimatedCostUsd: 0.03,
          completionCriteria: ["Evaluation scenario and simulated persona selection framed"],
        },
        {
          title: "Simulated Persona Reactions & Objections",
          description: "Simulate representative customer persona perspectives, purchase objections, and adoption barriers.",
          department: "customer_intelligence",
          capabilities: ["persona_simulation"],
          estimatedTokens: 6000,
          estimatedDurationMs: 8000,
          estimatedCostUsd: 0.06,
          completionCriteria: ["Simulated responses captured with preserved disagreements"],
        },
        {
          title: "Feedback Synthesis & Real-World Validation Strategy",
          description: "Synthesize themes, objections, and suggest real-world validation questions.",
          department: "product",
          capabilities: ["feedback_synthesis"],
          estimatedTokens: 3500,
          estimatedDurationMs: 4500,
          estimatedCostUsd: 0.035,
          completionCriteria: ["Simulation report synthesized with clear simulated demarcation"],
        },
      ];

    case "code_generation":
      return [
        {
          title: "Interface & Schema Specification",
          description: "Design type contracts, validation constraints, and error boundaries.",
          department: "engineering",
          capabilities: ["api_design"],
          estimatedTokens: 3000,
          estimatedDurationMs: 4000,
          estimatedCostUsd: 0.03,
          completionCriteria: ["Contract types and interfaces defined and validated"],
        },
        {
          title: "Feature Implementation",
          description: "Implement core business logic adhering strictly to domain boundaries.",
          department: "engineering",
          capabilities: ["code_implementation"],
          estimatedTokens: 6000,
          estimatedDurationMs: 9000,
          estimatedCostUsd: 0.06,
          requiresApprovalIfRisk: true,
          completionCriteria: ["Code implemented with zero typecheck errors"],
        },
        {
          title: "Automated Verification & Unit Tests",
          description: "Add automated tests verifying normal, edge-case, and failure behavior.",
          department: "engineering",
          capabilities: ["test_generation"],
          estimatedTokens: 4000,
          estimatedDurationMs: 5000,
          estimatedCostUsd: 0.04,
          completionCriteria: ["Automated test suite passes cleanly"],
        },
      ];

    case "bug_fix":
      return [
        {
          title: "Defect Investigation & Root Cause Analysis",
          description: "Investigate failure symptoms, reproduce condition, and isolate root cause.",
          department: "engineering",
          capabilities: ["code_investigation"],
          estimatedTokens: 3500,
          estimatedDurationMs: 5000,
          estimatedCostUsd: 0.035,
          completionCriteria: ["Root cause isolated with reproducible evidence"],
        },
        {
          title: "Targeted Bug Fix Implementation",
          description: "Apply minimal, focused code correction addressing the root cause without collateral changes.",
          department: "engineering",
          capabilities: ["code_implementation"],
          estimatedTokens: 4000,
          estimatedDurationMs: 6000,
          estimatedCostUsd: 0.04,
          requiresApprovalIfRisk: true,
          completionCriteria: ["Bug fix implemented and existing tests preserved"],
        },
        {
          title: "Regression Test Verification",
          description: "Add regression tests to ensure the bug cannot silently recur.",
          department: "engineering",
          capabilities: ["test_verification"],
          estimatedTokens: 3000,
          estimatedDurationMs: 4000,
          estimatedCostUsd: 0.03,
          completionCriteria: ["Regression test passes and verifies the fix"],
        },
      ];

    case "test_generation":
      return [
        {
          title: "Coverage & Edge-Case Analysis",
          description: "Inspect target code paths, branch coverage, and identify uncovered boundary conditions.",
          department: "engineering",
          capabilities: ["coverage_analysis"],
          estimatedTokens: 3000,
          estimatedDurationMs: 4000,
          estimatedCostUsd: 0.03,
          completionCriteria: ["Target test scenarios and edge cases cataloged"],
        },
        {
          title: "Deterministic Test Suite Authoring",
          description: "Implement fast, deterministic unit and integration tests with clear assertions.",
          department: "engineering",
          capabilities: ["test_generation"],
          estimatedTokens: 5000,
          estimatedDurationMs: 7000,
          estimatedCostUsd: 0.05,
          completionCriteria: ["Tests authored and integrated into workspace test runner"],
        },
        {
          title: "Execution Verification",
          description: "Run test suite, verify clean execution, and measure test performance.",
          department: "engineering",
          capabilities: ["test_automation"],
          estimatedTokens: 2000,
          estimatedDurationMs: 3000,
          estimatedCostUsd: 0.02,
          completionCriteria: ["All newly generated tests pass with zero failures"],
        },
      ];

    case "refactoring":
      return [
        {
          title: "Code Smells & Dependency Inspection",
          description: "Identify structural coupling, duplication, and architectural erosion.",
          department: "engineering",
          capabilities: ["code_analysis"],
          estimatedTokens: 3500,
          estimatedDurationMs: 4500,
          estimatedCostUsd: 0.035,
          completionCriteria: ["Refactoring scope and target abstractions defined"],
        },
        {
          title: "Structural Refactoring & Decoupling",
          description: "Reorganize code, streamline interfaces, and eliminate redundant logic.",
          department: "engineering",
          capabilities: ["code_refactoring"],
          estimatedTokens: 5500,
          estimatedDurationMs: 8000,
          estimatedCostUsd: 0.055,
          requiresApprovalIfRisk: true,
          completionCriteria: ["Refactoring applied while preserving public contracts"],
        },
        {
          title: "Regression & Invariant Verification",
          description: "Verify that all existing tests, types, and runtime behavior remain intact.",
          department: "engineering",
          capabilities: ["type_safety_audit"],
          estimatedTokens: 3000,
          estimatedDurationMs: 4000,
          estimatedCostUsd: 0.03,
          completionCriteria: ["Zero typecheck errors and 100% existing test pass rate"],
        },
      ];

    case "business_strategy":
      return [
        {
          title: "Problem Clarity & Audience Framing",
          description: "Examine customer problem, target demographic, and core value proposition.",
          department: "executive",
          capabilities: ["business_strategy"],
          estimatedTokens: 3500,
          estimatedDurationMs: 5000,
          estimatedCostUsd: 0.035,
          completionCriteria: ["Problem space and target segment hypotheses documented"],
        },
        {
          title: "Economics & Competitive Positioning",
          description: "Analyze monetization hypotheses, pricing structures, and competitive alternatives.",
          department: "executive",
          capabilities: ["financial_modeling"],
          estimatedTokens: 4500,
          estimatedDurationMs: 6500,
          estimatedCostUsd: 0.045,
          completionCriteria: ["Monetization options and cost structure modeled"],
        },
        {
          title: "Strategic Synthesis & Validation Plan",
          description: "Produce actionable strategy brief distinguishing facts from hypotheses.",
          department: "executive",
          capabilities: ["market_analysis"],
          estimatedTokens: 3500,
          estimatedDurationMs: 4500,
          estimatedCostUsd: 0.035,
          completionCriteria: ["Strategy brief synthesized with recommended validation experiments"],
        },
      ];

    case "documentation":
      return [
        {
          title: "Information Architecture & Audience Needs",
          description: "Determine document structure, technical depth, and key concepts to explain.",
          department: "documentation",
          capabilities: ["technical_writing"],
          estimatedTokens: 2500,
          estimatedDurationMs: 3500,
          estimatedCostUsd: 0.025,
          completionCriteria: ["Document outline and audience personas established"],
        },
        {
          title: "Documentation Authoring & Code Examples",
          description: "Draft comprehensive documentation with copy-pasteable code examples and links.",
          department: "documentation",
          capabilities: ["documentation_generation"],
          estimatedTokens: 4500,
          estimatedDurationMs: 6000,
          estimatedCostUsd: 0.045,
          completionCriteria: ["Documentation authored in clean markdown with valid code blocks"],
        },
      ];

    case "general_inquiry":
    default:
      return [
        {
          title: "Context Investigation & Direct Response",
          description: "Inspect project context and formulate a direct, factual explanation.",
          department: primaryDept,
          capabilities: ["code_analysis"],
          estimatedTokens: 2500,
          estimatedDurationMs: 3000,
          estimatedCostUsd: 0.025,
          completionCriteria: ["Clear explanation provided citing verified project evidence"],
        },
      ];
  }
}

/**
 * Builds selection rationale explaining why specific strategies, departments, and steps were chosen.
 */
function buildSelectionRationale(
  taskType: TaskType,
  classification: TaskClassification,
  steps: readonly PlanStep[]
): SelectionRationale {
  const deptList = [classification.primaryDepartment, ...classification.secondaryDepartments].join(", ");
  const capsList = classification.requiredCapabilities.join(", ");

  let riskMitigation = "Standard execution bounds applied.";
  if (classification.risk.requiresApproval) {
    riskMitigation = `Explicit human approval required for operations involving: ${classification.risk.sensitiveOperations.join(
      ", "
    )}. Execution will pause at designated approval gates.`;
  } else {
    riskMitigation = "Low operational risk detected; non-destructive read/inspect operations permitted.";
  }

  return {
    taskTypeRationale: `Classified as '${taskType}' with ${(classification.confidence * 100).toFixed(
      0
    )}% confidence based on intent analysis and keyword specificity.`,
    departmentRationale: `Assigned primary ownership to '${classification.primaryDepartment}' with secondary collaboration from [${deptList}] based on required domain expertise.`,
    capabilityRationale: `Identified candidate capabilities [${capsList}] necessary to achieve deliverables [${classification.expectedOutputs.join(
      ", "
    )}].`,
    stepSequenceRationale: `Organized into ${steps.length} sequential and dependent steps following the bounded lifecycle (Inspect -> Act -> Verify).`,
    riskMitigationRationale: riskMitigation,
  };
}

/**
 * Generates an inspectable TaskPlan entity without running any tools or models.
 */
export async function generatePlan(
  normalized: NormalizedRequest,
  classification: TaskClassification,
  registry: AgentRegistry,
  options: GeneratePlanOptions = {}
): Promise<TaskPlan> {
  const now = new Date().toISOString();
  const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const questions = options.clarificationQuestions ?? [];
  const hasBlockingQuestions = questions.some((q) => q.criticality === "blocking");

  // Handle Unsupported Requests
  if (!classification.isSupported) {
    const emptyRationale: SelectionRationale = {
      taskTypeRationale: "Request was identified as unsupported per system capabilities and behavioral boundaries.",
      departmentRationale: "No department assigned for unsupported request.",
      capabilityRationale: "No capabilities required.",
      stepSequenceRationale: "No execution steps generated for unsupported request.",
      riskMitigationRationale: "Execution rejected to uphold safety, legality, and product boundaries.",
    };

    return {
      id: planId,
      taskId: options.taskId,
      rawInput: normalized.rawPrompt,
      normalizedInput: normalized.normalizedPrompt,
      classification,
      steps: [],
      budgetEstimate: {
        totalEstimatedTokens: 0,
        totalEstimatedCostUsd: 0,
        estimatedDurationMs: 0,
        modelTierDistribution: { fast: 0, standard: 0, advanced: 0 },
      },
      selectionRationale: emptyRationale,
      clarificationQuestions: questions,
      completionCriteria: ["User informed of unsupported request boundaries"],
      status: "rejected",
      createdAt: now,
      updatedAt: now,
    };
  }

  // Handle Ambiguous Requests Requiring Clarification
  if (hasBlockingQuestions) {
    const provisionalRationale: SelectionRationale = {
      taskTypeRationale: `Provisional classification as '${classification.taskType}' pending clarification of critical facts.`,
      departmentRationale: `Department '${classification.primaryDepartment}' tentatively assigned.`,
      capabilityRationale: `Capabilities [${classification.requiredCapabilities.join(", ")}] tentatively mapped.`,
      stepSequenceRationale: "Execution steps paused pending clarification answers.",
      riskMitigationRationale: "Execution deferred until missing context is resolved.",
    };

    return {
      id: planId,
      taskId: options.taskId,
      rawInput: normalized.rawPrompt,
      normalizedInput: normalized.normalizedPrompt,
      classification,
      steps: [],
      budgetEstimate: {
        totalEstimatedTokens: 0,
        totalEstimatedCostUsd: 0,
        estimatedDurationMs: 0,
        modelTierDistribution: { fast: 0, standard: 0, advanced: 0 },
      },
      selectionRationale: provisionalRationale,
      clarificationQuestions: questions,
      completionCriteria: ["Missing critical facts answered by user before execution"],
      status: "needs_clarification",
      createdAt: now,
      updatedAt: now,
    };
  }

  // Generate Steps from Blueprints
  const blueprints = getStepBlueprints(classification.taskType, classification.primaryDepartment);
  const steps: PlanStep[] = [];

  let totalTokens = 0;
  let totalCost = 0;
  let totalDuration = 0;
  let fastTier = 0;
  let standardTier = 0;
  let advancedTier = 0;

  for (let i = 0; i < blueprints.length; i++) {
    const bp = blueprints[i];
    if (!bp) continue;
    const stepId = `step_${i + 1}`;
    const dependsOn = i > 0 ? [`step_${i}`] : [];

    // Query candidate agent profiles for this step from registry (strictly declarative, no model calls)
    const resolveRes = await registry.resolve({
      department: bp.department,
      taskType: classification.taskType,
      requiredCapabilities: bp.capabilities,
      limit: 3,
    });
    const candidateSlugs = resolveRes.success
      ? resolveRes.data.map((m) => m.slug)
      : [];

    const requiresApproval = Boolean(bp.requiresApprovalIfRisk && classification.risk.requiresApproval);
    const approvalReason = requiresApproval
      ? `Requires approval before executing code mutation or sensitive operations (${classification.risk.level} risk)`
      : undefined;

    steps.push({
      id: stepId,
      stepIndex: i,
      title: bp.title,
      description: bp.description,
      department: bp.department,
      candidateCapabilities: bp.capabilities,
      candidateAgentSlugs: candidateSlugs,
      dependsOn,
      estimatedTokens: bp.estimatedTokens,
      estimatedDurationMs: bp.estimatedDurationMs,
      estimatedCostUsd: bp.estimatedCostUsd,
      requiresApproval,
      approvalReason,
      completionCriteria: bp.completionCriteria,
    });

    totalTokens += bp.estimatedTokens;
    totalCost += bp.estimatedCostUsd;
    totalDuration += bp.estimatedDurationMs;

    // Track model tier expectations
    if (bp.estimatedTokens > 5000) {
      advancedTier++;
    } else if (bp.estimatedTokens > 3000) {
      standardTier++;
    } else {
      fastTier++;
    }
  }

  // Cap budget if requested
  if (options.budgetCapUsd && totalCost > options.budgetCapUsd) {
    totalCost = options.budgetCapUsd;
  }

  const budgetEstimate: PlanBudgetEstimate = {
    totalEstimatedTokens: totalTokens,
    totalEstimatedCostUsd: Math.round(totalCost * 1000) / 1000,
    estimatedDurationMs: totalDuration,
    modelTierDistribution: {
      fast: fastTier,
      standard: standardTier,
      advanced: advancedTier,
    },
  };

  const selectionRationale = buildSelectionRationale(classification.taskType, classification, steps);

  const completionCriteria = [
    ...classification.expectedOutputs.map((out) => `Deliverable '${out}' generated and verified`),
    "All step completion criteria satisfied with zero unresolved critical errors",
  ];

  const status: PlanStatus = "ready";

  return {
    id: planId,
    taskId: options.taskId,
    rawInput: normalized.rawPrompt,
    normalizedInput: normalized.normalizedPrompt,
    classification,
    steps,
    budgetEstimate,
    selectionRationale,
    clarificationQuestions: questions,
    completionCriteria,
    status,
    createdAt: now,
    updatedAt: now,
  };
}
