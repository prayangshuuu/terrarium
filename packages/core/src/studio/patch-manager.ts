/**
 * @terrarium/core - studio/patch-manager.ts
 *
 * Creation, application, user change preservation, atomic multi-patch application,
 * and rollback management for inspectable code patches.
 * Contributed by A2 (Orchestration & AI Runtime) & A3 (Data, Security & Reliability).
 */

import path from "node:path";
import fs from "node:fs/promises";
import {
  type CodeFilePatch,
  type PatchApplicationResult,
  type PatchRollbackResult,
  type PatchChangeType,
  type Result,
  ok,
  fail,
  DomainValidationError,
} from "@terrarium/contracts";
import { CodeSecuritySandbox } from "./code-security-sandbox.ts";
import { computeSha256, createUnifiedDiff } from "./diff-engine.ts";

export interface CreatePatchInput {
  readonly filePath: string;
  readonly proposedContent: string;
  readonly rationale: string;
  readonly taskId?: string;
  readonly changeType?: PatchChangeType;
}

export class PatchManager {
  private readonly sandbox: CodeSecuritySandbox;
  private readonly rollbackStore = new Map<string, string | null>(); // patchId -> originalContent or null if created

  constructor(sandbox: CodeSecuritySandbox) {
    this.sandbox = sandbox;
  }

  public getSandbox(): CodeSecuritySandbox {
    return this.sandbox;
  }

  /**
   * Generates a new proposed CodeFilePatch with unified diff and hunks.
   */
  public async proposePatch(input: CreatePatchInput): Promise<Result<CodeFilePatch, DomainValidationError>> {
    const pathCheck = await this.sandbox.validatePathAccess(input.filePath, "read");
    if (!pathCheck.success) {
      return fail(new DomainValidationError(pathCheck.error.message, [{ path: "filePath", message: pathCheck.error.message }]));
    }

    const resolved = pathCheck.data;
    const exists = await fs.stat(resolved).then(() => true).catch(() => false);

    let originalContent = "";
    let originalHash: string | undefined;

    if (exists) {
      originalContent = await fs.readFile(resolved, "utf8");
      originalHash = computeSha256(originalContent);
    }

    const proposedHash = computeSha256(input.proposedContent);

    let changeType: PatchChangeType = input.changeType ?? (exists ? "modify" : "create");
    if (input.proposedContent.length === 0 && exists) {
      changeType = "delete";
    }

    const { diffUnified, hunks } = createUnifiedDiff(input.filePath, originalContent, input.proposedContent);
    const now = new Date().toISOString();
    const patchId = `patch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const patch: CodeFilePatch = {
      id: patchId,
      taskId: input.taskId,
      filePath: input.filePath,
      changeType,
      originalContent: exists ? originalContent : undefined,
      originalHash,
      proposedContent: input.proposedContent,
      proposedHash,
      diffUnified,
      hunks,
      rationale: input.rationale,
      status: "proposed",
      requiresApproval: true,
      createdAt: now,
      updatedAt: now,
      rollbackGuidance: `terrarium studio rollback ${patchId}`,
    };

    return ok(patch);
  }

  /**
   * Applies a single patch to the working tree.
   * Verifies user change preservation before touching the file.
   */
  public async applyPatch(patch: CodeFilePatch): Promise<PatchApplicationResult> {
    const guidance = patch.rollbackGuidance ?? `terrarium studio rollback ${patch.id}`;

    // 1. Validate security access for write
    const writeCheck = await this.sandbox.validatePathAccess(patch.filePath, patch.changeType === "delete" ? "delete" : "write");
    if (!writeCheck.success) {
      return {
        success: false,
        patchId: patch.id,
        filePath: patch.filePath,
        rollbackGuidance: guidance,
        error: writeCheck.error.message,
      };
    }

    const resolved = writeCheck.data;

    // 2. Preserve user changes: check original hash against current disk content
    const verifyCheck = await this.sandbox.verifyWorkingTreeContent(patch.filePath, patch.originalHash);
    if (!verifyCheck.success) {
      return {
        success: false,
        patchId: patch.id,
        filePath: patch.filePath,
        rollbackGuidance: guidance,
        error: verifyCheck.error.message,
      };
    }

    // 3. Store rollback backup
    try {
      const exists = await fs.stat(resolved).then(() => true).catch(() => false);
      if (exists) {
        const currentContent = await fs.readFile(resolved, "utf8");
        this.rollbackStore.set(patch.id, currentContent);
      } else {
        this.rollbackStore.set(patch.id, null); // file was created
      }

      // 4. Perform write/delete
      if (patch.changeType === "delete") {
        if (exists) {
          await fs.unlink(resolved);
        }
      } else {
        const parentDir = path.dirname(resolved);
        await fs.mkdir(parentDir, { recursive: true });
        await fs.writeFile(resolved, patch.proposedContent, "utf8");
      }

      return {
        success: true,
        patchId: patch.id,
        filePath: patch.filePath,
        appliedHash: patch.proposedHash,
        rollbackGuidance: guidance,
      };
    } catch (err: unknown) {
      return {
        success: false,
        patchId: patch.id,
        filePath: patch.filePath,
        rollbackGuidance: guidance,
        error: String(err),
      };
    }
  }

  /**
   * Applies multiple patches atomically. If any patch fails,
   * all previously applied patches in this transaction are rolled back cleanly.
   */
  public async applyMultiFilePatch(patches: readonly CodeFilePatch[]): Promise<{
    success: boolean;
    appliedCount: number;
    results: readonly PatchApplicationResult[];
    partialFailure?: boolean;
    error?: string;
  }> {
    const applied: CodeFilePatch[] = [];
    const results: PatchApplicationResult[] = [];

    for (const patch of patches) {
      const res = await this.applyPatch(patch);
      results.push(res);

      if (!res.success) {
        // Atomic transaction failure: Rollback all previously applied patches!
        for (const prevPatch of applied.reverse()) {
          await this.rollbackPatch(prevPatch);
        }

        return {
          success: false,
          appliedCount: 0,
          results,
          partialFailure: true,
          error: `Multi-file patch aborted and rolled back due to failure on '${patch.filePath}': ${res.error}`,
        };
      }

      applied.push(patch);
    }

    return {
      success: true,
      appliedCount: applied.length,
      results,
    };
  }

  /**
   * Rolls back an applied patch.
   */
  public async rollbackPatch(patch: CodeFilePatch): Promise<PatchRollbackResult> {
    const writeCheck = await this.sandbox.validatePathAccess(patch.filePath, "write");
    if (!writeCheck.success) {
      return {
        success: false,
        patchId: patch.id,
        filePath: patch.filePath,
        error: writeCheck.error.message,
      };
    }

    const resolved = writeCheck.data;
    const backup = this.rollbackStore.get(patch.id);

    try {
      if (backup === null || (!backup && patch.changeType === "create")) {
        // File was originally created by patch; revert by unlinking
        const exists = await fs.stat(resolved).then(() => true).catch(() => false);
        if (exists) {
          await fs.unlink(resolved);
        }
        return {
          success: true,
          patchId: patch.id,
          filePath: patch.filePath,
        };
      }

      const contentToRestore = backup ?? patch.originalContent ?? "";
      const parentDir = path.dirname(resolved);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.writeFile(resolved, contentToRestore, "utf8");

      return {
        success: true,
        patchId: patch.id,
        filePath: patch.filePath,
        restoredHash: computeSha256(contentToRestore),
      };
    } catch (err: unknown) {
      return {
        success: false,
        patchId: patch.id,
        filePath: patch.filePath,
        error: String(err),
      };
    }
  }
}
