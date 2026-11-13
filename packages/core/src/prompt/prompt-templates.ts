/**
 * @terrarium/core - prompt/prompt-templates.ts
 *
 * Starter Prompt Templates for software engineering, architecture, and research workflows.
 * Contributed by A5 (Product & Interface Designer) & A1 (Platform & Architecture).
 * Aligns with PROMPT 26 Phase B.6. Strictly zero-emoji.
 */

import { type PromptTemplate } from "@terrarium/contracts";

export const BUILTIN_PROMPT_TEMPLATES: readonly PromptTemplate[] = [
  {
    id: "explain-codebase",
    title: "Explain Codebase Architecture",
    category: "architecture",
    description: "Inspects workspace layout, module boundaries, entry points, and domain dependencies.",
    content: "Inspect this project's architecture and module boundaries. Identify key entry points, primary data structures, domain boundaries, and explain how data flows through the application.",
    recommendedProvider: "orchestrator",
  },
  {
    id: "review-architecture",
    title: "Architectural & Coupling Review",
    category: "architecture",
    description: "Evaluates coupling, contract decoupling, state leakage across layers, and scalability.",
    content: "Perform an architectural inspection of this codebase. Evaluate modular boundaries, interface coupling, state leakage across layers, and identify architectural anti-patterns or risks.",
    recommendedProvider: "claude_code",
  },
  {
    id: "find-bug",
    title: "Find & Explain Defect",
    category: "engineering",
    description: "Investigates root cause of unexpected behavior, race conditions, or edge case failures.",
    content: "Analyze the following behavior and identify potential root causes, edge case failures, or race conditions. Propose a minimal, verified fix with regression prevention.",
    recommendedProvider: "cursor",
  },
  {
    id: "plan-feature",
    title: "Plan Bounded Feature",
    category: "engineering",
    description: "Generates an inspectable step-by-step implementation DAG with acceptance criteria.",
    content: "Draft a step-by-step implementation plan for the requested feature. Break it down into bounded, testable steps, identify required file modifications, and establish concrete acceptance criteria.",
    recommendedProvider: "orchestrator",
  },
  {
    id: "implement-feature",
    title: "Implement Bounded Feature",
    category: "engineering",
    description: "Implements code modifications strictly adhering to existing style, contracts, and boundaries.",
    content: "Implement the following feature within the specified module. Adhere strictly to existing typing, contracts, and error handling conventions. Ensure zero breaking changes to existing APIs.",
    recommendedProvider: "antigravity",
  },
  {
    id: "write-tests",
    title: "Write Test Suite",
    category: "testing",
    description: "Authors comprehensive unit and boundary tests targeting high branch coverage.",
    content: "Write a comprehensive test suite covering the target component. Include happy paths, edge cases, invalid inputs, error handling, and lifecycle transitions.",
    recommendedProvider: "cursor",
  },
  {
    id: "refactor-safely",
    title: "Safe Structural Refactoring",
    category: "engineering",
    description: "Extracts abstractions or simplifies logic while preserving behavioral invariants.",
    content: "Refactor the specified component to improve readability and maintainability. Do not alter external behavior or public contracts. Ensure all existing tests continue passing.",
    recommendedProvider: "claude_code",
  },
  {
    id: "review-pr",
    title: "Review Pull Request / Diff",
    category: "review",
    description: "Performs strict code review assessing correctness, security, performance, and style.",
    content: "Review the recent diff or pull request. Assess correctness, boundary violations, performance regressions, security vulnerabilities, and adherence to project conventions.",
    recommendedProvider: "claude_code",
  },
  {
    id: "analyze-performance",
    title: "Analyze Runtime Performance",
    category: "engineering",
    description: "Identifies hot paths, allocations, blocking I/O, and algorithmic bottlenecks.",
    content: "Analyze this implementation for performance bottlenecks, unnecessary heap allocations, unindexed lookups, or blocking operations. Recommend concrete optimizations with trade-off analysis.",
    recommendedProvider: "ollama",
  },
  {
    id: "improve-docs",
    title: "Improve Technical Documentation",
    category: "documentation",
    description: "Authors clear, concise reference documentation, runbooks, or API specifications.",
    content: "Review and enhance the technical documentation for this module. Provide clear architecture overviews, parameter descriptions, usage examples, and operational considerations.",
    recommendedProvider: "orchestrator",
  },
  {
    id: "research-question",
    title: "Research Technical Question",
    category: "research",
    description: "Conducts deep technical analysis evaluating libraries, protocols, or trade-offs.",
    content: "Investigate the following technical question or technology choice. Compare alternative approaches, cite concrete trade-offs, evaluate maintenance overhead, and provide an actionable recommendation.",
    recommendedProvider: "antigravity",
  },
];

export const STARTER_TEMPLATES = BUILTIN_PROMPT_TEMPLATES;
export const getStarterTemplates = getPromptTemplates;

/**
 * Retrieves all available prompt templates.
 */
export function getPromptTemplates(): readonly PromptTemplate[] {
  return BUILTIN_PROMPT_TEMPLATES;
}

/**
 * Finds a prompt template by ID.
 */
export function getPromptTemplateById(id: string): PromptTemplate | undefined {
  return BUILTIN_PROMPT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Searches templates by query string or options object.
 */
export function searchPromptTemplates(
  queryOrOptions: string | { query?: string; category?: string }
): readonly PromptTemplate[] {
  let q = "";
  let cat: string | undefined;

  if (typeof queryOrOptions === "string") {
    q = queryOrOptions.trim().toLowerCase();
  } else if (queryOrOptions) {
    q = (queryOrOptions.query ?? "").trim().toLowerCase();
    cat = queryOrOptions.category;
  }

  let list = BUILTIN_PROMPT_TEMPLATES;
  if (cat) {
    list = list.filter((t) => t.category === cat);
  }
  if (q) {
    list = list.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q)
    );
  }
  return list;
}

/**
 * Interpolates variables into a template's content string.
 * Automatically appends any extra provided variables as structured context.
 */
export function renderPromptTemplate(
  template: PromptTemplate,
  variables: Record<string, string> = {}
): string {
  let rendered = template.content;
  const unusedVars: [string, string][] = [];

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    if (rendered.includes(placeholder)) {
      rendered = rendered.replaceAll(placeholder, value);
    } else {
      unusedVars.push([key, value]);
    }
  }

  if (unusedVars.length > 0) {
    const extra = unusedVars.map(([k, v]) => `[${k}: ${v}]`).join("\n");
    rendered = `${rendered}\n\n${extra}`;
  }

  return rendered;
}
