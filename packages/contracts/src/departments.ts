/**
 * @terrarium/contracts - departments.ts
 *
 * Department definitions, metadata, and validation.
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

export const DEPARTMENTS: Readonly<Record<AgentDepartment, DepartmentInfo>> = {
  executive: {
    id: "executive",
    name: "Executive Leadership",
    description: "Business strategy, thesis evaluation, high-level priorities, and trade-off analysis.",
    defaultLeadRole: "Chief Executive Officer (CEO)",
    isSimulatedPersona: false,
  },
  engineering: {
    id: "engineering",
    name: "Engineering",
    description: "Software architecture, full-stack development, code review, test strategies, and infra.",
    defaultLeadRole: "Principal Software Architect",
    isSimulatedPersona: false,
  },
  customer_intelligence: {
    id: "customer_intelligence",
    name: "Customer Intelligence (Simulated)",
    description: "Simulated persona feedback, purchase objections, onboarding usability, and pricing sensitivity.",
    defaultLeadRole: "Simulated Customer Research Lead",
    isSimulatedPersona: true,
  },
  product: {
    id: "product",
    name: "Product Management",
    description: "User journeys, requirement discovery, feature scoping, and roadmap prioritization.",
    defaultLeadRole: "VP of Product",
    isSimulatedPersona: false,
  },
  design: {
    id: "design",
    name: "Design & UX",
    description: "Information architecture, terminal/visual UI usability, and design systems.",
    defaultLeadRole: "Design Director",
    isSimulatedPersona: false,
  },
  marketing: {
    id: "marketing",
    name: "Marketing & Growth",
    description: "Positioning, competitive differentiation, go-to-market channels, and value proposition.",
    defaultLeadRole: "Head of Growth",
    isSimulatedPersona: false,
  },
  security: {
    id: "security",
    name: "Security & Compliance",
    description: "Threat modeling, data privacy boundaries, dependency vulnerability, and least-privilege auditing.",
    defaultLeadRole: "Chief Information Security Officer (CISO)",
    isSimulatedPersona: false,
  },
  research: {
    id: "research",
    name: "Research & Intelligence",
    description: "Technical literature research, external provider comparison, and state-of-the-art evaluation.",
    defaultLeadRole: "Lead Research Scientist",
    isSimulatedPersona: false,
  },
  documentation: {
    id: "documentation",
    name: "Documentation",
    description: "Technical specifications, onboarding guides, API documentation, and architecture records.",
    defaultLeadRole: "Staff Technical Writer",
    isSimulatedPersona: false,
  },
  legal: {
    id: "legal",
    name: "Legal & Risk Analysis",
    description: "Intellectual property risk spotting, open-source license review, and compliance questions.",
    defaultLeadRole: "General Counsel & Risk Specialist",
    isSimulatedPersona: false,
  },
};

export function getDepartmentInfo(id: AgentDepartment): DepartmentInfo {
  return DEPARTMENTS[id];
}

export function validateDepartment(value: unknown, path = "department"): Result<AgentDepartment, DomainValidationError> {
  const res = validateEnum(value, path, AGENT_DEPARTMENTS);
  if (!res.success) {
    return fail(new DomainValidationError(res.error.message, [res.error]));
  }
  return ok(res.data);
}
