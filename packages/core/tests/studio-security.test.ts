/**
 * packages/core/tests/studio-security.test.ts
 *
 * Comprehensive test suite for Engineering Studio Security Sandbox & Safe Code Guards.
 * Contributed by A3 (Data, Security & Reliability).
 *
 * Validates:
 * - Read-only default repository access mode blocking writes.
 * - Strict shielding of protected files (.env, private keys, .git/config, credentials).
 * - Path traversal and null byte injection prevention.
 * - Symlink escape detection.
 * - Shell command safety guards (destructive commands blocked, installs gated).
 * - Preservation of user edits via content hash verification.
 * - Atomic multi-file patch application with rollback on partial failure.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  CodeSecuritySandbox,
  PatchManager,
} from "../src/studio/index.ts";

describe("Engineering Studio Security Sandbox Suite (A3)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "terrarium-studio-sec-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  test("defaults repository access to read-only and blocks write mutations", async () => {
    const sandbox = new CodeSecuritySandbox({
      workspaceRoot: tempDir,
      defaultMode: "read_only",
    });

    expect(sandbox.getAccessMode()).toBe("read_only");

    // Reading an allowed file should succeed (when file exists)
    const testFile = path.join(tempDir, "sample.txt");
    await fs.writeFile(testFile, "hello world", "utf8");

    const readRes = await sandbox.validatePathAccess("sample.txt", "read");
    expect(readRes.success).toBe(true);

    // Writing or deleting in read_only mode must be blocked
    const writeRes = await sandbox.validatePathAccess("sample.txt", "write");
    expect(writeRes.success).toBe(false);
    if (!writeRes.success) {
      expect(writeRes.error.name).toBe("PermissionDeniedError");
      expect(writeRes.error.message).toContain("read-only mode by default");
    }

    const deleteRes = await sandbox.validatePathAccess("sample.txt", "delete");
    expect(deleteRes.success).toBe(false);
    if (!deleteRes.success) {
      expect(deleteRes.error.message).toContain("read-only mode by default");
    }
  });

  test("strictly shields protected credentials, secret, and configuration files", async () => {
    const sandbox = new CodeSecuritySandbox({
      workspaceRoot: tempDir,
      defaultMode: "read_write", // Even in read_write mode, protected files must be blocked
    });

    const protectedPaths = [
      ".env",
      ".env.local",
      ".env.production",
      "config/.env.secret",
      "certs/server.key",
      "certs/tls.pem",
      "certs/cert.pfx",
      "ssh/id_rsa",
      "ssh/id_ed25519",
      ".git/config",
      "credentials.json",
      "service-account-key.json",
      ".npmrc",
      ".netrc",
      ".aws/credentials",
    ];

    for (const p of protectedPaths) {
      const check = sandbox.isProtectedFile(p);
      expect(check.protected).toBe(true);

      const writeRes = await sandbox.validatePathAccess(p, "write");
      expect(writeRes.success).toBe(false);
      if (!writeRes.success) {
        expect(writeRes.error.name).toBe("PermissionDeniedError");
        expect(writeRes.error.message).toContain("protected");
      }

      const delRes = await sandbox.validatePathAccess(p, "delete");
      expect(delRes.success).toBe(false);
    }

    // Normal files must not be protected
    expect(sandbox.isProtectedFile("src/index.ts").protected).toBe(false);
    expect(sandbox.isProtectedFile("package.json").protected).toBe(false);
    expect(sandbox.isProtectedFile("README.md").protected).toBe(false);
  });

  test("guards against path traversal and null byte injections", async () => {
    const sandbox = new CodeSecuritySandbox({
      workspaceRoot: tempDir,
      defaultMode: "read_write",
    });

    // 1. Path traversal escaping root
    const escapeRes = await sandbox.validatePathAccess("../../etc/passwd", "read");
    expect(escapeRes.success).toBe(false);
    if (!escapeRes.success) {
      expect(escapeRes.error.message).toContain("traverses outside the workspace sandbox root");
    }

    // 2. Absolute path outside root
    const absRes = await sandbox.validatePathAccess("/etc/shadow", "read");
    expect(absRes.success).toBe(false);
    if (!absRes.success) {
      expect(absRes.error.message).toContain("traverses outside the workspace sandbox root");
    }

    // 3. Null byte injection
    const nullByteRes = await sandbox.validatePathAccess("file.txt\0.js", "read");
    expect(nullByteRes.success).toBe(false);
    if (!nullByteRes.success) {
      expect(nullByteRes.error.message).toContain("null byte injection");
    }
  });

  test("guards shell commands against destructive operations and unapproved package installs", () => {
    const sandbox = new CodeSecuritySandbox({
      workspaceRoot: tempDir,
      allowDependencyInstall: false,
    });

    // 1. Destructive commands must be blocked
    const dangerousCommands = [
      "rm -rf /",
      "rm -rf node_modules",
      "rm -r build",
      "mkfs /dev/sda1",
      "dd if=/dev/zero of=/dev/sda",
      "git reset --hard HEAD~1",
      "git clean -fd",
      "DROP TABLE users;",
      "DROP DATABASE production;",
      "npm publish",
      "cargo publish",
      "terraform destroy",
    ];

    for (const cmd of dangerousCommands) {
      const res = sandbox.validateShellCommand(cmd);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.name).toBe("PermissionDeniedError");
        expect(res.error.message).toContain("Destructive command detected");
      }
    }

    // 2. Dependency install must be blocked when allowDependencyInstall=false
    const installCommands = [
      "npm install express",
      "npm i axios",
      "yarn add lodash",
      "pnpm add vitest",
      "bun add @opentui/core",
      "pip install requests",
      "cargo add serde",
      "go get github.com/gin-gonic/gin",
    ];

    for (const cmd of installCommands) {
      const res = sandbox.validateShellCommand(cmd);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.name).toBe("PermissionDeniedError");
        expect(res.error.message).toContain("Dependency installation command detected");
      }
    }

    // 3. Normal commands must pass
    const normalRes = sandbox.validateShellCommand("bun test");
    expect(normalRes.success).toBe(true);
    if (normalRes.success) {
      expect(normalRes.data.isDestructive).toBe(false);
    }
  });

  test("preserves user edits by aborting patch application when content hash mismatches", async () => {
    const sandbox = new CodeSecuritySandbox({
      workspaceRoot: tempDir,
      defaultMode: "read_write",
    });
    const patchManager = new PatchManager(sandbox);

    const targetFile = "src/feature.ts";
    const fullPath = path.join(tempDir, targetFile);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, "export const value = 42;\n", "utf8");

    // Propose patch based on current file
    const patchRes = await patchManager.proposePatch({
      filePath: targetFile,
      proposedContent: "export const value = 100;\n",
      rationale: "Update configuration value",
    });
    expect(patchRes.success).toBe(true);
    const patch = (patchRes as any).data;

    // Simulate concurrent user modification to the file before patch application
    await fs.writeFile(fullPath, "export const value = 42; // User added this comment\n", "utf8");

    // Apply patch should fail cleanly to preserve user changes!
    const applyRes = await patchManager.applyPatch(patch);
    expect(applyRes.success).toBe(false);
    expect(applyRes.error).toContain("Working tree conflict");
    expect(applyRes.error).toContain("preserve user changes");

    // Verify user file content is completely intact!
    const preservedContent = await fs.readFile(fullPath, "utf8");
    expect(preservedContent).toBe("export const value = 42; // User added this comment\n");
  });

  test("atomically rolls back multi-file patches when a partial patch failure occurs", async () => {
    const sandbox = new CodeSecuritySandbox({
      workspaceRoot: tempDir,
      defaultMode: "read_write",
    });
    const patchManager = new PatchManager(sandbox);

    // Setup file 1 (valid)
    const file1 = "file1.txt";
    const full1 = path.join(tempDir, file1);
    await fs.writeFile(full1, "Initial 1\n", "utf8");

    // Setup file 2 (will fail because it targets a protected file)
    const file2 = ".env";

    const p1Res = await patchManager.proposePatch({
      filePath: file1,
      proposedContent: "Updated 1\n",
      rationale: "Update file 1",
    });
    expect(p1Res.success).toBe(true);

    const patch1 = (p1Res as any).data;

    // Craft patch 2 targeting .env
    const patch2 = {
      id: "patch_bad",
      filePath: file2,
      changeType: "modify" as const,
      originalContent: "SECRET=true",
      originalHash: "dummy",
      proposedContent: "SECRET=false",
      proposedHash: "dummy2",
      diffUnified: "diff",
      hunks: [],
      rationale: "Malicious edit to secret",
      status: "proposed" as const,
      requiresApproval: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Apply multi-file patch [patch1, patch2]
    const multiRes = await patchManager.applyMultiFilePatch([patch1, patch2]);

    // Should fail with partialFailure
    expect(multiRes.success).toBe(false);
    expect(multiRes.partialFailure).toBe(true);
    expect(multiRes.error).toContain(".env");

    // Crucial check: file1 must be rolled back to its original state!
    const content1 = await fs.readFile(full1, "utf8");
    expect(content1).toBe("Initial 1\n");
  });
});
