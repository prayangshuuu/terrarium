/**
 * apps/cli/tests/standalone-cli.test.ts
 *
 * Tests for Standalone Terrarium CLI executable, dispatcher routing,
 * doctor commands, and one-shot prompt execution.
 * Prompt 26 verification suite. Zero emoji typography.
 */

import { describe, it, expect } from "bun:test";
import { resolve } from "node:path";
import { parseOneshotArgs, handleOneshotCommand } from "../src/commands/oneshot-cli.ts";
import { handleDoctorCommand } from "../src/commands/doctor-cli.ts";

const repoRoot = resolve(import.meta.dir, "../../..");
const binaryPath = resolve(repoRoot, "bin/terrarium");

describe("Standalone CLI & Dispatcher (Prompt 26)", () => {
  describe("parseOneshotArgs", () => {
    it("parses default orchestrator arguments", () => {
      const opts = parseOneshotArgs(["Review", "my", "codebase"]);
      expect(opts.promptText).toBe("Review my codebase");
      expect(opts.provider).toBe("orchestrator");
      expect(opts.dryRun).toBe(false);
      expect(opts.includeContext).toBe(true);
    });

    it("parses provider flags and aliases", () => {
      const optsClaude = parseOneshotArgs(["-p", "claude", "Refactor", "auth"]);
      expect(optsClaude.provider).toBe("claude_code");
      expect(optsClaude.promptText).toBe("Refactor auth");

      const optsAgy = parseOneshotArgs(["--provider", "agy", "Explain", "service"]);
      expect(optsAgy.provider).toBe("antigravity");

      const optsAgent = parseOneshotArgs(["-p", "agent", "Write", "unit tests"]);
      expect(optsAgent.provider).toBe("cursor");

      const optsOllama = parseOneshotArgs(["-p", "ollama", "-m", "llama3.2", "Summarize"]);
      expect(optsOllama.provider).toBe("ollama");
      expect(optsOllama.model).toBe("llama3.2");
      expect(optsOllama.promptText).toBe("Summarize");
    });

    it("parses dry-run, no-context, workspace, and output flags", () => {
      const opts = parseOneshotArgs([
        "run",
        "Test prompt",
        "--dry-run",
        "--no-context",
        "-w",
        "/custom/workspace",
        "-o",
        "/tmp/out.txt",
      ]);

      expect(opts.promptText).toBe("Test prompt");
      expect(opts.dryRun).toBe(true);
      expect(opts.includeContext).toBe(false);
      expect(opts.workspace).toBe("/custom/workspace");
      expect(opts.outputFile).toBe("/tmp/out.txt");
    });
  });

  describe("handleDoctorCommand unit check", () => {
    it("runs doctor diagnostic check successfully", async () => {
      const exitCode = await handleDoctorCommand(["--json"]);
      expect(exitCode).toBe(0);
    });
  });

  describe("handleOneshotCommand dry-run check", () => {
    it("executes dry-run without failures", async () => {
      const exitCode = await handleOneshotCommand([
        "Explain architecture of the system",
        "--dry-run",
      ]);
      expect(exitCode).toBe(0);
    });

    it("rejects empty prompts with exit code 1", async () => {
      const exitCode = await handleOneshotCommand([]);
      expect(exitCode).toBe(1);
    });
  });

  describe("bin/terrarium Process Invocations", () => {
    it("runs 'terrarium --version' with exit code 0", async () => {
      const proc = Bun.spawn([binaryPath, "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe("terrarium 0.1.0");
    });

    it("runs 'terrarium --help' with exit code 0 and zero emojis", async () => {
      const proc = Bun.spawn([binaryPath, "--help"], {
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(stdout).toContain("TERRARIUM");
      expect(stdout).toContain("doctor");
      expect(stdout).toContain("claude code");
      expect(stdout).toContain("agy");
      expect(stdout).toContain("agent");
      expect(stdout).toContain("--ollama");

      // Verify strict zero emoji policy
      const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
      expect(emojiRegex.test(stdout)).toBe(false);
    });

    it("runs 'terrarium doctor' with exit code 0", async () => {
      const proc = Bun.spawn([binaryPath, "doctor"], {
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(stdout).toContain("TERRARIUM SYSTEM HEALTH DIAGNOSTICS");
      expect(stdout).toContain("Bun Runtime:");
      expect(stdout).toContain("Claude Code CLI");
      expect(stdout).toContain("Antigravity CLI");
      expect(stdout).toContain("Cursor Agent CLI");
      expect(stdout).toContain("Ollama Local Runtime");
      expect(stdout).toContain("ALL CORE CHECKS PASSED");
    });

    it("runs one-shot dry-run prompt with exit code 0", async () => {
      const proc = Bun.spawn(
        [binaryPath, "Review security postures in this repository", "--dry-run"],
        {
          stdout: "pipe",
          stderr: "pipe",
        }
      );

      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(stdout).toContain("TERRARIUM ONE-SHOT PROMPT RUNNER");
      expect(stdout).toContain("Project Root:");
      expect(stdout).toContain("Prompt logged to history");
    });
  });
});
