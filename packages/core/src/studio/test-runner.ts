/**
 * @terrarium/core - studio/test-runner.ts
 *
 * Bounded test execution runner with timeout controls, output parsing,
 * and exact result recording.
 * Contributed by A2 (Orchestration & AI Runtime) & A3 (Data, Security & Reliability).
 */

import { type BoundedTestRunResult } from "@terrarium/contracts";
import type { CodeSecuritySandbox } from "./code-security-sandbox.ts";

export interface TestRunnerOptions {
  readonly workspaceRoot: string;
  readonly defaultCommand?: string;
  readonly timeoutMs?: number;
  readonly sandbox?: CodeSecuritySandbox;
}

export class BoundedTestRunner {
  private readonly workspaceRoot: string;
  private readonly defaultCommand: string;
  private readonly timeoutMs: number;
  private readonly sandbox?: CodeSecuritySandbox;

  constructor(options: TestRunnerOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.defaultCommand = options.defaultCommand ?? "bun test";
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.sandbox = options.sandbox;
  }

  /**
   * Executes tests with strict timeout bounds and captures exact test results.
   */
  public async runTests(customCommand?: string, timeoutMs?: number): Promise<BoundedTestRunResult> {
    const cmd = customCommand?.trim() || this.defaultCommand;
    const timeout = Math.min(timeoutMs ?? this.timeoutMs, 120000);
    const startTime = Date.now();
    const runId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Shell command security validation
    if (this.sandbox) {
      const secCheck = this.sandbox.validateShellCommand(cmd);
      if (!secCheck.success) {
        return {
          id: runId,
          command: cmd,
          passed: false,
          exitCode: 126,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          durationMs: 0,
          stdout: "",
          stderr: secCheck.error.message,
          executedAt: new Date().toISOString(),
          timedOut: false,
        };
      }
    }

    let stdout = "";
    let stderr = "";
    let exitCode = 1;
    let passed = false;
    let timedOut = false;

    try {
      const proc = Bun.spawn(["sh", "-c", cmd], {
        cwd: this.workspaceRoot,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          NODE_ENV: "test",
          CI: "true",
        },
      });

      // Timeout race
      const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) =>
        setTimeout(() => resolve({ isTimeout: true }), timeout)
      );

      const executionPromise = (async () => {
        const outPromise = new Response(proc.stdout).text();
        const errPromise = new Response(proc.stderr).text();
        const code = await proc.exited;
        return {
          isTimeout: false as const,
          code,
          stdout: await outPromise,
          stderr: await errPromise,
        };
      })();

      const result = await Promise.race([executionPromise, timeoutPromise]);

      if (result.isTimeout) {
        timedOut = true;
        try {
          proc.kill(9);
        } catch {}
        stderr = `Test execution timed out after ${timeout}ms.`;
        exitCode = 124;
      } else {
        exitCode = result.code;
        stdout = result.stdout;
        stderr = result.stderr;
        passed = exitCode === 0;
      }
    } catch (err: unknown) {
      stderr = `Failed to spawn test process: ${String(err)}`;
      exitCode = 1;
    }

    const durationMs = Date.now() - startTime;

    // Parse test counts from output
    const counts = this.parseTestCounts(stdout + "\n" + stderr);

    return {
      id: runId,
      command: cmd,
      passed,
      exitCode,
      totalTests: counts.total,
      passedTests: counts.passed,
      failedTests: counts.failed,
      durationMs,
      stdout,
      stderr,
      executedAt: new Date().toISOString(),
      timedOut,
    };
  }

  /**
   * Extracts passed, failed, and total counts from common test runners.
   */
  private parseTestCounts(output: string): { total: number; passed: number; failed: number } {
    let passed = 0;
    let failed = 0;
    let total = 0;

    // Bun test pattern e.g. " 414 pass \n 0 fail "
    const bunPassMatch = output.match(/(\d+)\s+pass/i);
    const bunFailMatch = output.match(/(\d+)\s+fail/i);
    if (bunPassMatch || bunFailMatch) {
      passed = bunPassMatch ? parseInt(bunPassMatch[1] ?? "0", 10) : 0;
      failed = bunFailMatch ? parseInt(bunFailMatch[1] ?? "0", 10) : 0;
      total = passed + failed;
      return { total, passed, failed };
    }

    // Jest/Vitest pattern e.g. "Tests:  5 passed, 1 failed, 6 total"
    const jestMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,?\s*)?(?:(\d+)\s+passed,?\s*)?(\d+)\s+total/i);
    if (jestMatch) {
      failed = jestMatch[1] ? parseInt(jestMatch[1], 10) : 0;
      passed = jestMatch[2] ? parseInt(jestMatch[2], 10) : 0;
      total = jestMatch[3] ? parseInt(jestMatch[3], 10) : passed + failed;
      return { total, passed, failed };
    }

    // Pytest pattern e.g. "=== 10 passed, 2 failed in 0.5s ==="
    const pytestPass = output.match(/(\d+)\s+passed/i);
    const pytestFail = output.match(/(\d+)\s+failed/i);
    if (pytestPass || pytestFail) {
      passed = pytestPass ? parseInt(pytestPass[1] ?? "0", 10) : 0;
      failed = pytestFail ? parseInt(pytestFail[1] ?? "0", 10) : 0;
      total = passed + failed;
      return { total, passed, failed };
    }

    return { total: 0, passed: 0, failed: 0 };
  }
}
