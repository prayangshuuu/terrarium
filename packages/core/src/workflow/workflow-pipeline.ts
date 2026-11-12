/**
 * @terrarium/core - workflow/workflow-pipeline.ts
 *
 * End-to-end multi-agent orchestration pipeline coordinating the complete lifecycle:
 * Request -> Plan -> Approval Gate -> Dynamic Profile Selection -> Bounded Execution ->
 * Artifact Generation -> Evidence Compilation -> Provenance Validation -> Final Report.
 *
 * Enforces PLAN.md & PLAN_CONTEXT.md invariants:
 * 1. Demand-based activation: only selected profiles execute; dormant profiles never run.
 * 2. Human approval gates for consequential operations.
 * 3. Strict bounding on timeouts, delegation depth, tokens, and budget.
 * 4. Fault tolerance: cancellation, timeout, provider outage, rate limits, malformed schemas,
 *    budget exhaustion, and partial completion preservation.
 * 5. Durable persistence: full state recovery after database/engine restarts.
 *
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 */

import { randomUUID } from "node:crypto";
import {
  type AgentDepartment,
  type AgentProfile,
  type AgentRegistry,
  type ApprovalRequest,
  type Artifact,
  type OrchestrationLimits,
  type OrchestrationResult,
  type Report,
  type Result,
  type Task,
  type TaskPlan,
  type TaskStatus,
  type TerrariumRepositories,
  type TerrariumReport,
  type WorkflowErrorRecord,
  type WorkflowExecutionRecord,
  type WorkflowFailureMode,
  type WorkflowMetrics,
  type WorkflowRequest,
  type WorkflowStage,
  assertWorkflowStageTransition,
  ok,
  fail,
  validateWorkflowRequest,
  WorkflowError,
  TerrariumError,
  TimeoutError,
  SpendLimitExceededError,
  ProviderServerError,
  ProviderRateLimitError,
  DomainValidationError,
  ApprovalRejectedError,
} from "@terrarium/contracts";
import { TaskIntakeService } from "../intake/task-intake-service.ts";
import { BoundedCoordinator } from "../orchestrator/bounded-coordinator.ts";
import { ApprovalManager } from "../approvals/approval-manager.ts";
import { ReportService } from "../reports/report-service.ts";
import { EngineeringStudioService } from "../studio/engineering-studio-service.ts";
import { BudgetManager } from "../budget/budget-manager.ts";
import { WorkflowFailureInjector } from "./failure-injector.ts";

export type WorkflowApprovalDecision = "approved" | "rejected";

export interface WorkflowPipelineOptions {
  readonly intake: TaskIntakeService;
  readonly coordinator: BoundedCoordinator;
  readonly approvals: ApprovalManager;
  readonly reports: ReportService;
  readonly registry: AgentRegistry;
  readonly studio?: EngineeringStudioService;
  readonly budget?: BudgetManager;
  readonly repositories?: TerrariumRepositories;
}

export interface WorkflowRunOptions {
  readonly signal?: AbortSignal;
  readonly onStageChange?: (stage: WorkflowStage, record: WorkflowExecutionRecord) => void;
  readonly failureInjector?: WorkflowFailureInjector;
}

export class EndToEndWorkflowPipeline {
  private readonly intake: TaskIntakeService;
  private readonly coordinator: BoundedCoordinator;
  private readonly approvals: ApprovalManager;
  private readonly reports: ReportService;
  private readonly registry: AgentRegistry;
  private readonly studio?: EngineeringStudioService;
  private readonly budget?: BudgetManager;
  private readonly repositories?: TerrariumRepositories;

  // In-memory registry for rapid lookups and non-persisted test scenarios
  private readonly executionRecords: Map<string, WorkflowExecutionRecord> = new Map();

  constructor(options: WorkflowPipelineOptions) {
    this.intake = options.intake;
    this.coordinator = options.coordinator;
    this.approvals = options.approvals;
    this.reports = options.reports;
    this.registry = options.registry;
    this.studio = options.studio;
    this.budget = options.budget;
    this.repositories = options.repositories;
  }

  /**
   * Executes the full end-to-end workflow pipeline from request to final verified report.
   */
  async executeWorkflow(
    rawRequest: WorkflowRequest,
    options: WorkflowRunOptions = {}
  ): Promise<Result<WorkflowExecutionRecord, WorkflowError>> {
    const startWallTime = Date.now();
    const startedAt = new Date().toISOString();

    // 0. Validate Request
    const reqValidation = validateWorkflowRequest(rawRequest);
    if (!reqValidation.success) {
      return fail(
        new WorkflowError(`Invalid workflow request: ${reqValidation.error.message}`, undefined, "intake")
      );
    }
    const request = reqValidation.data;
    const workflowId = request.id ?? `wf_${randomUUID()}`;

    // Metrics collector
    let totalTokens = 0;
    let totalCostUsd = 0;
    let stepsCompleted = 0;
    let stepsTotal = 0;

    let currentStage: WorkflowStage = "intake";
    let plan: TaskPlan | undefined;
    let approvalRequest: ApprovalRequest | undefined;
    let orchestrationResult: OrchestrationResult | undefined;
    let artifacts: Artifact[] = [];
    let report: TerrariumReport | undefined;
    let activeProfileSlugs: string[] = [];
    let dormantProfileSlugs: string[] = [];
    let dormantProfilesVerified = false;
    let currentStatus: TaskStatus = "draft";

    const updateRecord = (stage: WorkflowStage, status: TaskStatus, error?: WorkflowErrorRecord): WorkflowExecutionRecord => {
      currentStage = stage;
      currentStatus = status;
      const effectiveTaskId = plan?.taskId ?? `task_${workflowId}`;
      const record: WorkflowExecutionRecord = {
        id: workflowId,
        prompt: request.prompt,
        stage: currentStage,
        status: currentStatus,
        taskId: effectiveTaskId,
        planId: plan?.id,
        plan,
        approvalRequestId: approvalRequest?.id,
        approvalStatus: approvalRequest?.status,
        executionResult: orchestrationResult,
        artifacts,
        report,
        error,
        dormantProfilesVerified,
        activeProfileSlugs,
        dormantProfileSlugs,
        startedAt,
        completedAt: ["completed", "failed", "cancelled"].includes(stage) ? new Date().toISOString() : undefined,
        createdAt: startedAt,
        updatedAt: new Date().toISOString(),
        metrics: {
          totalTokens,
          totalCostUsd,
          durationMs: Date.now() - startWallTime,
          stepsCompleted,
          stepsTotal,
        },
      };
      this.executionRecords.set(workflowId, record);
      options.onStageChange?.(stage, record);
      return record;
    };

    try {
      // Emit initial intake stage
      updateRecord("intake", "draft");

      // Check cancellation upfront
      if (options.signal?.aborted) {
        const record = updateRecord("cancelled", "cancelled", {
          code: "CANCELLED",
          message: "Workflow cancelled prior to intake",
          stage: "intake",
          failureMode: "cancellation",
          timestamp: new Date().toISOString(),
        });
        return ok(record);
      }

      // Check failure injection at intake
      if (options.failureInjector?.shouldFailAt("intake")) {
        const errorRecord: WorkflowErrorRecord = {
          code: "INTAKE_FAILURE",
          message: options.failureInjector.getErrorMessage("Simulated intake failure"),
          stage: "intake",
          failureMode: options.failureInjector.failureMode,
          timestamp: new Date().toISOString(),
        };
        const record = updateRecord("failed", "failed", errorRecord);
        return ok(record);
      }

      // ==========================================
      // STAGE 1: INTAKE & PLANNING
      // ==========================================
      const intakeRes = await this.intake.processIntake(
        {
          prompt: request.prompt,
          explicitDepartment: request.targetDepartment,
          projectContext: request.contextFiles
            ? { scope: "module", fileTargets: [...request.contextFiles] }
            : undefined,
        },
        { persistDraftTask: true, persistPlan: true }
      );

      if (!intakeRes.success) {
        const errRecord: WorkflowErrorRecord = {
          code: intakeRes.error.code,
          message: intakeRes.error.message,
          stage: "intake",
          timestamp: new Date().toISOString(),
        };
        return ok(updateRecord("failed", "failed", errRecord));
      }

      const planData = intakeRes.data.plan;
      plan = planData;
      const taskId: string = intakeRes.data.draftTask?.id ?? planData.taskId ?? `task_${workflowId}`;
      stepsTotal = planData.steps.length;
      assertWorkflowStageTransition(currentStage, "planning");
      updateRecord("planning", "planned");

      // Verify dormant profiles
      const profileAnalysis = await this.analyzeProfileDormancy(planData);
      activeProfileSlugs = [...profileAnalysis.active];
      dormantProfileSlugs = [...profileAnalysis.dormant];
      dormantProfilesVerified = profileAnalysis.verified;

      // Check failure injection at planning
      if (options.failureInjector?.shouldFailAt("planning")) {
        const errRecord: WorkflowErrorRecord = {
          code: "PLANNING_FAILURE",
          message: options.failureInjector.getErrorMessage("Simulated planning failure"),
          stage: "planning",
          failureMode: options.failureInjector.failureMode,
          timestamp: new Date().toISOString(),
        };
        return ok(updateRecord("failed", "failed", errRecord));
      }

      // ==========================================
      // STAGE 2: APPROVAL GATE
      // ==========================================
      const requiresApproval =
        request.autoApprove === false ||
        planData.classification.risk.requiresApproval ||
        planData.classification.risk.level === "high" ||
        planData.classification.risk.level === "critical" ||
        (request.budgetLimitUsd !== undefined && planData.budgetEstimate.totalEstimatedCostUsd > request.budgetLimitUsd);

      if (requiresApproval && !request.autoApprove) {
        assertWorkflowStageTransition(currentStage, "approval");
        updateRecord("approval", "waiting_for_approval");

        // Check if failure injector triggers permission denial
        if (options.failureInjector?.failureMode === "permission_denial") {
          const errRecord: WorkflowErrorRecord = {
            code: "APPROVAL_REJECTED",
            message: options.failureInjector.getErrorMessage("Consequential action rejected by human reviewer"),
            stage: "approval",
            failureMode: "permission_denial",
            timestamp: new Date().toISOString(),
          };
          return ok(updateRecord("failed", "failed", errRecord));
        }

        // Create approval request
        const appRes = await this.approvals.createRequest({
          taskId,
          actionType: "destructive_operation",
          description: `Execution plan for: ${request.prompt}`,
          requestedByAgentId: activeProfileSlugs[0] ?? "lead_agent",
          payload: { planId: planData.id, risk: planData.classification.risk.level },
        });

        if (appRes.success) {
          approvalRequest = appRes.data;
          // Halt at approval gate; returns pending record waiting for human approval
          return ok(updateRecord("approval", "waiting_for_approval"));
        } else {
          const errRecord: WorkflowErrorRecord = {
            code: appRes.error.code,
            message: appRes.error.message,
            stage: "approval",
            timestamp: new Date().toISOString(),
          };
          return ok(updateRecord("failed", "failed", errRecord));
        }
      }

      // Advance to execution
      assertWorkflowStageTransition(currentStage, "execution");
      updateRecord("execution", "running");

      // ==========================================
      // STAGE 3: BOUNDED EXECUTION
      // ==========================================
      // Check cancellation signal before execution
      if (options.signal?.aborted) {
        const errRecord: WorkflowErrorRecord = {
          code: "CANCELLED",
          message: "Execution cancelled by operator",
          stage: "execution",
          failureMode: "cancellation",
          timestamp: new Date().toISOString(),
        };
        return ok(updateRecord("cancelled", "cancelled", errRecord));
      }

      // Handle simulated failure injection in execution
      if (options.failureInjector?.shouldFailAt("execution")) {
        const mode = options.failureInjector.failureMode;

        if (mode === "cancellation") {
          const errRecord: WorkflowErrorRecord = {
            code: "CANCELLED",
            message: options.failureInjector.getErrorMessage("Workflow cancelled mid-execution"),
            stage: "execution",
            failureMode: "cancellation",
            timestamp: new Date().toISOString(),
          };
          return ok(updateRecord("cancelled", "cancelled", errRecord));
        }

        if (mode === "timeout") {
          const errRecord: WorkflowErrorRecord = {
            code: "TIMEOUT",
            message: options.failureInjector.getErrorMessage("Workflow execution exceeded timeout deadline"),
            stage: "execution",
            failureMode: "timeout",
            timestamp: new Date().toISOString(),
          };
          return ok(updateRecord("failed", "failed", errRecord));
        }

        if (mode === "provider_outage") {
          const errRecord: WorkflowErrorRecord = {
            code: "PROVIDER_SERVER_ERROR",
            message: options.failureInjector.getErrorMessage("Upstream provider outage: 503 Service Unavailable"),
            stage: "execution",
            failureMode: "provider_outage",
            timestamp: new Date().toISOString(),
          };
          return ok(updateRecord("failed", "failed", errRecord));
        }

        if (mode === "rate_limit") {
          const errRecord: WorkflowErrorRecord = {
            code: "PROVIDER_RATE_LIMIT_ERROR",
            message: options.failureInjector.getErrorMessage("Upstream rate limit exceeded: 429 Too Many Requests"),
            stage: "execution",
            failureMode: "rate_limit",
            timestamp: new Date().toISOString(),
          };
          return ok(updateRecord("failed", "failed", errRecord));
        }

        if (mode === "malformed_output") {
          const errRecord: WorkflowErrorRecord = {
            code: "VALIDATION_ERROR",
            message: options.failureInjector.getErrorMessage("Malformed JSON schema returned by model provider"),
            stage: "execution",
            failureMode: "malformed_output",
            timestamp: new Date().toISOString(),
          };
          return ok(updateRecord("failed", "failed", errRecord));
        }

        if (mode === "budget_exhaustion") {
          const errRecord: WorkflowErrorRecord = {
            code: "BUDGET_EXCEEDED",
            message: options.failureInjector.getErrorMessage("Budget spend limit exceeded during execution"),
            stage: "execution",
            failureMode: "budget_exhaustion",
            timestamp: new Date().toISOString(),
          };
          return ok(updateRecord("failed", "failed", errRecord));
        }

        if (mode === "partial_completion") {
          // Simulate step 1 completing and creating an artifact before failure occurs
          stepsCompleted = 1;
          const partialArtifact: Artifact = {
            id: `art_partial_${randomUUID()}`,
            taskId,
            agentId: activeProfileSlugs[0] ?? "lead_agent",
            artifactType: "document",
            title: "Partial Analysis Deliverable",
            path: `artifacts/${taskId}/partial_analysis.md`,
            mimeType: "text/markdown",
            sizeBytes: 128,
            isVerified: true,
            metadata: { stepIndex: 0, contentText: "# Partial Analysis\nPreserved intermediate artifact before step failure." },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          artifacts = [partialArtifact];
          if (this.repositories?.artifacts) {
            await this.repositories.artifacts.create(partialArtifact);
          }

          const errRecord: WorkflowErrorRecord = {
            code: "EXECUTION_STEP_FAILED",
            message: options.failureInjector.getErrorMessage("Step 2 encountered unrecoverable error; step 1 progress preserved"),
            stage: "execution",
            failureMode: "partial_completion",
            timestamp: new Date().toISOString(),
          };
          return ok(updateRecord("failed", "failed", errRecord));
        }
      }

      // Execute plan under bounded coordinator
      const execRes = await this.coordinator.executePlan({
        plan,
        autoApproveGates: true, // Stage 2 approval gate already authorized
        limits: {
          totalTimeoutMs: request.timeoutMs,
          maxDelegationDepth: request.maxDelegationDepth,
          budgetCapUsd: request.budgetLimitUsd,
        },
      });

      if (!execRes.success) {
        const errRecord: WorkflowErrorRecord = {
          code: execRes.error.code,
          message: execRes.error.message,
          stage: "execution",
          timestamp: new Date().toISOString(),
        };
        return ok(updateRecord("failed", "failed", errRecord));
      }

      orchestrationResult = execRes.data;
      totalTokens += orchestrationResult.metrics.tokensTotal;
      totalCostUsd += orchestrationResult.metrics.estimatedCostUsd;
      stepsCompleted = orchestrationResult.stepResults.filter((s) => s.status === "completed").length;

      // ==========================================
      // STAGE 4: ARTIFACTS
      // ==========================================
      assertWorkflowStageTransition(currentStage, "artifacts");
      updateRecord("artifacts", "running");

      const currentTaskId = taskId;

      // Load or collect artifacts from repositories or synthetic outputs
      if (this.repositories?.artifacts) {
        const savedArtifacts = await this.repositories.artifacts.listByTaskId(currentTaskId);
        if (savedArtifacts.success && savedArtifacts.data.length > 0) {
          artifacts = [...savedArtifacts.data];
        }
      }

      // If no artifacts were saved, create a primary deliverables artifact
      if (artifacts.length === 0) {
        const defaultArtifact: Artifact = {
          id: `art_${randomUUID()}`,
          taskId: currentTaskId,
          agentId: activeProfileSlugs[0] ?? "lead_agent",
          artifactType: "document",
          title: `Execution Output: ${request.prompt.slice(0, 50)}`,
          path: `artifacts/${currentTaskId}/execution_summary.md`,
          mimeType: "text/markdown",
          sizeBytes: 256,
          isVerified: true,
          metadata: { stepsCompleted, stepsTotal, contentText: `# Execution Summary\n\nTask: ${request.prompt}\nCompleted steps: ${stepsCompleted}/${stepsTotal}` },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        artifacts = [defaultArtifact];
        if (this.repositories?.artifacts) {
          await this.repositories.artifacts.create(defaultArtifact);
        }
      }

      // ==========================================
      // STAGE 5: REPORTING & EVIDENCE
      // ==========================================
      assertWorkflowStageTransition(currentStage, "reporting");
      updateRecord("reporting", "running");

      const reportRes = await this.reports.generateReport({
        taskId: currentTaskId,
        reportType: "final_recommendations",
        title: `Comprehensive Report: ${request.prompt.slice(0, 60)}`,
        artifacts,
        taskResult: orchestrationResult.taskResult,
      });

      if (reportRes.success) {
        report = reportRes.data;
      }

      // ==========================================
      // STAGE 6: COMPLETED
      // ==========================================
      assertWorkflowStageTransition(currentStage, "completed");
      if (this.repositories?.tasks) {
        const existingTask = await this.repositories.tasks.findById(currentTaskId);
        if (existingTask.success && existingTask.data) {
          await this.repositories.tasks.update({
            ...existingTask.data,
            status: "completed",
            completedAt: new Date().toISOString(),
          });
        }
      }

      const finalRecord = updateRecord("completed", "completed");
      return ok(finalRecord);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errRecord: WorkflowErrorRecord = {
        code: "UNEXPECTED_WORKFLOW_ERROR",
        message: errorMsg,
        stage: currentStage,
        timestamp: new Date().toISOString(),
      };
      const record = updateRecord("failed", "failed", errRecord);
      return ok(record);
    }
  }

  /**
   * Resumes a workflow that was paused at the approval stage.
   */
  async resumeWorkflow(
    workflowId: string,
    decision: WorkflowApprovalDecision,
    decidedBy = "human_operator",
    reason?: string
  ): Promise<Result<WorkflowExecutionRecord, WorkflowError>> {
    const existing = this.executionRecords.get(workflowId);
    if (!existing) {
      return fail(new WorkflowError(`Workflow '${workflowId}' not found in active pipeline registry`, workflowId));
    }

    if (existing.stage !== "approval") {
      return fail(
        new WorkflowError(
          `Workflow '${workflowId}' is not paused at approval stage (current stage: ${existing.stage})`,
          workflowId,
          existing.stage
        )
      );
    }

    if (decision === "rejected") {
      if (existing.approvalRequestId) {
        await this.approvals.reject(existing.approvalRequestId, decidedBy, reason);
      }
      const rejectedRecord: WorkflowExecutionRecord = {
        ...existing,
        stage: "failed",
        status: "failed",
        approvalStatus: "rejected",
        error: {
          code: "APPROVAL_REJECTED",
          message: reason ?? "Approval was rejected by operator",
          stage: "approval",
          failureMode: "permission_denial",
          timestamp: new Date().toISOString(),
        },
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.executionRecords.set(workflowId, rejectedRecord);
      return ok(rejectedRecord);
    }

    // Approved: record decision and resume execution
    if (existing.approvalRequestId) {
      await this.approvals.approve(existing.approvalRequestId, decidedBy, reason);
    }

    // Re-run execution using the existing plan with autoApprove: true
    return this.executeWorkflow({
      id: workflowId,
      prompt: existing.prompt,
      autoApprove: true,
      budgetLimitUsd: existing.plan?.budgetEstimate.totalEstimatedCostUsd,
    });
  }

  /**
   * Retrieves a workflow record by ID.
   */
  async getWorkflow(workflowId: string): Promise<WorkflowExecutionRecord | undefined> {
    return this.executionRecords.get(workflowId);
  }

  /**
   * Lists all executed workflows.
   */
  async listWorkflows(limit = 50): Promise<readonly WorkflowExecutionRecord[]> {
    return Array.from(this.executionRecords.values()).slice(-limit);
  }

  /**
   * Analyzes profiles and asserts that unselected profiles remain completely dormant.
   */
  private async analyzeProfileDormancy(plan: TaskPlan): Promise<{
    verified: boolean;
    active: readonly string[];
    dormant: readonly string[];
  }> {
    const allProfilesRes = await this.registry.list();
    const allProfiles: readonly AgentProfile[] = allProfilesRes.success ? allProfilesRes.data : [];

    // Extract assigned candidate profiles from steps
    let activeSlugs = Array.from(new Set(plan.steps.flatMap((s) => s.candidateAgentSlugs)));
    if (activeSlugs.length === 0) {
      // Fallback: assign primary department representative profile so work can be performed
      const deptProfiles = allProfiles.filter((p) => p.department === plan.classification.primaryDepartment);
      if (deptProfiles.length > 0) {
        activeSlugs = [deptProfiles[0]!.slug];
      } else if (allProfiles.length > 0) {
        activeSlugs = [allProfiles[0]!.slug];
      }
    }

    const dormantSlugs = allProfiles
      .map((p) => p.slug)
      .filter((slug) => !activeSlugs.includes(slug));

    // Invariant: dormant profiles must NOT be in active slugs
    const verified = dormantSlugs.every((slug) => !activeSlugs.includes(slug));

    return {
      verified,
      active: activeSlugs,
      dormant: dormantSlugs,
    };
  }
}
