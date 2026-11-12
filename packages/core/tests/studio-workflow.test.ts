/**
 * @terrarium/core - tests/studio-workflow.test.ts
 *
 * Comprehensive end-to-end workflow test suite for Engineering Studio.
 * Verifies repository static analysis, diff generation, patch proposal,
 * approval gating, safe patch application, rollback, and bounded test execution.
 * Contributed by A1, A2, and A3.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  createEngineeringStudioService,
  EngineeringStudioService,
  createUnifiedDiff,
  computeSha256,
} from "../src/studio/index.ts";
import { ApprovalManager } from "../src/approvals/approval-manager.ts";

describe("Engineering Studio Workflow Suite (A1, A2, A3)", () => {
  let tempDir: string;
  let studio: EngineeringStudioService;
  let approvalManager: ApprovalManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "terrarium-studio-workflow-"));

    // Set up mock repository structure
    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "test-studio-app",
          version: "1.0.0",
          scripts: {
            test: "echo 'running tests' && exit 0",
          },
          dependencies: {
            express: "^4.18.2",
          },
        },
        null,
        2
      )
    );

    await fs.writeFile(
      path.join(tempDir, "src", "index.ts"),
      'export function hello(): string {\n  return "hello world";\n}\n'
    );

    await fs.writeFile(path.join(tempDir, "README.md"), "# Test Studio App\nWelcome!\n");

    approvalManager = new ApprovalManager();

    studio = createEngineeringStudioService({
      workspaceRoot: tempDir,
      approvalManager,
      defaultMode: "read_write",
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe("Repository Analysis", () => {
    it("scans repository and generates comprehensive analysis summary", async () => {
      const summary = await studio.analyzeRepository();

      expect(summary.repoPath).toBe(tempDir);
      expect(summary.languages.some((l) => l.name === "TypeScript")).toBe(true);
      expect(summary.frameworks).toContain("Express");
      expect(summary.dependencies.some((d) => d.name === "express")).toBe(true);
      expect(summary.entryPoints).toContain("src/index.ts");
      expect(summary.sensitiveFiles).toHaveLength(0);

      const latest = studio.getLatestAnalysis();
      expect(latest).not.toBeNull();
      expect(latest?.repoPath).toBe(tempDir);
    });

    it("detects sensitive files during analysis without reading their secrets", async () => {
      await fs.writeFile(path.join(tempDir, ".env"), "SECRET_KEY=supersecret\n");
      await fs.writeFile(path.join(tempDir, "id_rsa"), "-----BEGIN RSA PRIVATE KEY-----\n");

      const summary = await studio.analyzeRepository();
      const sensitivePaths = summary.sensitiveFiles.map((f) => f.path);
      expect(sensitivePaths).toContain(".env");
      expect(sensitivePaths).toContain("id_rsa");
    });
  });

  describe("Diff Engine", () => {
    it("generates correct unified diff with headers and hunks", () => {
      const original = 'function add(a, b) {\n  return a + b;\n}\n';
      const modified = 'function add(a, b) {\n  // add two numbers\n  return a + b;\n}\n';

      const result = createUnifiedDiff("src/math.ts", original, modified);
      expect(result.diffUnified).toContain("--- a/src/math.ts");
      expect(result.diffUnified).toContain("+++ b/src/math.ts");
      expect(result.diffUnified).toContain("+  // add two numbers");

      expect(result.hunks.length).toBeGreaterThan(0);
      expect(result.hunks[0]?.lines.some((l) => l.startsWith("+  // add two numbers"))).toBe(true);
    });
  });

  describe("Patch Proposals and Approval Gating", () => {
    it("proposes a patch and creates a consequential action approval request", async () => {
      const proposedContent =
        'export function hello(): string {\n  return "hello terrarium";\n}\n';

      const res = await studio.proposePatch({
        filePath: "src/index.ts",
        changeType: "modify",
        proposedContent,
        rationale: "Update greeting message for branding",
        taskId: "task_001",
      });

      expect(res.success).toBe(true);
      if (!res.success) return;

      const patch = res.data;
      expect(patch.filePath).toBe("src/index.ts");
      expect(patch.changeType).toBe("modify");
      expect(patch.status).toBe("proposed");
      expect(patch.requiresApproval).toBe(true);
      expect(patch.approvalRequestId).toBeDefined();

      const listed = studio.listPatches();
      expect(listed).toHaveLength(1);
      expect(listed[0]?.id).toBe(patch.id);
    });

    it("blocks patch application while approval is pending", async () => {
      const proposedContent =
        'export function hello(): string {\n  return "hello pending";\n}\n';

      const propRes = await studio.proposePatch({
        filePath: "src/index.ts",
        changeType: "modify",
        proposedContent,
        rationale: "Pending test patch",
      });

      expect(propRes.success).toBe(true);
      if (!propRes.success) return;

      const patch = propRes.data;

      // Attempt to apply without human approval
      const applyRes = await studio.applyPatch(patch.id);
      expect(applyRes.success).toBe(false);
      expect(applyRes.error).toContain("requires human approval");

      // Verify file on disk was NOT touched
      const onDisk = await fs.readFile(path.join(tempDir, "src", "index.ts"), "utf-8");
      expect(onDisk).toContain("hello world");
    });

    it("blocks patch application when approval is rejected", async () => {
      const proposedContent =
        'export function hello(): string {\n  return "hello rejected";\n}\n';

      const propRes = await studio.proposePatch({
        filePath: "src/index.ts",
        changeType: "modify",
        proposedContent,
        rationale: "Rejected test patch",
      });

      expect(propRes.success).toBe(true);
      if (!propRes.success) return;

      const patch = propRes.data;

      // Reject the patch
      const rejectRes = await studio.rejectPatch(patch.id, "Rejected by security lead");
      expect(rejectRes.success).toBe(true);

      const applyRes = await studio.applyPatch(patch.id);
      expect(applyRes.success).toBe(false);
      expect(applyRes.error).toContain("rejected by user");

      const onDisk = await fs.readFile(path.join(tempDir, "src", "index.ts"), "utf-8");
      expect(onDisk).toContain("hello world");
    });

    it("successfully applies patch after approval and supports rollback", async () => {
      const proposedContent =
        'export function hello(): string {\n  return "hello approved";\n}\n';

      const propRes = await studio.proposePatch({
        filePath: "src/index.ts",
        changeType: "modify",
        proposedContent,
        rationale: "Legitimate feature enhancement",
      });

      expect(propRes.success).toBe(true);
      if (!propRes.success) return;

      const patch = propRes.data;

      // Approve the patch
      const appRes = await studio.approvePatch(patch.id, "Approved by engineer");
      expect(appRes.success).toBe(true);

      // Apply the patch
      const applyRes = await studio.applyPatch(patch.id);
      expect(applyRes.success).toBe(true);

      // Verify file modified on disk
      const updatedOnDisk = await fs.readFile(path.join(tempDir, "src", "index.ts"), "utf-8");
      expect(updatedOnDisk).toContain("hello approved");

      // Rollback the patch
      const rollbackRes = await studio.rollbackPatch(patch.id);
      expect(rollbackRes.success).toBe(true);

      // Verify original content restored
      const rolledBackOnDisk = await fs.readFile(path.join(tempDir, "src", "index.ts"), "utf-8");
      expect(rolledBackOnDisk).toContain("hello world");
    });

    it("supports creating new files via patch and rolling back via deletion", async () => {
      const newFilePath = "src/utils.ts";
      const proposedContent = "export const PI = 3.14159;\n";

      const propRes = await studio.proposePatch({
        filePath: newFilePath,
        changeType: "create",
        proposedContent,
        rationale: "Add math utility file",
      });

      expect(propRes.success).toBe(true);
      if (!propRes.success) return;

      const patch = propRes.data;
      await studio.approvePatch(patch.id);

      const applyRes = await studio.applyPatch(patch.id);
      expect(applyRes.success).toBe(true);

      const createdOnDisk = await fs.readFile(path.join(tempDir, newFilePath), "utf-8");
      expect(createdOnDisk).toBe(proposedContent);

      // Roll back the creation
      const rollbackRes = await studio.rollbackPatch(patch.id);
      expect(rollbackRes.success).toBe(true);

      let fileExists = true;
      try {
        await fs.access(path.join(tempDir, newFilePath));
      } catch {
        fileExists = false;
      }
      expect(fileExists).toBe(false);
    });
  });

  describe("Bounded Test Runner", () => {
    it("runs tests within workspace and captures results", async () => {
      const testRes = await studio.runBoundedTests("echo '5 pass 0 fail' && exit 0", 5000);

      expect(testRes.passed).toBe(true);
      expect(testRes.exitCode).toBe(0);
      expect(testRes.stdout).toContain("5 pass 0 fail");
      expect(testRes.timedOut).toBe(false);
      expect(testRes.durationMs).toBeGreaterThanOrEqual(0);

      const latest = studio.getLatestTestRun();
      expect(latest?.totalTests).toBe(5);
      expect(latest?.passedTests).toBe(5);
    });

    it("times out and kills processes that exceed timeout boundary", async () => {
      const testRes = await studio.runBoundedTests("sleep 3", 500);

      expect(testRes.passed).toBe(false);
      expect(testRes.timedOut).toBe(true);
      expect(testRes.stderr).toContain("timed out after 500ms");
    });
  });
});
