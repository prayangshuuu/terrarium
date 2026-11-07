/**
 * @terrarium/core - intake/task-classifier.ts
 *
 * Deterministic task type, project context, deliverable, and capability classification engine.
 * Aligns with PLAN.md Section 5.1 (Activation Policy) and Prompt 7 requirements.
 */

import {
  type AgentDepartment,
  type ProjectContext,
  type ProjectScope,
  type TaskClassification,
  type TaskType,
} from "@terrarium/contracts";
import { type NormalizedRequest } from "./request-normalizer.ts";
import { evaluateRisk } from "./risk-detector.ts";
import { evaluateMissingFacts } from "./missing-fact-detector.ts";

interface ClassificationPattern {
  readonly taskType: TaskType;
  readonly primaryDept: AgentDepartment;
  readonly secondaryDepts: readonly AgentDepartment[];
  readonly pattern: RegExp;
  readonly capabilities: readonly string[];
  readonly outputs: readonly string[];
  readonly weight: number;
}

const CLASSIFICATION_PATTERNS: readonly ClassificationPattern[] = [
  // Unsupported patterns
  {
    taskType: "unsupported",
    primaryDept: "executive",
    secondaryDepts: [],
    pattern: /\b(?:order\s+(?:a\s+)?pizza|wash\s+my\s+car|clean\s+(?:my\s+)?room|cook\s+dinner|medical\s+diagnosis|prescribe\s+medication|ddos\s+|launch\s+cyberattack|steal\s+passwords|write\s+ransomware)\b/i,
    capabilities: [],
    outputs: ["unsupported_notification"],
    weight: 100,
  },

  // Security Audit
  {
    taskType: "security_audit",
    primaryDept: "security",
    secondaryDepts: ["engineering", "research"],
    pattern: /\b(?:(?:run|conduct|perform)?(?:\s+(?:a|an|the))?\s*security\s+audit|threat\s+model|vulnerabilit(?:y|ies)|cve|penetration\s+test|auth\s+check|permissions?\s+audit|secret\s+leak|owasp|sql\s+injection|xss)\b/i,
    capabilities: ["vulnerability_assessment", "threat_modeling", "security_review"],
    outputs: ["security_audit_report", "threat_model", "remediation_checklist"],
    weight: 85,
  },

  // Customer Simulation
  {
    taskType: "customer_simulation",
    primaryDept: "customer_intelligence",
    secondaryDepts: ["product", "marketing"],
    pattern: /\b(?:customer\s+simulation|simulate(?:\s+(?:how|what|the))?\s*(?:customer|user|buyer|persona)|persona\s+reaction|buying\s+criteria|purchase\s+objection|pricing\s+sensitivity|adoption\s+barrier|customer\s+feedback)\b/i,
    capabilities: ["persona_simulation", "user_research", "feedback_synthesis"],
    outputs: ["simulated_customer_report", "objections_and_reactions", "validation_recommendations"],
    weight: 80,
  },

  // Architecture Review
  {
    taskType: "architecture_review",
    primaryDept: "engineering",
    secondaryDepts: ["research", "product"],
    pattern: /\b(?:(?:conduct|perform|run)?(?:\s+(?:an?|the))?\s*architecture\s+review|system\s+design|architectural\s+trade-?off|domain\s+boundaries|evaluate\s+(?:the\s+)?architecture|modularity|subsystem\s+design|adr)\b/i,
    capabilities: ["architecture_analysis", "system_design", "technical_evaluation"],
    outputs: ["architecture_review_report", "tradeoff_matrix", "boundary_recommendations"],
    weight: 75,
  },

  // Business Strategy
  {
    taskType: "business_strategy",
    primaryDept: "executive",
    secondaryDepts: ["marketing", "product"],
    pattern: /\b(?:business\s+strategy|business\s+model|unit\s+economics|monetization|pricing\s+model|market\s+sizing|tam|competitor\s+analysis|go-to-market|gtm)\b/i,
    capabilities: ["business_strategy", "market_analysis", "financial_modeling"],
    outputs: ["business_strategy_brief", "pricing_hypothesis_doc", "competitor_matrix"],
    weight: 70,
  },

  // Bug Fix
  {
    taskType: "bug_fix",
    primaryDept: "engineering",
    secondaryDepts: ["product"],
    pattern: /\b(?:fix(?:\s+(?:the|a|an|this|that))?\s+(?:bug|defect|issue|error|crash|problem)|resolve(?:\s+(?:the|a|an|this|that))?\s+error|patch(?:\s+(?:the|a|an))?\s+defect|stack\s+trace|crash|exception|regression|failing\s+test)\b/i,
    capabilities: ["code_investigation", "code_implementation", "test_verification"],
    outputs: ["bug_fix_patch", "regression_test", "root_cause_summary"],
    weight: 65,
  },

  // Test Generation
  {
    taskType: "test_generation",
    primaryDept: "engineering",
    secondaryDepts: ["product"],
    pattern: /\b(?:write\s+tests?|generate\s+tests?|unit\s+tests?|integration\s+tests?|test\s+suite|coverage|test\s+cases?)\b/i,
    capabilities: ["test_generation", "test_automation", "coverage_analysis"],
    outputs: ["test_suite", "verification_evidence", "coverage_report"],
    weight: 60,
  },

  // Refactoring
  {
    taskType: "refactoring",
    primaryDept: "engineering",
    secondaryDepts: ["product"],
    pattern: /\b(?:refactor|clean\s+up\s+code|decouple|simplify\s+code|extract\s+function|reduce\s+complexity|reorganize\s+code)\b/i,
    capabilities: ["code_refactoring", "code_analysis", "type_safety_audit"],
    outputs: ["refactored_code", "verification_check_results"],
    weight: 55,
  },

  // Code Generation
  {
    taskType: "code_generation",
    primaryDept: "engineering",
    secondaryDepts: ["product", "design"],
    pattern: /\b(?:implement|build(?:\s+(?:a|an|the))?\s+feature|create\s+(?:a\s+)?feature|add\s+(?:an?\s+)?endpoint|scaffold|write\s+code|develop|add\s+(?:a\s+)?module)\b/i,
    capabilities: ["code_implementation", "api_design", "test_generation"],
    outputs: ["feature_code", "unit_tests", "implementation_notes"],
    weight: 50,
  },

  // Documentation
  {
    taskType: "documentation",
    primaryDept: "documentation",
    secondaryDepts: ["engineering", "product"],
    pattern: /\b(?:write\s+docs?|document\s+|readme|api\s+docs?|guide|architecture\s+documentation|spec(?:ification)?)\b/i,
    capabilities: ["technical_writing", "documentation_generation", "api_documentation"],
    outputs: ["documentation_markdown", "usage_examples"],
    weight: 45,
  },

  // General Inquiry
  {
    taskType: "general_inquiry",
    primaryDept: "engineering",
    secondaryDepts: ["product"],
    pattern: /\b(?:what\s+is|how\s+does|explain|overview|summary|list\s+|help\s+with)\b/i,
    capabilities: ["code_analysis", "system_explanation"],
    outputs: ["explanation_summary"],
    weight: 30,
  },
];

/**
 * Detects languages and frameworks from path names and keywords.
 */
function inferProjectTechnologies(
  paths: readonly string[],
  text: string
): { languages: string[]; frameworks: string[] } {
  const languages = new Set<string>();
  const frameworks = new Set<string>();

  for (const path of paths) {
    if (path.endsWith(".ts") || path.endsWith(".tsx")) languages.add("typescript");
    if (path.endsWith(".js") || path.endsWith(".jsx")) languages.add("javascript");
    if (path.endsWith(".py")) languages.add("python");
    if (path.endsWith(".rs")) languages.add("rust");
    if (path.endsWith(".go")) languages.add("go");
    if (path.endsWith(".sql")) languages.add("sql");
    if (path.endsWith(".md")) languages.add("markdown");
  }

  const lower = text.toLowerCase();
  if (lower.includes("typescript") || lower.includes("ts")) languages.add("typescript");
  if (lower.includes("python")) languages.add("python");
  if (lower.includes("sqlite")) frameworks.add("sqlite");
  if (lower.includes("bun")) frameworks.add("bun");
  if (lower.includes("react") || lower.includes("opentui")) frameworks.add("react");

  return {
    languages: Array.from(languages),
    frameworks: Array.from(frameworks),
  };
}

/**
 * Infers the scope of project interaction from paths and word context.
 */
function inferProjectScope(
  paths: readonly string[],
  text: string,
  userScope?: ProjectScope
): ProjectScope {
  if (userScope) return userScope;
  const firstPath = paths[0];
  if (paths.length === 1 && firstPath && !firstPath.includes("*")) return "single_file";
  if (paths.length > 1) return "multi_file";
  if (/\b(?:package|module|subsystem)\b/i.test(text)) return "module";
  if (/\b(?:repo|repository|codebase|workspace|entire\s+project)\b/i.test(text)) return "full_codebase";
  return "conceptual";
}

export interface ClassifyTaskOptions {
  readonly projectContext?: Partial<ProjectContext>;
  readonly explicitDepartment?: AgentDepartment;
  readonly autoApproveLowRisk?: boolean;
  readonly clarificationAnswers?: Readonly<Record<string, string>>;
}

/**
 * Classifies a normalized task request into a structured TaskClassification entity.
 */
export function classifyTask(
  normalized: NormalizedRequest,
  options: ClassifyTaskOptions = {}
): TaskClassification {
  const text = normalized.normalizedPrompt;
  const paths = normalized.extractedFilePaths;

  // 1. Evaluate Risk
  const risk = evaluateRisk(normalized, { autoApproveLowRisk: options.autoApproveLowRisk });

  // 2. Evaluate Missing Facts and Epistemic Uncertainty
  const missingFacts = evaluateMissingFacts(normalized, options.clarificationAnswers);

  // 3. Pattern Matching for Task Type
  let matchedPattern: ClassificationPattern | undefined;
  for (const pattern of CLASSIFICATION_PATTERNS) {
    if (pattern.pattern.test(text)) {
      matchedPattern = pattern;
      break;
    }
  }

  // Default to general inquiry if no pattern matched
  if (!matchedPattern) {
    matchedPattern = CLASSIFICATION_PATTERNS.find((p) => p.taskType === "general_inquiry")!;
  }

  const isSupported = matchedPattern.taskType !== "unsupported";
  let unsupportedReason: string | undefined;
  if (!isSupported) {
    unsupportedReason =
      "Request involves out-of-scope non-software actions, physical execution, unverified legal/medical counsel, or unauthorized actions.";
  }

  // Department assignment: user override takes precedence, then normalized directive, then pattern primary
  const primaryDepartment: AgentDepartment =
    options.explicitDepartment ?? normalized.explicitDepartment ?? matchedPattern.primaryDept;

  const secondaryDepartments = matchedPattern.secondaryDepts.filter((d) => d !== primaryDepartment);

  // 4. Infer Project Context
  const tech = inferProjectTechnologies(paths, text);
  const scope = inferProjectScope(paths, text, options.projectContext?.scope);
  const projectContext: ProjectContext = {
    name: options.projectContext?.name,
    rootDir: options.projectContext?.rootDir,
    scope,
    detectedLanguages: tech.languages.length > 0 ? tech.languages : options.projectContext?.detectedLanguages,
    detectedFrameworks: tech.frameworks.length > 0 ? tech.frameworks : options.projectContext?.detectedFrameworks,
    fileTargets: paths.length > 0 ? paths : options.projectContext?.fileTargets,
  };

  // 5. Confidence scoring
  let confidence = 0.85;
  if (matchedPattern.taskType === "general_inquiry") {
    confidence = 0.6;
  }
  if (missingFacts.hasBlockingQuestions) {
    confidence = Math.min(confidence, 0.5);
  }

  return {
    taskType: matchedPattern.taskType,
    confidence,
    primaryDepartment,
    secondaryDepartments,
    requiredCapabilities: matchedPattern.capabilities,
    expectedOutputs: matchedPattern.outputs,
    projectContext,
    risk,
    uncertainty: missingFacts.uncertainty,
    isSupported,
    unsupportedReason,
  };
}
