/**
 * @terrarium/core - intake/task-intake-service.ts
 *
 * Core coordinator for the request-to-draft lifecycle.
 * Invariant: Planning strictly classifies, evaluates, and schedules WITHOUT
 * executing tools, spawning agent processes, or invoking provider LLMs.
 * Aligns with PLAN.md Section 5.1 & 5.4, and Prompt 7 requirements.
 */

import {
  type AgentRegistry,
  type Result,
  type Task,
  type TaskIntakeInput,
  type TaskPlan,
  type TerrariumError,
  type TerrariumRepositories,
  ok,
  fail,
  DomainValidationError,
} from "@terrarium/contracts";
import { type NormalizedRequest, normalizeRequest } from "./request-normalizer.ts";
import { classifyTask } from "./task-classifier.ts";
import { evaluateMissingFacts } from "./missing-fact-detector.ts";
import { generatePlan } from "./plan-generator.ts";

export interface TaskIntakeResult {
  readonly plan: TaskPlan;
  readonly draftTask?: Task;
  readonly isReadyForExecution: boolean;
  readonly normalized: NormalizedRequest;
}

export interface TaskIntakeServiceOptions {
  readonly registry: AgentRegistry;
  readonly repositories?: TerrariumRepositories;
}

export interface ProcessIntakeOptions {
  readonly persistDraftTask?: boolean;
  readonly persistPlan?: boolean;
}

export class TaskIntakeService {
  private readonly registry: AgentRegistry;
  private readonly repositories?: TerrariumRepositories;

  constructor(options: TaskIntakeServiceOptions) {
    this.registry = options.registry;
    this.repositories = options.repositories;
  }

  /**
   * Orchestrates the complete request-to-draft intake lifecycle.
   * Purely deterministic and analytical; never executes tools or agent sessions.
   */
  async processIntake(
    input: TaskIntakeInput,
    options: ProcessIntakeOptions = {}
  ): Promise<Result<TaskIntakeResult, TerrariumError>> {
    if (!input || typeof input.prompt !== "string" || input.prompt.trim().length === 0) {
      return fail(
        new DomainValidationError("Task intake input must include a non-empty prompt", [
          { path: "prompt", message: "Prompt must not be empty", received: input?.prompt },
        ])
      );
    }

    // 1. Normalize input without altering user intent
    const normalized = normalizeRequest(input.prompt);

    // 2. Classify task type, project context, deliverables, risk, uncertainty, capabilities
    const classification = classifyTask(normalized, {
      projectContext: input.projectContext,
      explicitDepartment: input.explicitDepartment,
      autoApproveLowRisk: input.autoApproveLowRisk,
      clarificationAnswers: input.clarificationAnswers,
    });

    // 3. Discover missing facts and formulate clarification questions
    const missingFacts = evaluateMissingFacts(normalized, input.clarificationAnswers);

    // 4. Generate inspectable plan with steps, candidate capabilities, budget, and rationale
    let plan = await generatePlan(normalized, classification, this.registry, {
      budgetCapUsd: input.budgetCapUsd,
      clarificationQuestions: missingFacts.questions,
    });

    let draftTask: Task | undefined;

    // 5. Optionally create and persist draft Task entity if supported
    const shouldPersistDraft = options.persistDraftTask ?? (this.repositories !== undefined && classification.isSupported);
    if (shouldPersistDraft) {
      const now = new Date().toISOString();
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Derive concise title
      const firstLine = normalized.normalizedPrompt.split("\n")[0] ?? "";
      let title = firstLine.trim();
      if (title.length > 80) {
        title = `${title.substring(0, 77)}...`;
      }
      if (title.length === 0) {
        title = `Task: ${classification.taskType}`;
      }

      draftTask = {
        id: taskId,
        title,
        description: normalized.normalizedPrompt,
        department: classification.primaryDepartment,
        status: "draft",
        priority: normalized.explicitPriority ?? "medium",
        contextRefs: normalized.extractedFilePaths.map((fp) => ({
          type: "file",
          target: fp,
          description: "Referenced in task intake request",
        })),
        expectedDeliverables: classification.expectedOutputs,
        delegationDepth: 0,
        createdAt: now,
        updatedAt: now,
      };

      if (this.repositories) {
        const createRes = await this.repositories.tasks.create(draftTask);
        if (!createRes.success) {
          return fail(createRes.error);
        }
      }

      // Associate task ID with plan
      plan = {
        ...plan,
        taskId: draftTask.id,
      };
    }

    // 6. Optionally persist inspectable plan
    const shouldPersistPlan = options.persistPlan ?? (this.repositories !== undefined);
    if (shouldPersistPlan && this.repositories) {
      const planRes = await this.repositories.plans.create(plan);
      if (!planRes.success) {
        return fail(planRes.error);
      }
    }

    const isReadyForExecution = plan.status === "ready" && !missingFacts.hasBlockingQuestions;

    return ok({
      plan,
      draftTask,
      isReadyForExecution,
      normalized,
    });
  }
}

/**
 * Convenience factory for TaskIntakeService.
 */
export function createTaskIntakeService(options: TaskIntakeServiceOptions): TaskIntakeService {
  return new TaskIntakeService(options);
}
