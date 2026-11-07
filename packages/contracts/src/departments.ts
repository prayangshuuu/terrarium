/**
 * @terrarium/contracts - departments.ts
 *
 * Department definitions, metadata, taxonomy, and validation.
 * Aligns with PLAN.md Section 4.2 (Organization and Agent Model).
 */

import { type Result, ok, fail } from "./base.ts";
import { DomainValidationError } from "./errors.ts";
import { validateEnum } from "./validation-helpers.ts";

/**
 * Standard department identifiers across the virtual organization.
 */
export const AGENT_DEPARTMENTS = [
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
] as const;

export type AgentDepartment = (typeof AGENT_DEPARTMENTS)[number];

export interface DepartmentInfo {
  readonly id: AgentDepartment;
  readonly name: string;
  readonly description: string;
  readonly defaultLeadRole: string;
  readonly isSimulatedPersona: boolean;
}

/**
 * Comprehensive taxonomy metadata for virtual organization departments.
 */
export interface DepartmentTaxonomy extends DepartmentInfo {
  readonly coreCapabilities: readonly string[];
  readonly supportedTaskTypes: readonly string[];
  readonly typicalOutputs: readonly string[];
  readonly riskProfile: "low" | "medium" | "high";
  readonly defaultModelTier: "fast" | "standard" | "advanced";
}

export const DEPARTMENTS: Readonly<Record<AgentDepartment, DepartmentTaxonomy>> = {
  executive: {
    id: "executive",
    name: "Executive Leadership",
    description: "Business strategy, thesis evaluation, high-level priorities, and trade-off analysis.",
    defaultLeadRole: "Chief Executive Officer (CEO)",
    isSimulatedPersona: false,
    coreCapabilities: ["cap-strategic-direction", "cap-opportunity-eval", "cap-executive-synthesis"],
    supportedTaskTypes: [
      "thesis_validation",
      "strategic_prioritization",
      "cross_functional_alignment",
      "risk_appetite_review",
    ],
    typicalOutputs: ["Strategic briefs", "Priority decisions", "Resource trade-off summaries"],
    riskProfile: "medium",
    defaultModelTier: "advanced",
  },
  engineering: {
    id: "engineering",
    name: "Engineering",
    description: "Software architecture, full-stack development, code review, test strategies, and infra.",
    defaultLeadRole: "Principal Software Architect",
    isSimulatedPersona: false,
    coreCapabilities: [
      "cap-arch-review",
      "cap-backend-dev",
      "cap-test-design",
      "cap-code-audit",
      "cap-refactor-plan",
    ],
    supportedTaskTypes: [
      "architecture_review",
      "system_design",
      "backend_implementation",
      "test_plan_design",
      "code_review",
      "refactoring_analysis",
    ],
    typicalOutputs: ["Architecture RFCs", "Code patches", "Test suites", "Technical runbooks"],
    riskProfile: "high",
    defaultModelTier: "advanced",
  },
  customer_intelligence: {
    id: "customer_intelligence",
    name: "Customer Intelligence (Simulated)",
    description: "Simulated persona feedback, purchase objections, onboarding usability, and pricing sensitivity.",
    defaultLeadRole: "Simulated Customer Research Lead",
    isSimulatedPersona: true,
    coreCapabilities: [
      "cap-persona-reaction",
      "cap-objection-analysis",
      "cap-pricing-feedback",
      "cap-dx-evaluation",
    ],
    supportedTaskTypes: [
      "founder_perspective_feedback",
      "pricing_reaction_analysis",
      "onboarding_friction_review",
      "enterprise_readiness_audit",
      "developer_experience_feedback",
    ],
    typicalOutputs: ["Persona feedback logs", "Friction reports", "Willingness-to-pay assessments"],
    riskProfile: "low",
    defaultModelTier: "standard",
  },
  product: {
    id: "product",
    name: "Product Management",
    description: "User journeys, requirement discovery, feature scoping, and roadmap prioritization.",
    defaultLeadRole: "VP of Product",
    isSimulatedPersona: false,
    coreCapabilities: ["cap-prd-scoping", "cap-journey-mapping", "cap-spec-definition"],
    supportedTaskTypes: [
      "prd_synthesis",
      "feature_scoping",
      "acceptance_criteria_definition",
      "user_journey_mapping",
    ],
    typicalOutputs: ["Product requirements documents (PRDs)", "User journey maps", "Feature roadmaps"],
    riskProfile: "medium",
    defaultModelTier: "standard",
  },
  design: {
    id: "design",
    name: "Design & UX",
    description: "Information architecture, terminal/visual UI usability, and design systems.",
    defaultLeadRole: "Design Director",
    isSimulatedPersona: false,
    coreCapabilities: ["cap-ia-design", "cap-tui-ergonomics", "cap-a11y-review"],
    supportedTaskTypes: [
      "terminal_ui_critique",
      "information_architecture_design",
      "accessibility_audit",
      "workflow_wireframing",
    ],
    typicalOutputs: ["Terminal layout specifications", "Design tokens", "UX friction audits"],
    riskProfile: "low",
    defaultModelTier: "standard",
  },
  marketing: {
    id: "marketing",
    name: "Marketing & Growth",
    description: "Positioning, competitive differentiation, go-to-market channels, and value proposition.",
    defaultLeadRole: "Head of Growth",
    isSimulatedPersona: false,
    coreCapabilities: ["cap-positioning", "cap-diff-analysis", "cap-gtm-planning"],
    supportedTaskTypes: [
      "positioning_analysis",
      "competitive_differentiation",
      "value_prop_messaging",
      "launch_strategy",
    ],
    typicalOutputs: ["Positioning matrices", "Value proposition briefs", "Launch plans"],
    riskProfile: "low",
    defaultModelTier: "standard",
  },
  security: {
    id: "security",
    name: "Security & Compliance",
    description: "Threat modeling, data privacy boundaries, dependency vulnerability, and least-privilege auditing.",
    defaultLeadRole: "Chief Information Security Officer (CISO)",
    isSimulatedPersona: false,
    coreCapabilities: ["cap-threat-modeling", "cap-secret-audit", "cap-privilege-audit"],
    supportedTaskTypes: [
      "threat_modeling",
      "secret_leak_audit",
      "least_privilege_review",
      "dependency_cve_analysis",
    ],
    typicalOutputs: ["Threat models (STRIDE)", "Vulnerability disclosures", "Security boundary audits"],
    riskProfile: "high",
    defaultModelTier: "advanced",
  },
  research: {
    id: "research",
    name: "Research & Intelligence",
    description: "Technical literature research, external provider comparison, and state-of-the-art evaluation.",
    defaultLeadRole: "Lead Research Scientist",
    isSimulatedPersona: false,
    coreCapabilities: ["cap-literature-review", "cap-benchmark-eval", "cap-sota-synthesis"],
    supportedTaskTypes: [
      "sota_model_evaluation",
      "prompt_technique_research",
      "agent_pattern_synthesis",
      "benchmark_comparison",
    ],
    typicalOutputs: ["Research synthesis reports", "Model benchmark comparisons", "Academic reference digests"],
    riskProfile: "low",
    defaultModelTier: "advanced",
  },
  documentation: {
    id: "documentation",
    name: "Documentation",
    description: "Technical specifications, onboarding guides, API documentation, and architecture records.",
    defaultLeadRole: "Staff Technical Writer",
    isSimulatedPersona: false,
    coreCapabilities: ["cap-api-docs", "cap-runbook-authoring", "cap-docstring-audit"],
    supportedTaskTypes: [
      "api_documentation",
      "architecture_runbook_authoring",
      "developer_guide_creation",
      "docstring_audit",
    ],
    typicalOutputs: ["API reference docs", "Architecture decision records (ADRs)", "Runbooks and guides"],
    riskProfile: "low",
    defaultModelTier: "standard",
  },
  legal: {
    id: "legal",
    name: "Legal & Risk Analysis",
    description: "Intellectual property risk spotting, open-source license review, and compliance questions.",
    defaultLeadRole: "General Counsel & Risk Specialist",
    isSimulatedPersona: false,
    coreCapabilities: ["cap-license-audit", "cap-privacy-compliance", "cap-ip-review"],
    supportedTaskTypes: [
      "oss_license_audit",
      "ip_boundary_review",
      "data_privacy_compliance_check",
      "terms_of_service_analysis",
    ],
    typicalOutputs: ["License compliance matrices", "IP risk assessments", "Data privacy reviews"],
    riskProfile: "high",
    defaultModelTier: "advanced",
  },
};

export function getDepartmentInfo(id: AgentDepartment): DepartmentInfo {
  return DEPARTMENTS[id];
}

export function getDepartmentTaxonomy(id: AgentDepartment): DepartmentTaxonomy {
  return DEPARTMENTS[id];
}

export function listDepartmentTaxonomies(): readonly DepartmentTaxonomy[] {
  return AGENT_DEPARTMENTS.map((dept) => DEPARTMENTS[dept]);
}

export function validateDepartment(value: unknown, path = "department"): Result<AgentDepartment, DomainValidationError> {
  const res = validateEnum(value, path, AGENT_DEPARTMENTS);
  if (!res.success) {
    return fail(new DomainValidationError(res.error.message, [res.error]));
  }
  return ok(res.data);
}
