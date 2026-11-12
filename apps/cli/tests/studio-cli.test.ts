/**
 * @terrarium/cli - tests/studio-cli.test.ts
 *
 * Unit and integration tests for Engineering Studio CLI command handlers.
 * Contributed by A4 (CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  createEngineeringStudioService,
  EngineeringStudioService,
} from "@terrarium/core";
import { ApprovalManager } from "@terrarium/core";
import {
  handleStudioAnalyze,
  handleStudioListPatches,
  handleStudioDiff,
  handleStudioApply,
  handleStudioRollback,
  handleStudioTest,
} from "../src/commands/studio-commands.ts";

describe("Engineering Studio CLI Suite (A4 & A5)", () => {
  let tempDir: string;
  let studio: EngineeringStudioService;
  let approvalManager: ApprovalManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "terrarium-studio-cli-"));

    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "cli-test-app",
          version: "1.0.0",
          scripts: { test: "echo '2 pass 0 fail'" },
          dependencies: { react: "^18.2.0" },
        },
        null,
        2
      )
    );
    await fs.writeFile(path.join(tempDir, "src", "index.ts"), "console.log('original');\n");

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
    } catch {}
  });

  describe("handleStudioAnalyze", () => {
    it("formats human-readable repository analysis output", async () => {
      const res = await handleStudioAnalyze(studio, { useColor: false });
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.output).toContain("Engineering Studio: Repository Analysis");
      expect(res.data.output).toContain("TypeScript");
      expect(res.data.output).toContain("React");
      expect(res.data.output).toContain("src/index.ts");
      expect(res.data.summary.repoPath).toBe(tempDir);
    });

    it("outputs valid JSON when requested", async () => {
      const res = await handleStudioAnalyze(studio, { json: true });
      expect(res.success).toBe(true);
      if (!res.success) return;

      const parsed = JSON.parse(res.data.output);
      expect(parsed.repoPath).toBe(tempDir);
      expect(parsed.languages).toBeDefined();
    });
  });

  describe("handleStudioListPatches and handleStudioDiff", () => {
    it("lists proposed patches and renders colored diff", async () => {
      // Propose patch
      const propRes = await studio.proposePatch({
        filePath: "src/index.ts",
        changeType: "modify",
        proposedContent: "console.log('modified');\n",
        rationale: "Update console logging",
      });

      expect(propRes.success).toBe(true);
      if (!propRes.success) return;

      const patch = propRes.data;

      // List patches
      const listRes = await handleStudioListPatches(studio, { useColor: false });
      expect(listRes.success).toBe(true);
      if (!listRes.success) return;
      expect(listRes.data.output).toContain(patch.id);
      expect(listRes.data.output).toContain("src/index.ts");
      expect(listRes.data.output).toContain("Update console logging");

      // Inspect diff
      const diffRes = await handleStudioDiff(studio, patch.id, { useColor: true });
      expect(diffRes.success).toBe(true);
      if (!diffRes.success) return;
      expect(diffRes.data.output).toContain("Diff Inspector");
      expect(diffRes.data.output).toContain("original");
      expect(diffRes.data.output).toContain("modified");
    });

    it("returns error when inspecting non-existent patch", async () => {
      const diffRes = await handleStudioDiff(studio, "patch_non_existent");
      expect(diffRes.success).toBe(false);
    });
  });

  describe("handleStudioApply and handleStudioRollback", () => {
    it("handles applying patch and rolling back via CLI", async () => {
      const propRes = await studio.proposePatch({
        filePath: "src/index.ts",
        changeType: "modify",
        proposedContent: "console.log('applied-via-cli');\n",
        rationale: "CLI patch apply test",
      });

      expect(propRes.success).toBe(true);
      if (!propRes.success) return;

      const patch = propRes.data;

      // Approve patch first
      await studio.approvePatch(patch.id);

      // Apply via CLI handler
      const applyRes = await handleStudioApply(studio, patch.id, { useColor: false });
      expect(applyRes.success).toBe(true);
      if (!applyRes.success) return;
      expect(applyRes.data.output).toContain("Successfully applied patch");

      // Verify on disk
      const onDisk = await fs.readFile(path.join(tempDir, "src", "index.ts"), "utf-8");
      expect(onDisk).toBe("console.log('applied-via-cli');\n");

      // Rollback via CLI handler
      const rollbackRes = await handleStudioRollback(studio, patch.id, { useColor: false });
      expect(rollbackRes.success).toBe(true);
      if (!rollbackRes.success) return;
      expect(rollbackRes.data.output).toContain("Successfully rolled back patch");

      // Verify on disk restored
      const restored = await fs.readFile(path.join(tempDir, "src", "index.ts"), "utf-8");
      expect(restored).toBe("console.log('original');\n");
    });
  });

  describe("handleStudioTest", () => {
    it("executes bounded test command and formats results", async () => {
      const testRes = await handleStudioTest(studio, {
        command: "echo '2 pass 0 fail' && exit 0",
        useColor: false,
      });

      expect(testRes.success).toBe(true);
      if (!testRes.success) return;
      expect(testRes.data.output).toContain("Bounded Test Run");
      expect(testRes.data.output).toContain("PASSED");
      expect(testRes.data.result.totalTests).toBe(2);
      expect(testRes.data.result.passedTests).toBe(2);
    });
  });
});
