/**
 * @terrarium/contracts - planning.ts
 *
 * Task intake, classification, plan structures, risk/uncertainty models, and validation.
 * Aligns strictly with PLAN.md Section 5.1 (Activation Policy), Section 5.4 (Task Lifecycle),
 * and Section 6.1 (Project Intake).
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { AGENT_DEPARTMENTS, type AgentDepartment } from "./departments.ts";
import { DomainValidationError, type ValidationIssue } from "./errors.ts";
import {
  isRecord,
  validateArray,
  validateEnum,
  validateIsoDateTime,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

/**
 * Supported task classification types.
 */
export const TASK_TYPES = [
  "architecture_review",
  "code_generation",
  "bug_fix",
  "security_audit",
  "customer_simulation",
  "business_strategy",
  "test_generation",
  "refactoring",
  "documentation",
  "general_inquiry",
  "unsupported",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

/**
 * Operational risk severity levels.
 */
export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * Epistemic uncertainty levels reflecting missing facts or ambiguity.
 */
export const UNCERTAINTY_LEVELS = ["low", "medium", "high"] as const;
export type UncertaintyLevel = (typeof UNCERTAINTY_LEVELS)[number];

/**
 * Lifecycle status of an inspectable plan.
 */
export const PLAN_STATUSES = [
  "draft",
  "ready",
  "needs_clarification",
  "rejected",
  "approved",
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/**
 * Project scope granularity.
 */
export const PROJECT_SCOPES = [
  "conceptual",
  "single_file",
  "multi_file",
  "module",
  "full_codebase",
] as const;
export type ProjectScope = (typeof PROJECT_SCOPES)[number];

/**
 * Contextual project metadata associated with task intake.
 */
export interface ProjectContext {
  readonly name?: string;
  readonly rootDir?: string;
  readonly scope: ProjectScope;
  readonly detectedLanguages?: readonly string[];
  readonly detectedFrameworks?: readonly string[];
  readonly fileTargets?: readonly string[];
}

/**
 * Risk evaluation result with actionable factors, mitigations, and approval gates.
 */
export interface RiskAssessment {
  readonly level: RiskLevel;
  readonly score: number; // 0 - 100
  readonly factors: readonly string[];
  readonly mitigations: readonly string[];
  readonly requiresApproval: boolean;
  readonly sensitiveOperations: readonly string[];
}

/**
 * Epistemic uncertainty evaluation detailing missing facts and ambiguities.
 */
export interface UncertaintyAssessment {
  readonly level: UncertaintyLevel;
  readonly score: number; // 0 - 100
  readonly reasons: readonly string[];
  readonly missingInformation: readonly string[];
}

/**
 * Clarification question presented when critical information is missing.
 */
export interface ClarificationQuestion {
  readonly id: string;
  readonly question: string;
  readonly rationale: string;
  readonly criticality: "blocking" | "advisory";
  readonly suggestedOptions?: readonly string[];
  readonly category: "scope" | "target" | "constraints" | "permissions" | "business_logic";
}

/**
 * Structured classification of a normalized task request.
 */
export interface TaskClassification {
  readonly taskType: TaskType;
  readonly confidence: number; // 0.0 - 1.0
  readonly primaryDepartment: AgentDepartment;
  readonly secondaryDepartments: readonly AgentDepartment[];
  readonly requiredCapabilities: readonly string[];
  readonly expectedOutputs: readonly string[];
  readonly projectContext: ProjectContext;
  readonly risk: RiskAssessment;
  readonly uncertainty: UncertaintyAssessment;
  readonly isSupported: boolean;
  readonly unsupportedReason?: string;
}

/**
 * Concrete, inspectable execution step within a plan.
 */
export interface PlanStep {
  readonly id: string;
  readonly stepIndex: number;
  readonly title: string;
  readonly description: string;
  readonly department: AgentDepartment;
  readonly candidateCapabilities: readonly string[];
  readonly candidateAgentSlugs: readonly string[];
  readonly dependsOn: readonly string[];
  readonly estimatedTokens: number;
  readonly estimatedDurationMs: number;
  readonly estimatedCostUsd: number;
  readonly requiresApproval: boolean;
  readonly approvalReason?: string;
  readonly completionCriteria: readonly string[];
}

/**
 * Aggregated resource budget estimate for a plan.
 */
export interface PlanBudgetEstimate {
  readonly totalEstimatedTokens: number;
  readonly totalEstimatedCostUsd: number;
  readonly estimatedDurationMs: number;
  readonly modelTierDistribution: Readonly<Record<"fast" | "standard" | "advanced", number>>;
}

/**
 * Explainable selection rationale justifying the chosen strategy.
 */
export interface SelectionRationale {
  readonly taskTypeRationale: string;
  readonly departmentRationale: string;
  readonly capabilityRationale: string;
  readonly stepSequenceRationale: string;
  readonly riskMitigationRationale: string;
}

/**
 * Complete, inspectable plan entity generated during task intake.
 */
export interface TaskPlan extends BaseEntity {
  readonly taskId?: string;
  readonly rawInput: string;
  readonly normalizedInput: string;
  readonly classification: TaskClassification;
  readonly steps: readonly PlanStep[];
  readonly budgetEstimate: PlanBudgetEstimate;
  readonly selectionRationale: SelectionRationale;
  readonly clarificationQuestions: readonly ClarificationQuestion[];
  readonly completionCriteria: readonly string[];
  readonly status: PlanStatus;
}

/**
 * Input arguments for task intake and plan drafting.
 */
export interface TaskIntakeInput {
  readonly prompt: string;
  readonly projectContext?: Partial<ProjectContext>;
  readonly explicitDepartment?: AgentDepartment;
  readonly budgetCapUsd?: number;
  readonly autoApproveLowRisk?: boolean;
  readonly clarificationAnswers?: Readonly<Record<string, string>>;
}

/**
 * Validates a ProjectContext structure.
 */
export function validateProjectContext(
  value: unknown,
  path = "projectContext"
): Result<ProjectContext, ValidationIssue> {
  if (!isRecord(value)) {
    return fail({ path, message: "Expected object for ProjectContext", received: value });
  }

  const scopeRes = validateEnum(value.scope ?? "conceptual", `${path}.scope`, PROJECT_SCOPES);
  if (!scopeRes.success) return scopeRes;

  return ok({
    name: typeof value.name === "string" ? value.name : undefined,
    rootDir: typeof value.rootDir === "string" ? value.rootDir : undefined,
    scope: scopeRes.data,
    detectedLanguages: Array.isArray(value.detectedLanguages)
      ? (value.detectedLanguages.filter((l): l is string => typeof l === "string"))
      : undefined,
    detectedFrameworks: Array.isArray(value.detectedFrameworks)
      ? (value.detectedFrameworks.filter((f): f is string => typeof f === "string"))
      : undefined,
    fileTargets: Array.isArray(value.fileTargets)
      ? (value.fileTargets.filter((t): t is string => typeof t === "string"))
      : undefined,
  });
}

/**
 * Validates a RiskAssessment structure.
 */
export function validateRiskAssessment(
  value: unknown,
  path = "riskAssessment"
): Result<RiskAssessment, ValidationIssue> {
  if (!isRecord(value)) {
    return fail({ path, message: "Expected object for RiskAssessment", received: value });
  }

  const levelRes = validateEnum(value.level, `${path}.level`, RISK_LEVELS);
  if (!levelRes.success) return levelRes;

  const scoreRes = validateNumber(value.score, `${path}.score`, { min: 0, max: 100 });
  if (!scoreRes.success) return scoreRes;

  return ok({
    level: levelRes.data,
    score: scoreRes.data,
    factors: Array.isArray(value.factors) ? value.factors.filter((f): f is string => typeof f === "string") : [],
    mitigations: Array.isArray(value.mitigations)
      ? value.mitigations.filter((m): m is string => typeof m === "string")
      : [],
    requiresApproval: Boolean(value.requiresApproval),
    sensitiveOperations: Array.isArray(value.sensitiveOperations)
      ? value.sensitiveOperations.filter((s): s is string => typeof s === "string")
      : [],
  });
}

/**
 * Validates an UncertaintyAssessment structure.
 */
export function validateUncertaintyAssessment(
  value: unknown,
  path = "uncertaintyAssessment"
): Result<UncertaintyAssessment, ValidationIssue> {
  if (!isRecord(value)) {
    return fail({ path, message: "Expected object for UncertaintyAssessment", received: value });
  }

  const levelRes = validateEnum(value.level, `${path}.level`, UNCERTAINTY_LEVELS);
  if (!levelRes.success) return levelRes;

  const scoreRes = validateNumber(value.score, `${path}.score`, { min: 0, max: 100 });
  if (!scoreRes.success) return scoreRes;

  return ok({
    level: levelRes.data,
    score: scoreRes.data,
    reasons: Array.isArray(value.reasons) ? value.reasons.filter((r): r is string => typeof r === "string") : [],
    missingInformation: Array.isArray(value.missingInformation)
      ? value.missingInformation.filter((m): m is string => typeof m === "string")
      : [],
  });
}

/**
 * Validates a ClarificationQuestion structure.
 */
export function validateClarificationQuestion(
  value: unknown,
  path = "clarificationQuestion"
): Result<ClarificationQuestion, ValidationIssue> {
  if (!isRecord(value)) {
    return fail({ path, message: "Expected object for ClarificationQuestion", received: value });
  }

  const idRes = validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 });
  if (!idRes.success) return idRes;

  const questionRes = validateString(value.question, `${path}.question`, { minLength: 1, maxLength: 500 });
  if (!questionRes.success) return questionRes;

  const rationaleRes = validateString(value.rationale, `${path}.rationale`, { minLength: 1, maxLength: 1000 });
  if (!rationaleRes.success) return rationaleRes;

  const critRes = validateEnum(value.criticality, `${path}.criticality`, ["blocking", "advisory"] as const);
  if (!critRes.success) return critRes;

  const catRes = validateEnum(value.category, `${path}.category`, [
    "scope",
    "target",
    "constraints",
    "permissions",
    "business_logic",
  ] as const);
  if (!catRes.success) return catRes;

  return ok({
    id: idRes.data,
    question: questionRes.data,
    rationale: rationaleRes.data,
    criticality: critRes.data,
    category: catRes.data,
    suggestedOptions: Array.isArray(value.suggestedOptions)
      ? value.suggestedOptions.filter((o): o is string => typeof o === "string")
      : undefined,
  });
}

/**
 * Validates a PlanStep boundary input.
 */
export function validatePlanStep(value: unknown, path = "planStep"): Result<PlanStep, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const stepIndex = collector.check(
    validateNumber(value.stepIndex, `${path}.stepIndex`, { min: 0, integer: true })
  );
  const title = collector.check(validateString(value.title, `${path}.title`, { minLength: 1, maxLength: 200 }));
  const description = collector.check(
    validateString(value.description, `${path}.description`, { minLength: 1, maxLength: 5000 })
  );
  const department = collector.check(validateEnum(value.department, `${path}.department`, AGENT_DEPARTMENTS));
  const estimatedTokens = collector.check(
    validateNumber(value.estimatedTokens, `${path}.estimatedTokens`, { min: 0, integer: true })
  );
  const estimatedDurationMs = collector.check(
    validateNumber(value.estimatedDurationMs, `${path}.estimatedDurationMs`, { min: 0, integer: true })
  );
  const estimatedCostUsd = collector.check(
    validateNumber(value.estimatedCostUsd, `${path}.estimatedCostUsd`, { min: 0 })
  );

  const candidateCapabilities = collector.check(
    validateArray(value.candidateCapabilities ?? [], `${path}.candidateCapabilities`, (c, cPath) =>
      validateString(c, cPath, { minLength: 1, maxLength: 100 })
    )
  );

  const candidateAgentSlugs = collector.check(
    validateArray(value.candidateAgentSlugs ?? [], `${path}.candidateAgentSlugs`, (s, sPath) =>
      validateString(s, sPath, { minLength: 1, maxLength: 100 })
    )
  );

  const dependsOn = collector.check(
    validateArray(value.dependsOn ?? [], `${path}.dependsOn`, (d, dPath) =>
      validateString(d, dPath, { minLength: 1, maxLength: 100 })
    )
  );

  const completionCriteria = collector.check(
    validateArray(value.completionCriteria ?? [], `${path}.completionCriteria`, (cc, ccPath) =>
      validateString(cc, ccPath, { minLength: 1, maxLength: 300 })
    )
  );

  if (
    collector.hasIssues() ||
    id === undefined ||
    stepIndex === undefined ||
    title === undefined ||
    description === undefined ||
    department === undefined ||
    estimatedTokens === undefined ||
    estimatedDurationMs === undefined ||
    estimatedCostUsd === undefined
  ) {
    return fail(collector.toError("PlanStep validation failed"));
  }

  return ok({
    id,
    stepIndex,
    title,
    description,
    department,
    candidateCapabilities: candidateCapabilities ?? [],
    candidateAgentSlugs: candidateAgentSlugs ?? [],
    dependsOn: dependsOn ?? [],
    estimatedTokens,
    estimatedDurationMs,
    estimatedCostUsd,
    requiresApproval: Boolean(value.requiresApproval),
    approvalReason: typeof value.approvalReason === "string" ? value.approvalReason : undefined,
    completionCriteria: completionCriteria ?? [],
  });
}

/**
 * Validates a TaskPlan entity boundary input.
 */
export function validateTaskPlan(value: unknown, path = "taskPlan"): Result<TaskPlan, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const rawInput = collector.check(
    validateString(value.rawInput, `${path}.rawInput`, { minLength: 1, maxLength: 50000 })
  );
  const normalizedInput = collector.check(
    validateString(value.normalizedInput, `${path}.normalizedInput`, { minLength: 1, maxLength: 50000 })
  );
  const status = collector.check(validateEnum(value.status, `${path}.status`, PLAN_STATUSES));
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));

  const steps = collector.check(
    validateArray(value.steps ?? [], `${path}.steps`, (s, sPath) => {
      const sRes = validatePlanStep(s, sPath);
      if (!sRes.success) {
        return fail({ path: sPath, message: sRes.error.message, received: s });
      }
      return ok(sRes.data);
    })
  );

  const clarificationQuestions = collector.check(
    validateArray(value.clarificationQuestions ?? [], `${path}.clarificationQuestions`, validateClarificationQuestion)
  );

  const completionCriteria = collector.check(
    validateArray(value.completionCriteria ?? [], `${path}.completionCriteria`, (c, cPath) =>
      validateString(c, cPath, { minLength: 1, maxLength: 300 })
    )
  );

  if (
    collector.hasIssues() ||
    id === undefined ||
    rawInput === undefined ||
    normalizedInput === undefined ||
    status === undefined ||
    createdAt === undefined ||
    updatedAt === undefined ||
    !isRecord(value.classification) ||
    !isRecord(value.budgetEstimate) ||
    !isRecord(value.selectionRationale)
  ) {
    if (!isRecord(value.classification)) {
      collector.addIssue({ path: `${path}.classification`, message: "Expected classification object", received: value.classification });
    }
    if (!isRecord(value.budgetEstimate)) {
      collector.addIssue({ path: `${path}.budgetEstimate`, message: "Expected budgetEstimate object", received: value.budgetEstimate });
    }
    if (!isRecord(value.selectionRationale)) {
      collector.addIssue({ path: `${path}.selectionRationale`, message: "Expected selectionRationale object", received: value.selectionRationale });
    }
    return fail(collector.toError("TaskPlan validation failed"));
  }

  return ok({
    id,
    taskId: typeof value.taskId === "string" ? value.taskId : undefined,
    rawInput,
    normalizedInput,
    classification: value.classification as any,
    steps: steps ?? [],
    budgetEstimate: value.budgetEstimate as any,
    selectionRationale: value.selectionRationale as any,
    clarificationQuestions: clarificationQuestions ?? [],
    completionCriteria: completionCriteria ?? [],
    status,
    createdAt,
    updatedAt,
  });
}
