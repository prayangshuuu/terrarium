/**
 * @terrarium/core - context/context-assembler.ts
 *
 * Tailored per-agent context package assembler.
 * Replaces naive history broadcasting with role-specific, relevance-scored,
 * budget-constrained context packages.
 * Aligns strictly with PLAN_CONTEXT.md Section 6 and PLAN.md Section 14.
 */

import {
  type Result,
  ok,
  fail,
  type AgentContextPackage,
  type ContextAssemblyRequest,
  type ArtifactReference,
  type HistoryTurn,
  type MemoryCategory,
  type MemoryItem,
  type AgentProfile,
  type Task,
  type AgentDepartment,
  validateAgentContextPackage,
  ContextBudgetExceededError,
  TerrariumError,
} from "@terrarium/contracts";
import { MemoryManager } from "../memory/memory-manager.ts";
import { evaluateMemoryFreshness } from "../memory/freshness-evaluator.ts";
import { summarizeHistory } from "./history-summarizer.ts";

/**
 * Maps department focus areas to prioritized memory categories.
 */
const DEPARTMENT_CATEGORY_AFFINITY: Readonly<Record<AgentDepartment, readonly MemoryCategory[]>> = {
  executive: [
    "project_overview",
    "decision_rationale",
    "known_risk",
    "user_preference",
  ],
  engineering: [
    "architecture_knowledge",
    "decision_rationale",
    "confirmed_requirement",
    "known_risk",
  ],
  security: [
    "known_risk",
    "architecture_knowledge",
    "decision_rationale",
    "confirmed_requirement",
  ],
  product: [
    "confirmed_requirement",
    "project_overview",
    "user_preference",
    "research_finding",
    "open_question",
  ],
  design: [
    "user_preference",
    "confirmed_requirement",
    "research_finding",
  ],
  marketing: [
    "research_finding",
    "project_overview",
    "user_preference",
  ],
  customer_intelligence: [
    "user_preference",
    "research_finding",
    "open_question",
  ],
  research: [
    "research_finding",
    "open_question",
    "project_overview",
    "architecture_knowledge",
  ],
  documentation: [
    "project_overview",
    "architecture_knowledge",
    "confirmed_requirement",
    "decision_rationale",
  ],
  legal: [
    "known_risk",
    "confirmed_requirement",
    "decision_rationale",
  ],
};

export interface AssembleContextOptions {
  readonly profile?: AgentProfile;
  readonly task?: Task;
  readonly historyTurns?: readonly HistoryTurn[];
  readonly artifacts?: readonly ArtifactReference[];
  readonly defaultTokenLimit?: number; // Default: 8000
  readonly strictBudget?: boolean;
}

/**
 * Heuristic token estimator (~4 characters per token).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export class ContextAssembler {
  constructor(private readonly memoryManager: MemoryManager) {}

  /**
   * Assembles a scoped, tailored context package for a specific agent and task.
   */
  async assembleContext(
    request: ContextAssemblyRequest,
    options?: AssembleContextOptions
  ): Promise<Result<AgentContextPackage, TerrariumError>> {
    const isoNow = new Date().toISOString();
    const tokenLimit = request.maxTokens ?? options?.defaultTokenLimit ?? 8000;
    const department: AgentDepartment = options?.profile?.department ?? "engineering";

    // 1. Retrieve all project memories
    const listRes = await this.memoryManager.listMemories(
      {
        projectId: request.projectId,
        includeArchived: false,
      },
      {
        projectId: request.projectId,
        actorId: request.agentSlug,
        permissions: ["memory:read"],
      }
    );

    if (!listRes.success) return fail(listRes.error);
    const allMemories = listRes.data;

    // 2. Classify and filter memories by affinity and relevance
    const relevantMemories: MemoryItem[] = [];
    const durableDecisions: MemoryItem[] = [];
    const userPreferences: MemoryItem[] = [];
    const activeConstraints: string[] = [];
    const warnings: string[] = [];

    const categoryAffinity = DEPARTMENT_CATEGORY_AFFINITY[department] ?? [
      "project_overview",
      "decision_rationale",
      "confirmed_requirement",
    ];

    for (const item of allMemories) {
      // Evaluate freshness
      const freshEval = evaluateMemoryFreshness(item);

      // Check for stale memory warnings
      if (freshEval.isStale && !request.includeStale) {
        warnings.push(
          `[STALE MEMORY]: '${item.key}' (${item.category}) is ${freshEval.status} (${freshEval.ageDays}d old). Revalidate before relying on it.`
        );
      }

      // Check for conflict warnings
      if (item.isConflicted) {
        warnings.push(
          `[CONFLICT WARNING]: '${item.key}' conflicts with '${item.conflictWithId}'. Reason: ${item.conflictReason}`
        );
      }

      // Collect durable decisions
      if (item.category === "decision_rationale") {
        durableDecisions.push(item);
      }

      // Collect user preferences
      if (item.category === "user_preference") {
        userPreferences.push(item);
      }

      // Extract active constraints from confirmed requirements
      if (item.category === "confirmed_requirement") {
        activeConstraints.push(item.content);
      }

      // Relevance check: task-scoped OR department category affinity OR explicit requested categories
      const isTaskScoped = item.taskId === request.taskId;
      const isAffinityMatch = categoryAffinity.includes(item.category);
      const isRequestedCategory = request.categories ? request.categories.includes(item.category) : true;

      if ((isTaskScoped || isAffinityMatch) && isRequestedCategory) {
        relevantMemories.push(item);
      }
    }

    // 3. Summarize history if provided
    let conversationSummary: string | undefined = undefined;
    if (options?.historyTurns && options.historyTurns.length > 0) {
      const summaryResult = summarizeHistory(options.historyTurns, { preserveRecentTurns: 3 });
      conversationSummary = summaryResult.summary;
    }

    // 4. Token estimation and budget bounding
    let totalText = "";
    totalText += options?.task?.description ?? "";
    totalText += options?.task?.title ?? "";
    totalText += conversationSummary ?? "";
    totalText += activeConstraints.join(" ");
    totalText += relevantMemories.map((m) => m.content).join(" ");
    totalText += durableDecisions.map((d) => d.content).join(" ");
    totalText += userPreferences.map((u) => u.content).join(" ");
    if (options?.artifacts) {
      totalText += options.artifacts.map((a) => `${a.title}: ${a.summary}`).join(" ");
    }

    let tokenEstimate = estimateTokens(totalText);

    // If over token budget, trim lower-affinity general memories while preserving decisions & constraints
    if (tokenEstimate > tokenLimit) {
      if (options?.strictBudget) {
        return fail(new ContextBudgetExceededError(request.agentSlug, tokenEstimate, tokenLimit));
      }

      // Prune lower priority memories from the end of relevantMemories
      while (relevantMemories.length > 2 && tokenEstimate > tokenLimit) {
        const removed = relevantMemories.pop();
        if (removed) {
          totalText = totalText.replace(removed.content, "");
          tokenEstimate = estimateTokens(totalText);
        }
      }
      warnings.push(
        `[CONTEXT BUDGET]: Context trimmed to fit token limit of ${tokenLimit} tokens (estimated ${tokenEstimate}).`
      );
    }

    const taskBrief = {
      taskId: request.taskId,
      title: options?.task?.title ?? `Task ${request.taskId}`,
      description: options?.task?.description ?? "",
      category: options?.task?.category ?? "general",
      priority: options?.task?.priority ?? "medium",
      inputs: options?.task?.contextReferences ?? {},
      parentTaskId: options?.task?.parentTaskId,
    };

    const pkg: AgentContextPackage = {
      id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      projectId: request.projectId,
      taskId: request.taskId,
      agentSlug: request.agentSlug,
      department,
      assembledAt: isoNow,
      taskContext: taskBrief,
      relevantMemories,
      durableDecisions,
      activeConstraints,
      userPreferences,
      artifactReferences: options?.artifacts ?? [],
      conversationSummary,
      tokenEstimate,
      tokenLimit,
      warnings,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    const valRes = validateAgentContextPackage(pkg);
    if (!valRes.success) return fail(valRes.error);

    return ok(valRes.data);
  }
}
