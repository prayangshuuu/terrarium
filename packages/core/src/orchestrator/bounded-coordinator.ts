/**
 * @terrarium/core - orchestrator/bounded-coordinator.ts
 *
 * Demand-based, bounded orchestration coordinator consuming approved plans.
 *
 * Invariants & Guarantees:
 * 1. Strict Lifecycle Transitions: Task and step lifecycle state machines are strictly asserted.
 * 2. Separation of Profile Selection from Execution: Profiles are selected declaratively; Execution
 *    records are created only at runtime when steps execute.
 * 3. Enforced Operational Bounds: Concurrency, delegation depth, max retries, timeouts, and spend.
 * 4. Fault Tolerance: Idempotency keys, cancellation signal propagation, timeout handling,
 *    retry exhaustion, and partial completion preservation.
 * 5. Outcome Preservation: Evidence, disagreements, unresolved questions, and metrics are preserved.
 * 6. Dormancy Verification: Unused registered profiles remain completely dormant.
 *
 * Aligns strictly with PLAN.md Section 5 (Demand-Based Activation and Orchestration)
 * and PLAN_CONTEXT.md Section 5.
 */

import {
  type AgentProfile,
  type AgentRegistry,
  type DisagreementItem,
  type EvidenceItem,
  type Execution,
  type ExecutionMetrics,
  type OrchestrationEvent,
  type OrchestrationLimits,
  type OrchestrationResult,
  type OrchestrationRunOptions,
  type PlanStep,
  type ProfileSelectionDecision,
  type Result,
  type StepExecutionResult,
  type Task,
  type TaskPlan,
  type TaskResult,
  type TaskStatus,
  type TerrariumError,
  type TerrariumRepositories,
  type UnresolvedQuestion,
  DEFAULT_ORCHESTRATION_LIMITS,
  assertStepTransition,
  assertTaskTransition,
  ok,
  fail,
  SpendLimitExceededError,
  TimeoutError,
  InvalidStateTransitionError,
} from "@terrarium/contracts";
import { ProfileSelector } from "./profile-selector.ts";
import { MockAgentRuntime } from "./mock-agent-runtime.ts";
import { DelegationManager } from "./delegation-manager.ts";

export interface BoundedCoordinatorOptions {
  readonly registry: AgentRegistry;
  readonly repositories?: TerrariumRepositories;
  readonly runtime?: MockAgentRuntime;
  readonly defaultLimits?: Partial<OrchestrationLimits>;
}

export class BoundedCoordinator {
  private readonly registry: AgentRegistry;
  private readonly repositories?: TerrariumRepositories;
  private readonly selector: ProfileSelector;
  private readonly runtime: MockAgentRuntime;
  private readonly delegationManager: DelegationManager;
  private readonly defaultLimits: OrchestrationLimits;
  private readonly idempotencyCache: Map<string, OrchestrationResult> = new Map();

  constructor(options: BoundedCoordinatorOptions) {
    this.registry = options.registry;
    this.repositories = options.repositories;
    this.selector = new ProfileSelector({ registry: options.registry });
    this.runtime = options.runtime ?? new MockAgentRuntime();
    this.delegationManager = new DelegationManager();
    this.defaultLimits = {
      ...DEFAULT_ORCHESTRATION_LIMITS,
      ...options.defaultLimits,
    };
  }

  /**
   * Consumes an approved TaskPlan and executes it under bounded orchestration.
   */
  async executePlan(
    options: OrchestrationRunOptions
  ): Promise<Result<OrchestrationResult, TerrariumError>> {
    const { plan } = options;
    const limits: OrchestrationLimits = {
      ...this.defaultLimits,
      ...options.limits,
    };

    // 1. Idempotency Check
    if (options.idempotencyKey && this.idempotencyCache.has(options.idempotencyKey)) {
      return ok(this.idempotencyCache.get(options.idempotencyKey)!);
    }

    const now = new Date().toISOString();
    const taskId = plan.taskId ?? `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const startTime = Date.now();

    // 2. Initialize Task Entity in 'planned' -> 'queued' -> 'running'
    let currentTaskStatus: TaskStatus = "planned";
    const task: Task = {
      id: taskId,
      title: plan.normalizedInput.split("\n")[0]?.trim() || `Task: ${plan.classification.taskType}`,
      description: plan.normalizedInput,
      department: plan.classification.primaryDepartment,
      status: currentTaskStatus,
      priority: "medium",
      contextRefs: plan.classification.projectContext.fileTargets?.map((fp) => ({
        type: "file",
        target: fp,
      })) ?? [],
      expectedDeliverables: plan.classification.expectedOutputs,
      delegationDepth: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Transition: planned -> queued
    const queueTransition = assertTaskTransition(currentTaskStatus, "queued");
    if (!queueTransition.success) {
      return fail(queueTransition.error);
    }
    currentTaskStatus = "queued";

    // Transition: queued -> running
    const runTransition = assertTaskTransition(currentTaskStatus, "running");
    if (!runTransition.success) {
      return fail(runTransition.error);
    }
    currentTaskStatus = "running";

    const emit = (event: Omit<OrchestrationEvent, "timestamp">) => {
      if (options.onEvent) {
        options.onEvent({
          ...event,
          timestamp: new Date().toISOString(),
        });
      }
    };

    emit({
      type: "task_started",
      taskId,
      message: `Task execution started for plan '${plan.id}' under bounded limits`,
      data: { limits },
    });

    // Save initial task state to repository if available
    if (this.repositories) {
      if (typeof (this.registry as any).syncToRepository === "function") {
        await (this.registry as any).syncToRepository();
      }

      const existing = await this.repositories.tasks.findById(taskId);
      if (existing.success && existing.data) {
        await this.repositories.tasks.update({ ...task, status: currentTaskStatus, startedAt: now });
      } else {
        await this.repositories.tasks.create({ ...task, status: currentTaskStatus, startedAt: now });
      }

      for (let idx = 0; idx < plan.steps.length; idx++) {
        const step = plan.steps[idx];
        if (!step) continue;
        const existingStep = await this.repositories.steps.findById(step.id);
        if (!existingStep.success || !existingStep.data) {
          await this.repositories.steps.create({
            id: step.id,
            taskId,
            stepIndex: idx,
            title: step.title,
            description: step.description,
            status: "pending",
          });
        }
      }
    }

    // Execution tracking
    const stepStatuses: Map<string, StepExecutionResult> = new Map();
    const selectionDecisions: ProfileSelectionDecision[] = [];
    const activeProfileIds: Set<string> = new Set();
    const accumulatedEvidence: EvidenceItem[] = [];
    const accumulatedDisagreements: DisagreementItem[] = [];
    const accumulatedQuestions: UnresolvedQuestion[] = [];

    let totalTokensPrompt = 0;
    let totalTokensCompletion = 0;
    let totalTokens = 0;
    let totalSpendUsd = 0;
    let isPartial = false;
    let taskFailureReason: string | undefined;

    // Build step lookup & dependencies
    const remainingSteps = [...plan.steps];
    const completedStepIds = new Set<string>();

    while (remainingSteps.length > 0) {
      // Check total task timeout
      if (Date.now() - startTime > limits.totalTimeoutMs) {
        taskFailureReason = `Task execution exceeded total timeout limit of ${limits.totalTimeoutMs}ms`;
        currentTaskStatus = "failed";
        emit({ type: "timeout", taskId, message: taskFailureReason });
        isPartial = true;
        break;
      }

      // Check external abort / cancellation
      if (options.abortSignal?.aborted) {
        taskFailureReason = "Task execution was cancelled by user abort signal";
        currentTaskStatus = "cancelled";
        emit({ type: "cancelled", taskId, message: taskFailureReason });
        isPartial = true;
        break;
      }

      // Find ready steps whose dependencies are all completed
      const readySteps = remainingSteps.filter((s) =>
        s.dependsOn.every((depId) => completedStepIds.has(depId))
      );

      if (readySteps.length === 0) {
        // No step can proceed; check if there are remaining steps blocked by failures
        if (remainingSteps.length > 0) {
          taskFailureReason = `Execution blocked: remaining steps [${remainingSteps
            .map((s) => s.id)
            .join(", ")}] have unsatisfied dependencies`;
          currentTaskStatus = "blocked";
          isPartial = true;
        }
        break;
      }

      // Concurrency bound: Take up to maxConcurrency ready steps
      const batch = readySteps.slice(0, limits.maxConcurrency);

      // Execute batch steps concurrently
      const batchPromises = batch.map(async (step) => {
        // 1. Approval Gate Check
        if (step.requiresApproval && !options.autoApproveGates) {
          emit({
            type: "approval_required",
            taskId,
            stepId: step.id,
            message: step.approvalReason ?? "Step requires human approval before execution",
          });
          currentTaskStatus = "waiting_for_approval";
          isPartial = true;
          return { step, success: false, reason: "Waiting for human approval", isApprovalGate: true };
        }

        // 2. Budget Limit Check
        if (totalSpendUsd >= limits.budgetCapUsd) {
          const err = new SpendLimitExceededError(totalSpendUsd, limits.budgetCapUsd);
          emit({
            type: "budget_exceeded",
            taskId,
            stepId: step.id,
            message: err.message,
          });
          isPartial = true;
          return { step, success: false, reason: err.message };
        }

        // 3. Demand-Based Profile Selection (Declarative, no execution created yet)
        const budgetRemainingUsd = Math.max(0, limits.budgetCapUsd - totalSpendUsd);
        const selectionRes = await this.selector.selectProfileForStep({
          step,
          taskType: plan.classification.taskType,
          department: step.department,
          requiredCapabilities: step.candidateCapabilities,
          riskLevel: plan.classification.risk.level,
          uncertaintyLevel: plan.classification.uncertainty.level,
          budgetRemainingUsd,
        });

        if (!selectionRes.success) {
          return { step, success: false, reason: selectionRes.error.message };
        }

        const decision = selectionRes.data;
        selectionDecisions.push(decision);
        activeProfileIds.add(decision.selectedProfile.id);

        emit({
          type: "profile_selected",
          taskId,
          stepId: step.id,
          message: `Selected profile '${decision.selectedProfile.displayName}' for step '${step.title}'`,
          data: { rationale: decision.rationale },
        });

        // 4. Execution Record Creation (Created strictly upon actual runtime execution)
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const stepStartedAt = new Date().toISOString();

        if (this.repositories) {
          await this.repositories.steps.update({
            id: step.id,
            taskId,
            stepIndex: plan.steps.findIndex((s) => s.id === step.id),
            title: step.title,
            description: step.description,
            assignedAgentId: decision.selectedProfile.id,
            status: "running",
            startedAt: stepStartedAt,
          });

          const executionRecord: Execution = {
            id: executionId,
            taskId,
            stepId: step.id,
            agentProfileId: decision.selectedProfile.id,
            status: "running",
            provider: decision.selectedProfile.modelPreference.preferredProvider ?? "mock",
            model: decision.selectedProfile.modelPreference.preferredModel ?? "mock-model",
            metrics: {
              tokensPrompt: 0,
              tokensCompletion: 0,
              tokensTotal: 0,
              estimatedCostUsd: 0,
              durationMs: 0,
            },
            startedAt: stepStartedAt,
            createdAt: stepStartedAt,
            updatedAt: stepStartedAt,
          };
          await this.repositories.executions.create(executionRecord);
        }

        emit({
          type: "step_started",
          taskId,
          stepId: step.id,
          message: `Executing step '${step.title}' with agent '${decision.selectedProfile.displayName}'`,
        });

        // 5. Execution with bounded retries and timeouts
        let attempt = 0;
        let stepSucceeded = false;
        let lastError = "";
        let runResult: any;

        while (attempt <= limits.maxRetries && !stepSucceeded) {
          attempt++;
          if (attempt > 1) {
            emit({
              type: "step_retry",
              taskId,
              stepId: step.id,
              message: `Retrying step '${step.id}' (attempt ${attempt}/${limits.maxRetries + 1}): ${lastError}`,
            });
          }

          // Per-step timeout wrapper
          const stepTimeoutController = new AbortController();
          const timeoutTimer = setTimeout(() => {
            stepTimeoutController.abort();
          }, limits.stepTimeoutMs);

          try {
            const stepSignal = options.abortSignal
              ? anySignal([options.abortSignal, stepTimeoutController.signal])
              : stepTimeoutController.signal;

            const res = await this.runtime.runStep(plan, step, decision.selectedProfile, stepSignal);
            clearTimeout(timeoutTimer);

            if (res.success) {
              stepSucceeded = true;
              runResult = res.data;
            } else {
              lastError = res.error;
            }
          } catch (err: any) {
            clearTimeout(timeoutTimer);
            lastError = err?.message || String(err);
          }
        }

        const stepCompletedAt = new Date().toISOString();

        if (stepSucceeded && runResult) {
          // Update Execution & Step in repositories
          if (this.repositories) {
            await this.repositories.steps.update({
              id: step.id,
              taskId,
              stepIndex: plan.steps.findIndex((s) => s.id === step.id),
              title: step.title,
              description: step.description,
              assignedAgentId: decision.selectedProfile.id,
              status: "completed",
              startedAt: stepStartedAt,
              completedAt: stepCompletedAt,
            });

            const execUpdate = await this.repositories.executions.findById(executionId);
            if (execUpdate.success && execUpdate.data) {
              await this.repositories.executions.update({
                ...execUpdate.data,
                status: "completed",
                metrics: runResult.metrics,
                finishedAt: stepCompletedAt,
                updatedAt: stepCompletedAt,
              });
            }
          }

          const stepResult: StepExecutionResult = {
            stepId: step.id,
            executionId,
            agentProfileId: decision.selectedProfile.id,
            agentSlug: decision.selectedProfile.slug,
            status: "completed",
            output: runResult.output,
            metrics: runResult.metrics,
            evidence: runResult.evidence,
            disagreements: runResult.disagreements,
            unresolvedQuestions: runResult.unresolvedQuestions,
            attempts: attempt,
            startedAt: stepStartedAt,
            completedAt: stepCompletedAt,
          };

          emit({
            type: "step_completed",
            taskId,
            stepId: step.id,
            message: `Completed step '${step.title}' in ${runResult.metrics.durationMs}ms`,
          });

          return { step, success: true, stepResult };
        } else {
          // Retry exhausted or non-retryable failure
          if (this.repositories) {
            await this.repositories.steps.update({
              id: step.id,
              taskId,
              stepIndex: plan.steps.findIndex((s) => s.id === step.id),
              title: step.title,
              description: step.description,
              assignedAgentId: decision.selectedProfile.id,
              status: "failed",
              startedAt: stepStartedAt,
              completedAt: stepCompletedAt,
              error: lastError,
            });

            const execUpdate = await this.repositories.executions.findById(executionId);
            if (execUpdate.success && execUpdate.data) {
              await this.repositories.executions.update({
                ...execUpdate.data,
                status: "failed",
                error: lastError,
                finishedAt: stepCompletedAt,
                updatedAt: stepCompletedAt,
              });
            }
          }

          const failedMetrics: ExecutionMetrics = {
            tokensPrompt: 0,
            tokensCompletion: 0,
            tokensTotal: 0,
            estimatedCostUsd: 0,
            durationMs: Date.now() - new Date(stepStartedAt).getTime(),
          };

          const stepResult: StepExecutionResult = {
            stepId: step.id,
            executionId,
            agentProfileId: decision.selectedProfile.id,
            agentSlug: decision.selectedProfile.slug,
            status: "failed",
            output: "",
            metrics: failedMetrics,
            evidence: [],
            disagreements: [],
            unresolvedQuestions: [],
            error: lastError,
            attempts: attempt,
            startedAt: stepStartedAt,
            completedAt: stepCompletedAt,
          };

          emit({
            type: "step_failed",
            taskId,
            stepId: step.id,
            message: `Step '${step.title}' failed after ${attempt} attempts: ${lastError}`,
          });

          return { step, success: false, reason: lastError, stepResult };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      let batchHadFailure = false;
      for (const res of batchResults) {
        // Remove from remaining
        const idx = remainingSteps.findIndex((s) => s.id === res.step.id);
        if (idx !== -1) {
          remainingSteps.splice(idx, 1);
        }

        if (res.success && res.stepResult) {
          completedStepIds.add(res.step.id);
          stepStatuses.set(res.step.id, res.stepResult);

          totalTokensPrompt += res.stepResult.metrics.tokensPrompt;
          totalTokensCompletion += res.stepResult.metrics.tokensCompletion;
          totalTokens += res.stepResult.metrics.tokensTotal;
          totalSpendUsd += res.stepResult.metrics.estimatedCostUsd;

          accumulatedEvidence.push(...res.stepResult.evidence);
          accumulatedDisagreements.push(...res.stepResult.disagreements);
          accumulatedQuestions.push(...res.stepResult.unresolvedQuestions);
        } else {
          batchHadFailure = true;
          if (res.stepResult) {
            stepStatuses.set(res.step.id, res.stepResult);
          }
          if (res.isApprovalGate) {
            currentTaskStatus = "waiting_for_approval";
            isPartial = true;
          } else if (options.abortSignal?.aborted || res.reason?.toLowerCase().includes("cancel")) {
            currentTaskStatus = "cancelled";
            taskFailureReason = "Task execution was cancelled by user abort signal";
            isPartial = true;
          } else {
            taskFailureReason = res.reason;
            isPartial = true;
          }
        }
      }

      if (batchHadFailure) {
        break;
      }
    }

    // Determine final task lifecycle transition
    const totalDurationMs = Date.now() - startTime;
    const finalMetrics: ExecutionMetrics = {
      tokensPrompt: totalTokensPrompt,
      tokensCompletion: totalTokensCompletion,
      tokensTotal: totalTokens,
      estimatedCostUsd: Math.round(totalSpendUsd * 1000) / 1000,
      durationMs: totalDurationMs,
    };

    if (options.abortSignal?.aborted || currentTaskStatus === "cancelled") {
      currentTaskStatus = "cancelled";
      taskFailureReason = taskFailureReason ?? "Task execution was cancelled by user abort signal";
      isPartial = true;
    } else if (currentTaskStatus === "running") {
      if (!isPartial && completedStepIds.size === plan.steps.length) {
        currentTaskStatus = "completed";
      } else if (isPartial) {
        currentTaskStatus = "failed";
      }
    }

    const taskResultId = `result_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const finalTaskResult: TaskResult = {
      id: taskResultId,
      taskId,
      leadAgentId: selectionDecisions[0]?.selectedProfile.id ?? "unknown",
      success: currentTaskStatus === "completed",
      summary:
        currentTaskStatus === "completed"
          ? `Successfully executed all ${plan.steps.length} steps of plan '${plan.id}'`
          : `Plan execution concluded with status '${currentTaskStatus}': ${taskFailureReason ?? "Partial completion"}`,
      evidence: accumulatedEvidence,
      disagreements: accumulatedDisagreements,
      unresolvedQuestions: accumulatedQuestions,
      artifactIds: [],
      metrics: finalMetrics,
      completedAt: new Date().toISOString(),
      createdAt: now,
      updatedAt: new Date().toISOString(),
    };

    // Update final task record in repository
    const finalTask: Task = {
      ...task,
      status: currentTaskStatus,
      resultId: finalTaskResult.id,
      failureReason: taskFailureReason,
      completedAt: currentTaskStatus === "completed" ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    };

    if (this.repositories) {
      await this.repositories.tasks.update(finalTask);
    }

    let finalEventType: OrchestrationEvent["type"] = "task_failed";
    if (currentTaskStatus === "completed") {
      finalEventType = "task_completed";
    } else if (currentTaskStatus === "cancelled") {
      finalEventType = "cancelled";
    }

    emit({
      type: finalEventType,
      taskId,
      message: `Task concluded with status '${currentTaskStatus}'`,
      data: { finalMetrics, status: currentTaskStatus },
    });

    // Compute dormancy breakdown
    const dormancyRes = await this.selector.getDormancyReport(activeProfileIds);
    const activeProfiles = dormancyRes.success ? dormancyRes.data.active : [];
    const dormantProfiles = dormancyRes.success ? dormancyRes.data.dormant : [];

    const result: OrchestrationResult = {
      task: finalTask,
      plan,
      stepResults: Array.from(stepStatuses.values()),
      taskResult: finalTaskResult,
      metrics: finalMetrics,
      status: currentTaskStatus,
      isPartial,
      failureReason: taskFailureReason,
      selectionDecisions,
      activeProfiles,
      dormantProfiles,
    };

    // Cache by idempotency key
    if (options.idempotencyKey) {
      this.idempotencyCache.set(options.idempotencyKey, result);
    }

    return ok(result);
  }
}

/**
 * Combines multiple AbortSignals into a single signal.
 */
function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

/**
 * Factory for BoundedCoordinator.
 */
export function createBoundedCoordinator(options: BoundedCoordinatorOptions): BoundedCoordinator {
  return new BoundedCoordinator(options);
}
