/**
 * @terrarium/core - tests/provider-claude-code-cli.test.ts
 *
 * Comprehensive contract & integration tests for ClaudeCodeCliAdapter.
 * Tests CodingAgentCliAdapter interface, command execution, sandbox cwd containment,
 * changed files detection, timeout enforcement, and missing binary handling.
 * Aligns with PLAN.md Section 10.4 & PROMPT 19 requirements (A2 - Adapter Runtime & A3 - Reliability).
 */

import { describe, expect, it } from "bun:test";
import {
  ProviderInvalidRequestError,
  ProviderNotFoundError,
  ProviderTimeoutError,
} from "@terrarium/contracts";
import { ClaudeCodeCliAdapter, type SubprocessExecutor } from "../src/providers/index.ts";

describe("ClaudeCodeCliAdapter Suite", () => {
  const validCwd = process.cwd();

  describe("Capabilities & Configuration", () => {
    it("reports coding agent capabilities with non-interactive execution constraints", async () => {
      const adapter = new ClaudeCodeCliAdapter();
      const caps = await adapter.getCapabilities();

      expect(caps.success).toBe(true);
      if (caps.success) {
        expect(caps.data.supportsInteractivePty).toBe(false); // Autonomous safety constraint
        expect(caps.data.supportedTools).toContain("edit");
        expect(caps.data.supportedTools).toContain("bash");
        expect(caps.data.sessionPersistence).toBe(true);
        expect(caps.data.defaultTimeoutMs).toBe(120000);
      }
    });
  });

  describe("Command Execution & Sandbox Containment", () => {
    it("executes command via subprocess executor, passes -p flag, and extracts changed files", async () => {
      let capturedArgs: readonly string[] = [];
      let capturedCwd = "";

      const mockExecutor: SubprocessExecutor = async (args, options) => {
        capturedArgs = args;
        capturedCwd = options.cwd;

        return {
          exitCode: 0,
          stdout: "Analyzed code.\nCreated src/utils/math.ts with unit tests.\nUpdated src/index.ts.",
          stderr: "",
        };
      };

      const adapter = new ClaudeCodeCliAdapter({
        binaryPath: "claude",
        executor: mockExecutor,
      });

      const res = await adapter.runAgentCommand("Refactor math utilities", {
        cwd: validCwd,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.exitCode).toBe(0);
        expect(res.data.stdout).toContain("Created src/utils/math.ts");
        expect(res.data.changedFiles).toContain("src/utils/math.ts");
        expect(res.data.changedFiles).toContain("src/index.ts");
        expect(res.data.durationMs).toBeGreaterThanOrEqual(0);
      }

      expect(capturedArgs).toEqual(["claude", "-p", "Refactor math utilities"]);
      expect(capturedCwd).toBe(validCwd);
    });

    it("rejects command when working directory does not exist", async () => {
      const adapter = new ClaudeCodeCliAdapter();
      const res = await adapter.runAgentCommand("Check files", {
        cwd: "/nonexistent/invalid/sandbox/path",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderInvalidRequestError);
        expect(res.error.message).toContain("Working directory does not exist");
      }
    });

    it("rejects empty or whitespace command string", async () => {
      const adapter = new ClaudeCodeCliAdapter();
      const res = await adapter.runAgentCommand("   ", {
        cwd: validCwd,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderInvalidRequestError);
        expect(res.error.message).toContain("cannot be empty");
      }
    });
  });

  describe("Error Mapping & Missing Binary Recovery", () => {
    it("maps ENOENT to ProviderNotFoundError with npm installation guidance", async () => {
      const mockExecutor: SubprocessExecutor = async () => {
        const err: any = new Error("spawn claude ENOENT");
        err.code = "ENOENT";
        throw err;
      };

      const adapter = new ClaudeCodeCliAdapter({
        binaryPath: "claude",
        executor: mockExecutor,
      });

      const res = await adapter.runAgentCommand("Run tests", {
        cwd: validCwd,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderNotFoundError);
        expect(res.error.message).toContain("npm install -g @anthropic-ai/claude-code");
      }
    });

    it("maps timeout to ProviderTimeoutError", async () => {
      const mockExecutor: SubprocessExecutor = async () => {
        throw new DOMException("Process timed out", "AbortError");
      };

      const adapter = new ClaudeCodeCliAdapter({
        executor: mockExecutor,
      });

      const res = await adapter.runAgentCommand("Heavy build", {
        cwd: validCwd,
        timeoutMs: 5000,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderTimeoutError);
        expect((res.error as ProviderTimeoutError).timeoutMs).toBe(5000);
      }
    });
  });
});
