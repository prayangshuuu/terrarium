/**
 * @terrarium/core - studio/engineering-studio-service.ts
 *
 * Central coordinator for Engineering Studio: repository analysis, patch proposals,
 * consequential action approval gating, atomic patch application, rollback, and bounded tests.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 */

import {
  type CodeAnalysisSummary,
  type CodeFilePatch,
  type BoundedTestRunResult,
  type PatchApplicationResult,
  type PatchRollbackResult,
  type Result,
  type TerrariumRepositories,
  ok,
  fail,
  NotFoundError,
  PermissionDeniedError,
  DomainValidationError,
} from "@terrarium/contracts";
import type { ApprovalManager } from "../approvals/approval-manager.ts";
import { CodeSecuritySandbox } from "./code-security-sandbox.ts";
import { RepositoryAnalyzer } from "./repository-analyzer.ts";
import { PatchManager, type CreatePatchInput } from "./patch-manager.ts";
import { BoundedTestRunner } from "./test-runner.ts";

export interface EngineeringStudioServiceOptions {
  readonly workspaceRoot: string;
  readonly approvalManager?: ApprovalManager;
  readonly repositories?: TerrariumRepositories;
  readonly defaultMode?: "read_only" | "read_write";
  readonly allowDependencyInstall?: boolean;
}

export class EngineeringStudioService {
  private readonly workspaceRoot: string;
  private readonly sandbox: CodeSecuritySandbox;
  private readonly analyzer: RepositoryAnalyzer;
  private readonly patchManager: PatchManager;
  private readonly testRunner: BoundedTestRunner;
  private readonly approvalManager?: ApprovalManager;
  private readonly patches = new Map<string, CodeFilePatch>();
  private latestAnalysis: CodeAnalysisSummary | null = null;
  private latestTestRun: BoundedTestRunResult | null = null;

  constructor(options: EngineeringStudioServiceOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.approvalManager = options.approvalManager;

    this.sandbox = new CodeSecuritySandbox({
      workspaceRoot: options.workspaceRoot,
      defaultMode: options.defaultMode ?? "read_only",
      allowDependencyInstall: options.allowDependencyInstall ?? false,
    });

    this.analyzer = new RepositoryAnalyzer({
      workspaceRoot: options.workspaceRoot,
    });

    this.patchManager = new PatchManager(this.sandbox);
    this.testRunner = new BoundedTestRunner({
      workspaceRoot: options.workspaceRoot,
      sandbox: this.sandbox,
    });
  }

  public getSandbox(): CodeSecuritySandbox {
    return this.sandbox;
  }

  public getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * Performs static analysis of the repository.
   */
  public async analyzeRepository(): Promise<CodeAnalysisSummary> {
    const summary = await this.analyzer.analyze();
    this.latestAnalysis = summary;
    return summary;
  }

  public getLatestAnalysis(): CodeAnalysisSummary | null {
    return this.latestAnalysis;
  }

  /**
   * Proposes a new code patch with unified diff and creates an approval request.
   */
  public async proposePatch(input: CreatePatchInput): Promise<Result<CodeFilePatch, DomainValidationError | PermissionDeniedError>> {
    const patchRes = await this.patchManager.proposePatch(input);
    if (!patchRes.success) {
      return patchRes;
    }

    let patch = patchRes.data;

    // Register human approval gate for consequential working-tree modification
    if (patch.requiresApproval && this.approvalManager) {
      const appRes = await this.approvalManager.createRequest({
        taskId: patch.taskId ?? `task_studio_${Date.now()}`,
        actionType: "file_write",
        description: `Apply code patch to '${patch.filePath}': ${patch.rationale}`,
        requestedByAgentId: "coding_specialist",
        toolId: "studio.apply_patch",
        riskLevel: "high",
      });

      if (appRes.success) {
        patch = {
          ...patch,
          approvalRequestId: appRes.data.id,
        };
      }
    }

    this.patches.set(patch.id, patch);
    return ok(patch);
  }

  public getPatch(patchId: string): CodeFilePatch | undefined {
    return this.patches.get(patchId);
  }

  public listPatches(): readonly CodeFilePatch[] {
    return Array.from(this.patches.values());
  }

  /**
   * Applies a proposed code patch to the working tree.
   * Enforces human approval gate and preserves user edits.
   */
  public async applyPatch(patchId: string): Promise<PatchApplicationResult> {
    const patch = this.patches.get(patchId);
    if (!patch) {
      return {
        success: false,
        patchId,
        filePath: "",
        rollbackGuidance: `terrarium studio rollback ${patchId}`,
        error: `Patch '${patchId}' not found`,
      };
    }

    if (patch.status === "applied") {
      return {
        success: true,
        patchId,
        filePath: patch.filePath,
        rollbackGuidance: patch.rollbackGuidance ?? `terrarium studio rollback ${patchId}`,
      };
    }

    // Verify approval gate if approval manager is present
    if (patch.requiresApproval && patch.approvalRequestId && this.approvalManager) {
      const appRes = await this.approvalManager.get(patch.approvalRequestId);
      if (appRes.success && appRes.data) {
        const approval = appRes.data;
        if (approval.status === "rejected") {
          return {
            success: false,
            patchId,
            filePath: patch.filePath,
            rollbackGuidance: patch.rollbackGuidance ?? `terrarium studio rollback ${patchId}`,
            error: `Cannot apply patch '${patchId}': Consequential action approval was rejected by user.`,
          };
        }
        if (approval.status === "pending") {
          return {
            success: false,
            patchId,
            filePath: patch.filePath,
            rollbackGuidance: patch.rollbackGuidance ?? `terrarium studio rollback ${patchId}`,
            error: `Cannot apply patch '${patchId}': Consequential working-tree modification requires human approval.`,
          };
        }
      }
    }

    // Apply via patch manager
    const result = await this.patchManager.applyPatch(patch);

    if (result.success) {
      const updated: CodeFilePatch = {
        ...patch,
        status: "applied",
        appliedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.patches.set(patchId, updated);
    } else {
      const updated: CodeFilePatch = {
        ...patch,
        status: "failed",
        updatedAt: new Date().toISOString(),
      };
      this.patches.set(patchId, updated);
    }

    return result;
  }

  /**
   * Approves a patch and resolves its approval request.
   */
  public async approvePatch(patchId: string, reason = "Approved by user"): Promise<Result<CodeFilePatch, NotFoundError>> {
    const patch = this.patches.get(patchId);
    if (!patch) {
      return fail(new NotFoundError("CodeFilePatch", patchId));
    }

    if (patch.approvalRequestId && this.approvalManager) {
      await this.approvalManager.approve(patch.approvalRequestId, "user", reason);
    }

    const updated: CodeFilePatch = {
      ...patch,
      status: "approved",
      updatedAt: new Date().toISOString(),
    };
    this.patches.set(patchId, updated);

    return ok(updated);
  }

  /**
   * Rejects a patch and closes its approval request.
   */
  public async rejectPatch(patchId: string, reason = "Rejected by user"): Promise<Result<CodeFilePatch, NotFoundError>> {
    const patch = this.patches.get(patchId);
    if (!patch) {
      return fail(new NotFoundError("CodeFilePatch", patchId));
    }

    if (patch.approvalRequestId && this.approvalManager) {
      await this.approvalManager.reject(patch.approvalRequestId, "user", reason);
    }

    const updated: CodeFilePatch = {
      ...patch,
      status: "rejected",
      updatedAt: new Date().toISOString(),
    };
    this.patches.set(patchId, updated);

    return ok(updated);
  }

  /**
   * Rolls back an applied patch.
   */
  public async rollbackPatch(patchId: string): Promise<PatchRollbackResult> {
    const patch = this.patches.get(patchId);
    if (!patch) {
      return {
        success: false,
        patchId,
        filePath: "",
        error: `Patch '${patchId}' not found`,
      };
    }

    const result = await this.patchManager.rollbackPatch(patch);

    if (result.success) {
      const updated: CodeFilePatch = {
        ...patch,
        status: "rolled_back",
        rolledBackAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.patches.set(patchId, updated);
    }

    return result;
  }

  /**
   * Runs bounded tests with strict timeout control.
   */
  public async runBoundedTests(command?: string, timeoutMs?: number): Promise<BoundedTestRunResult> {
    const result = await this.testRunner.runTests(command, timeoutMs);
    this.latestTestRun = result;
    return result;
  }

  public getLatestTestRun(): BoundedTestRunResult | null {
    return this.latestTestRun;
  }
}

export function createEngineeringStudioService(
  options: EngineeringStudioServiceOptions
): EngineeringStudioService {
  return new EngineeringStudioService(options);
}
