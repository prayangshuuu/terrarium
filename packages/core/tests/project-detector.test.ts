/**
 * packages/core/tests/project-detector.test.ts
 *
 * Tests for project root auto-detection and safe context assembly.
 * Prompt 26 verification suite. Zero emoji typography.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectProjectRoot,
  assemblePromptContext,
} from "../src/prompt/project-detector.ts";

describe("Project Detector & Context Assembler (Prompt 26)", () => {
  let tempWorkspace: string;

  beforeEach(() => {
    tempWorkspace = mkdtempSync(join(tmpdir(), "terrarium-proj-test-"));
  });

  afterEach(() => {
    if (existsSync(tempWorkspace)) {
      rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });

  describe("detectProjectRoot", () => {
    it("detects project root from current git repository", () => {
      const detected = detectProjectRoot(process.cwd());
      expect(detected.isGitRepo).toBe(true);
      expect(detected.projectRoot).toBe(process.cwd());
      expect(detected.manifestType).toBe("bun_npm");
      expect(detected.projectName).toBe("terrarium");
    });

    it("climbs directory hierarchy from deep nested subfolder to nearest package root", () => {
      const nestedPath = join(process.cwd(), "packages", "core", "src", "prompt");
      const detected = detectProjectRoot(nestedPath);
      expect(detected.projectRoot).toBe(join(process.cwd(), "packages", "core"));
      expect(detected.projectName).toBe("@terrarium/core");
      expect(detected.manifestType).toBe("bun_npm");
    });

    it("detects synthetic project with package.json in temp folder", () => {
      const pkgJsonPath = join(tempWorkspace, "package.json");
      writeFileSync(
        pkgJsonPath,
        JSON.stringify({ name: "my-test-service", version: "2.4.1" }),
        "utf8"
      );

      const subDir = join(tempWorkspace, "src", "modules", "auth");
      mkdirSync(subDir, { recursive: true });

      const detected = detectProjectRoot(subDir);
      expect(detected.projectRoot).toBe(tempWorkspace);
      expect(detected.projectName).toBe("my-test-service");
      expect(detected.manifestVersion).toBe("2.4.1");
      expect(detected.manifestType).toBe("bun_npm");
    });

    it("detects synthetic git repository root with .git folder", () => {
      const gitDir = join(tempWorkspace, ".git");
      mkdirSync(gitDir, { recursive: true });

      const deepDir = join(tempWorkspace, "a", "b", "c");
      mkdirSync(deepDir, { recursive: true });

      const detected = detectProjectRoot(deepDir);
      expect(detected.isGitRepo).toBe(true);
      expect(detected.projectRoot).toBe(tempWorkspace);
    });

    it("falls back gracefully when no root markers are found", () => {
      const emptyDir = join(tempWorkspace, "empty");
      mkdirSync(emptyDir, { recursive: true });

      const detected = detectProjectRoot(emptyDir);
      expect(detected.projectRoot).toBe(emptyDir);
      expect(detected.isGitRepo).toBe(false);
      expect(detected.manifestType).toBeUndefined();
    });
  });

  describe("assemblePromptContext", () => {
    it("safely packages manifest, tree, and git status", () => {
      // Setup mock project
      writeFileSync(
        join(tempWorkspace, "package.json"),
        JSON.stringify({ name: "demo-service", version: "1.0.0" }),
        "utf8"
      );
      mkdirSync(join(tempWorkspace, ".git"), { recursive: true });
      mkdirSync(join(tempWorkspace, "src"), { recursive: true });
      mkdirSync(join(tempWorkspace, "tests"), { recursive: true });
      writeFileSync(join(tempWorkspace, "README.md"), "# Demo", "utf8");

      // Malicious / sensitive file that should NOT be packed into tree
      writeFileSync(join(tempWorkspace, ".env"), "SECRET_KEY=12345", "utf8");

      const assembled = assemblePromptContext(tempWorkspace, [
        "project_manifest",
        "git_status",
        "project_tree",
      ]);

      expect(assembled.textSnippet).toContain("demo-service v1.0.0");
      expect(assembled.textSnippet).toContain("GIT REPOSITORY");
      expect(assembled.textSnippet).toContain("WORKSPACE ROOTS");
      expect(assembled.textSnippet).toContain("src/");
      expect(assembled.textSnippet).toContain("tests/");

      // Verify .env is NOT in the tree output
      expect(assembled.textSnippet).not.toContain(".env");
      expect(assembled.textSnippet).not.toContain("SECRET_KEY");
    });

    it("respects maxChars character bound", () => {
      writeFileSync(
        join(tempWorkspace, "package.json"),
        JSON.stringify({ name: "large-project-test", version: "1.0.0" }),
        "utf8"
      );

      const assembled = assemblePromptContext(
        tempWorkspace,
        ["project_manifest", "project_tree"],
        30
      );

      expect(assembled.textSnippet.length).toBeLessThanOrEqual(50);
    });
  });
});
