/**
 * @terrarium/contracts - reports.ts
 *
 * Structured report models, findings, severity ratings, and validation.
 * Aligns strictly with PLAN.md Section 15 (Reports & Deliverables).
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError, type ValidationIssue } from "./errors.ts";
import {
  isRecord,
  validateArray,
  validateBoolean,
  validateEnum,
  validateIsoDateTime,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

export const REPORT_TYPES = [
  "executive_summary",
  "product_requirements",
  "missing_requirements",
  "business_market",
  "customer_simulation",
  "pricing_hypotheses",
  "architecture_review",
  "code_review",
  "security_review",
  "performance_review",
  "test_strategy",
  "implementation_plan",
  "debate_summary",
  "final_recommendations",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const FINDING_SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_CATEGORIES = [
  "security",
  "architecture",
  "correctness",
  "performance",
  "maintainability",
  "usability",
  "business",
  "compliance",
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export interface ReportFinding {
  readonly id: string;
  readonly title: string;
  readonly severity: FindingSeverity;
  readonly category: FindingCategory;
  readonly location?: string;
  readonly explanation: string;
  readonly evidence?: string;
  readonly recommendation: string;
  readonly confidence: "high" | "medium" | "low";
  readonly isSimulated: boolean;
}

export interface Report extends BaseEntity {
  readonly taskId: string;
  readonly title: string;
  readonly reportType: ReportType;
  readonly summary: string;
  readonly findings: readonly ReportFinding[];
  readonly markdownContent: string;
  readonly agentsInvolved: readonly string[];
  readonly status: "draft" | "final";
}

export function validateReportFinding(
  value: unknown,
  path = "finding"
): Result<ReportFinding, ValidationIssue[]> {
  if (!isRecord(value)) {
    return fail([{ path, message: "Expected object for ReportFinding", received: value }]);
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const title = collector.check(validateString(value.title, `${path}.title`, { minLength: 1, maxLength: 200 }));
  const severity = collector.check(validateEnum(value.severity, `${path}.severity`, FINDING_SEVERITIES));
  const category = collector.check(validateEnum(value.category, `${path}.category`, FINDING_CATEGORIES));
  const explanation = collector.check(
    validateString(value.explanation, `${path}.explanation`, { minLength: 1, maxLength: 10000 })
  );
  const recommendation = collector.check(
    validateString(value.recommendation, `${path}.recommendation`, { minLength: 1, maxLength: 10000 })
  );
  const confidence = collector.check(
    validateEnum(value.confidence, `${path}.confidence`, ["high", "medium", "low"] as const)
  );
  const isSimulated = collector.check(validateBoolean(value.isSimulated, `${path}.isSimulated`));

  if (
    collector.hasIssues() ||
    id === undefined ||
    title === undefined ||
    severity === undefined ||
    category === undefined ||
    explanation === undefined ||
    recommendation === undefined ||
    confidence === undefined ||
    isSimulated === undefined
  ) {
    return fail(collector.issues);
  }

  return ok({
    id,
    title,
    severity,
    category,
    location: typeof value.location === "string" ? value.location : undefined,
    explanation,
    evidence: typeof value.evidence === "string" ? value.evidence : undefined,
    recommendation,
    confidence,
    isSimulated,
  });
}

export function validateReport(
  value: unknown,
  path = "report"
): Result<Report, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const taskId = collector.check(validateString(value.taskId, `${path}.taskId`, { minLength: 1, maxLength: 100 }));
  const title = collector.check(validateString(value.title, `${path}.title`, { minLength: 1, maxLength: 200 }));
  const reportType = collector.check(validateEnum(value.reportType, `${path}.reportType`, REPORT_TYPES));
  const summary = collector.check(
    validateString(value.summary, `${path}.summary`, { minLength: 1, maxLength: 5000 })
  );
  const markdownContent = collector.check(
    validateString(value.markdownContent, `${path}.markdownContent`, { minLength: 1, maxLength: 200000 })
  );
  const status = collector.check(validateEnum(value.status, `${path}.status`, ["draft", "final"] as const));
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));

  const findings = collector.check(
    validateArray<ReportFinding>(value.findings ?? [], `${path}.findings`, (f, fPath) => {
      const fRes = validateReportFinding(f, fPath);
      if (!fRes.success) return fail(fRes.error[0] ?? { path: fPath, message: "Invalid finding" });
      return ok(fRes.data);
    })
  );

  const agentsInvolved = collector.check(
    validateArray(value.agentsInvolved ?? [], `${path}.agentsInvolved`, (a, aPath) =>
      validateString(a, aPath, { minLength: 1, maxLength: 100 })
    )
  );

  if (
    collector.hasIssues() ||
    id === undefined ||
    taskId === undefined ||
    title === undefined ||
    reportType === undefined ||
    summary === undefined ||
    markdownContent === undefined ||
    status === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return fail(collector.toError("Report validation failed"));
  }

  return ok({
    id,
    taskId,
    title,
    reportType,
    summary,
    findings: findings ?? [],
    markdownContent,
    agentsInvolved: agentsInvolved ?? [],
    status,
    createdAt,
    updatedAt,
  });
}
