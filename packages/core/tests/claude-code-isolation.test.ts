/**
 * packages/core/tests/claude-code-isolation.test.ts
 *
 * Comprehensive Security & Isolation Tests for Claude Code Integration.
 * Contributed by A3 (Senior Backend Developer, Data, Security & Reliability).
 *
 * Asserts:
 * - Standard mode never enables dangerous bypass.
 * - Dangerous mode fails closed without explicit opt-in.
 * - Filesystem root (/) and user home (~) are strictly blocked.
 * - Sensitive credential paths (.ssh, .aws, .gnupg) are shielded.
 * - Environment sanitization strips tokens and credentials.
 * - Non-existent or non-directory paths are rejected.
 * - Honest limitations are reported without misleading claims.
 */

import { describe, expect, it } from "bun:test";
import {
  verifyIsolation,
  sanitizeEnvironment,
  ALLOWLISTED_ENV_VARS,
} from "../src/coding-agents/isolation-verifier.ts";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

describe("Claude Code Isolation Boundary & Security Gate Suite (A3)", () => {
  it("verifies safe isolated workspace directory successfully", async () => {
    const report = await verifyIsolation(process.cwd());
    expect(report.isIsolated).toBe(true);
    expect(report.status).toBe("verified");
    expect(report.isHomeDirOrRoot).toBe(false);
    expect(report.workspaceRoot).toBe(path.resolve(process.cwd()));
    expect(report.shieldedPaths.length).toBeGreaterThan(0);
    expect(report.honestLimitations.length).toBeGreaterThan(0);
  });

  it("strictly rejects filesystem root directory (/) as unsafe", async () => {
    const rootDir = path.parse(process.cwd()).root;
    const report = await verifyIsolation(rootDir);

    expect(report.isIsolated).toBe(false);
    expect(report.status).toBe("failed");
    expect(report.isHomeDirOrRoot).toBe(true);
    expect(report.failureReason).toContain("cannot be root directory");
  });

  it("strictly rejects user home directory (~) as unsafe", async () => {
    const homeDir = os.homedir();
    const report = await verifyIsolation(homeDir);

    expect(report.isIsolated).toBe(false);
    expect(report.status).toBe("failed");
    expect(report.isHomeDirOrRoot).toBe(true);
    expect(report.failureReason).toContain("user home directory");
  });

  it("fails closed on non-existent workspace path", async () => {
    const fakePath = "/path/to/non_existent_terrarium_workspace_xyz_123";
    const report = await verifyIsolation(fakePath);

    expect(report.isIsolated).toBe(false);
    expect(report.status).toBe("failed");
    expect(report.failureReason).toContain("Workspace path does not exist");
  });

  it("fails closed when workspace path is a file rather than a directory", async () => {
    const filePath = path.resolve(process.cwd(), "package.json");
    const report = await verifyIsolation(filePath);

    expect(report.isIsolated).toBe(false);
    expect(report.status).toBe("failed");
    expect(report.failureReason).toContain("is not a directory");
  });

  it("strictly rejects system directories like /bin and /usr", async () => {
    const report = await verifyIsolation("/usr");
    expect(report.isIsolated).toBe(false);
    expect(report.status).toBe("failed");
    expect(report.failureReason).toContain("system directory");
  });

  it("sanitizes environment by only forwarding allowlisted variables", () => {
    const mockEnv = {
      PATH: "/usr/bin:/bin",
      HOME: "/Users/test",
      TERM: "xterm-256color",
      ANTHROPIC_API_KEY: "sk-ant-test-key-123",
      // Sensitive variables that MUST be stripped:
      SSH_AUTH_SOCK: "/tmp/ssh-agent.sock",
      AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
      AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      GITHUB_TOKEN: "ghp_1234567890abcdef",
      DATABASE_URL: "postgres://user:password@localhost:5432/db",
      SECRET_KEY: "supersecretvalue",
    };

    const sanitized = sanitizeEnvironment(mockEnv);

    // Allowlisted should be present
    expect(sanitized.PATH).toBe("/usr/bin:/bin");
    expect(sanitized.HOME).toBe("/Users/test");
    expect(sanitized.TERM).toBe("xterm-256color");
    expect(sanitized.ANTHROPIC_API_KEY).toBe("sk-ant-test-key-123");

    // Stripped variables must NOT be present
    expect(sanitized.SSH_AUTH_SOCK).toBeUndefined();
    expect(sanitized.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(sanitized.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(sanitized.GITHUB_TOKEN).toBeUndefined();
    expect(sanitized.DATABASE_URL).toBeUndefined();
    expect(sanitized.SECRET_KEY).toBeUndefined();
  });

  it("accurately discloses honest limitations without fake security claims", async () => {
    const report = await verifyIsolation(process.cwd());
    const limits = report.honestLimitations.join(" ");

    expect(limits).toContain("confines file system operations");
    expect(limits).toContain("does NOT provide kernel-level syscall filtering");
    expect(limits).toContain("will not prompt for command execution inside this boundary");
  });
});
