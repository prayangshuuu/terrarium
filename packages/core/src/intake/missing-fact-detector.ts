/**
 * @terrarium/core - intake/missing-fact-detector.ts
 *
 * Discovers missing facts, evaluates epistemic uncertainty, and formulates clarification questions.
 * Aligns with PLAN.md Section 6.2 (Missing-requirement discovery) and Prompt 7 requirements.
 */

import {
  type ClarificationQuestion,
  type UncertaintyAssessment,
  type UncertaintyLevel,
} from "@terrarium/contracts";
import { type NormalizedRequest } from "./request-normalizer.ts";

export interface MissingFactEvaluation {
  readonly uncertainty: UncertaintyAssessment;
  readonly questions: readonly ClarificationQuestion[];
  readonly hasBlockingQuestions: boolean;
}

/**
 * Evaluates whether a request lacks essential facts or context.
 */
export function evaluateMissingFacts(
  normalized: NormalizedRequest,
  clarificationAnswers: Readonly<Record<string, string>> = {}
): MissingFactEvaluation {
  const text = normalized.normalizedPrompt.toLowerCase();
  const words = normalized.wordCount;
  const files = normalized.extractedFilePaths;

  const questions: ClarificationQuestion[] = [];
  const reasons: string[] = [];
  const missingInformation: string[] = [];

  // Check 1: Extremely short or vague request
  if (words < 4 && !text.includes("status") && !text.includes("help") && !text.includes("list")) {
    const qId = "clarify_vague_objective";
    if (!clarificationAnswers[qId]) {
      questions.push({
        id: qId,
        question: "Could you provide more detail on the desired outcome or specific task?",
        rationale: "The request contains fewer than 4 words and does not specify an actionable objective",
        criticality: "blocking",
        category: "scope",
      });
      reasons.push("Extremely concise request lacking actionable objective");
      missingInformation.push("Detailed task description or expected deliverable");
    }
  }

  // Check 2: Vague bug fix without error or file context
  const isBugFixIntent = /\b(?:fix|bug|broken|crash|error|failing|doesn't work|fails)\b/.test(text);
  if (isBugFixIntent) {
    const hasFile = files.length > 0;
    const hasErrorDetails = /\b(?:line|function|class|stack|trace|exception|undefined|null|error code)\b/.test(text);

    if (!hasFile && !hasErrorDetails && words < 12) {
      const qId = "clarify_bug_details";
      if (!clarificationAnswers[qId]) {
        questions.push({
          id: qId,
          question: "Which component or file has the issue, and what error or unexpected behavior are you seeing?",
          rationale: "Bug fixes require identifying the affected file/function and the failure condition",
          criticality: "blocking",
          category: "target",
        });
        reasons.push("Bug fix requested without identifying target file, function, or error message");
        missingInformation.push("Target file/module and observed error message or stack trace");
      }
    }
  }

  // Check 3: Vague optimization request
  const isOptimizationIntent = /\b(?:optimize|make it faster|speed up|improve performance)\b/.test(text);
  if (isOptimizationIntent && files.length === 0 && words < 10) {
    const qId = "clarify_optimization_target";
    if (!clarificationAnswers[qId]) {
      questions.push({
        id: qId,
        question: "Which specific component, query, or benchmark do you want to optimize?",
        rationale: "Optimization requires a specific target subsystem and measurable performance criteria",
        criticality: "blocking",
        category: "target",
      });
      reasons.push("Performance optimization requested without identifying target subsystem or benchmark");
      missingInformation.push("Target subsystem and baseline performance metric");
    }
  }

  // Check 4: Generic implementation request
  const isGenericBuild = /\b(?:build an app|make a website|create a system|new project)\b/.test(text);
  if (isGenericBuild && words < 12) {
    const qId = "clarify_feature_scope";
    if (!clarificationAnswers[qId]) {
      questions.push({
        id: qId,
        question: "What are the core user workflows, technology constraints, and expected deliverables for this project?",
        rationale: "Large feature creations need bounded initial scope to prevent unbounded agent loops",
        criticality: "blocking",
        category: "scope",
        suggestedOptions: [
          "Architecture and specification document first",
          "Scaffold minimal viable implementation with tests",
          "Review existing codebase before planning new module",
        ],
      });
      reasons.push("Broad conceptual project requested without initial scope boundaries");
      missingInformation.push("Core user workflows and technology stack preferences");
    }
  }

  // Check 5: Destructive action without concrete target
  const isDestructive = /\b(?:delete|drop|wipe|remove|destroy)\b/.test(text);
  if (isDestructive && files.length === 0 && !text.includes("table") && words < 10) {
    const qId = "clarify_destructive_target";
    if (!clarificationAnswers[qId]) {
      questions.push({
        id: qId,
        question: "Please confirm the exact file path, entity ID, or resource you want to delete or modify.",
        rationale: "Destructive actions require explicit, unambiguous targets to avoid irreversible data loss",
        criticality: "blocking",
        category: "permissions",
      });
      reasons.push("Destructive operation requested without unambiguous resource target");
      missingInformation.push("Explicit target resource path or identifier");
    }
  }

  // Check 6: Architecture review without target module or scope
  const isArchReview = /\b(?:architecture review|review architecture|system design review)\b/.test(text);
  if (isArchReview && files.length === 0 && words < 10) {
    const qId = "clarify_arch_scope";
    if (!clarificationAnswers[qId]) {
      questions.push({
        id: qId,
        question: "Would you like an architecture review of the entire workspace, or a specific package (e.g. core, contracts, cli)?",
        rationale: "Specifying workspace scope focuses the architectural evaluation on relevant modules",
        criticality: "advisory",
        category: "scope",
        suggestedOptions: [
          "Entire monorepo workspace",
          "Domain contracts (@terrarium/contracts)",
          "Core orchestration engine (@terrarium/core)",
          "CLI and terminal workspace (apps/cli)",
        ],
      });
      reasons.push("Architecture review requested without specifying focus package");
      missingInformation.push("Target package or module focus");
    }
  }

  // Calculate uncertainty level and score
  const blockingQuestions = questions.filter((q) => q.criticality === "blocking");
  const hasBlockingQuestions = blockingQuestions.length > 0;

  let level: UncertaintyLevel = "low";
  let score = 10;

  if (hasBlockingQuestions) {
    level = "high";
    score = 75;
  } else if (questions.length > 0) {
    level = "medium";
    score = 40;
  }

  return {
    uncertainty: {
      level,
      score,
      reasons,
      missingInformation,
    },
    questions,
    hasBlockingQuestions,
  };
}
