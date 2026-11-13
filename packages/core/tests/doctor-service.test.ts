/**
 * packages/core/tests/doctor-service.test.ts
 *
 * Tests for DoctorService health diagnostics and system audits.
 * Prompt 26 verification suite. Zero emoji typography.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DoctorService } from "../src/prompt/doctor-service.ts";

describe("DoctorService Diagnostics (Prompt 26)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "terrarium-doc-test-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("generates a complete, valid DoctorReport", async () => {
    const report = await DoctorService.generateReport(process.cwd());

    expect(report).toBeDefined();
    expect(typeof report.terrariumVersion).toBe("string");
    expect(report.terrariumVersion).toBe("0.1.0");
    expect(typeof report.bunVersion).toBe("string");
    expect(report.bunVersion.length).toBeGreaterThan(0);
    expect(typeof report.platform).toBe("string");
    expect(typeof report.architecture).toBe("string");
    expect(report.projectRoot).toBe(process.cwd());
    expect(report.isGitRepo).toBe(true);

    // Database check
    expect(report.databaseHealth).toBeDefined();
    expect(["ok", "degraded", "error"]).toContain(report.databaseHealth.status);

    // Providers check: all 4 required providers must be probed
    expect(report.providers.length).toBe(4);
    const providerIds = report.providers.map((p) => p.id);
    expect(providerIds).toContain("claude_code");
    expect(providerIds).toContain("antigravity");
    expect(providerIds).toContain("cursor");
    expect(providerIds).toContain("ollama");

    for (const p of report.providers) {
      expect(typeof p.name).toBe("string");
      expect(typeof p.binary).toBe("string");
      expect(typeof p.installed).toBe("boolean");
      expect(["verified", "available", "unavailable", "offline"]).toContain(p.status);
    }

    // Path check
    expect(report.pathCheck).toBeDefined();
    expect(typeof report.pathCheck.inPath).toBe("boolean");
    expect(typeof report.pathCheck.userShell).toBe("string");

    // All checks passed flag
    expect(typeof report.allChecksPassed).toBe("boolean");
  });

  it("handles non-git project roots cleanly", async () => {
    const report = await DoctorService.generateReport(tempDir);
    expect(report.projectRoot).toBe(tempDir);
    expect(report.isGitRepo).toBe(false);
  });
});
