/**
 * @terrarium/core - tests/report-service.test.ts
 *
 * Integration test suite for ReportService:
 * Artifact aggregation, Markdown generation, customer simulation, SQLite persistence,
 * and secure workspace export with path traversal boundaries.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSqliteDatabase, SqliteDatabase } from "../src/persistence/index.ts";
import { createReportService, ReportService } from "../src/reports/report-service.ts";
import {
  type BoundedTestRunResult,
  type CodeAnalysisSummary,
  type CodeFilePatch,
  type MemoryItem,
  SIMULATED_RESEARCH_DISCLAIMER,
} from "@terrarium/contracts";

describe("ReportService & End-to-End Synthesis Suite (A1 & A2)", () => {
  let tempDir: string;
  let db: SqliteDatabase;
  let service: ReportService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "terrarium-report-test-"));
    const dbPath = join(tempDir, "test-reports.db");
    db = createSqliteDatabase(dbPath);
    service = createReportService({
      repository: db.reports,
      workspaceRoot: tempDir,
    });
  });

  afterEach(async () => {
    try {
      db.close();
      await rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("generates and persists a structured report from multi-source artifacts", async () => {
    // 1. Create a parent task in database first to satisfy foreign key constraint
    const taskRes = await db.tasks.create({
      id: "task_orch_999",
      title: "Core Architecture Refactor",
      description: "Refactor core subsystems to least privilege",
      department: "engineering",
      assignedAgentId: "agent_arch_lead",
      status: "completed",
      priority: "high",
      contextRefs: [],
      expectedDeliverables: [],
      delegationDepth: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(taskRes.success).toBe(true);

    const testRun: BoundedTestRunResult = {
      id: "run_test_01",
      command: "bun test core",
      passed: true,
      exitCode: 0,
      totalTests: 50,
      passedTests: 50,
      failedTests: 0,
      durationMs: 320,
      stdout: "50 pass, 0 fail",
      stderr: "",
      executedAt: new Date().toISOString(),
    };

    const patch: CodeFilePatch = {
      id: "patch_01",
      filePath: "src/auth.ts",
      changeType: "modify",
      proposedContent: "export const auth = true;",
      proposedHash: "sha256_mock_hash",
      diffUnified: "@@ -1,1 +1,1 @@\n-old\n+new",
      hunks: [],
      rationale: "Least-privilege permission validation",
      status: "applied",
      requiresApproval: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const analysis: CodeAnalysisSummary = {
      repoPath: tempDir,
      isClean: true,
      languages: [
        { name: "TypeScript", percentage: 90, filesCount: 45 },
        { name: "Markdown", percentage: 10, filesCount: 5 },
      ],
      frameworks: ["Bun"],
      entryPoints: ["src/index.ts"],
      dependencies: [],
      testFrameworks: ["bun:test"],
      sensitiveFiles: [{ path: ".env", reason: "Credential file", isProtected: true }],
      analyzedAt: new Date().toISOString(),
    };

    const reportRes = await service.generateReport({
      taskId: "task_orch_999",
      title: "Platform Refactoring Verification Report",
      objective: "Verify tests, code patches, and security shield status.",
      testRuns: [testRun],
      codePatches: [patch],
      codeAnalysis: analysis,
      agentsInvolved: ["A1_platform", "A3_security"],
    });

    expect(reportRes.success).toBe(true);
    if (reportRes.success) {
      const report = reportRes.data;
      expect(report.title).toBe("Platform Refactoring Verification Report");
      expect(report.evidence.length).toBeGreaterThanOrEqual(3);
      expect(report.sources.length).toBeGreaterThanOrEqual(3);
      expect(report.hasSimulatedData).toBe(false);
      expect(report.markdownContent.includes("# Platform Refactoring Verification Report")).toBe(true);
      expect(report.markdownContent.includes("Evidence Matrix")).toBe(true);
      expect(report.markdownContent.includes("Sources & Provenance Trail")).toBe(true);

      // Verify persistence in SQLite repository
      const findRes = await service.getReport(report.id);
      expect(findRes.success).toBe(true);
      if (findRes.success) {
        expect(findRes.data.id).toBe(report.id);
        expect(findRes.data.evidence.length).toBe(report.evidence.length);
      }
    }
  });

  it("generates customer simulation report with simulation banners and disclaimers", async () => {
    // Satisfy task foreign key by creating parent task
    await db.tasks.create({
      id: "task_cust_sim",
      title: "Customer Simulation Task",
      description: "Synthetic market validation",
      department: "customer_intelligence",
      assignedAgentId: "agent_cust_intel",
      status: "completed",
      priority: "medium",
      contextRefs: [],
      expectedDeliverables: [],
      delegationDepth: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const reportRes = await service.simulateCustomerResearch({
      taskId: "task_cust_sim",
      concept: "Automated AI Code Review with Least Privilege Sandboxing",
      scenario: "Security teams evaluating automated code improvements",
    });

    expect(reportRes.success).toBe(true);
    if (reportRes.success) {
      const report = reportRes.data;
      expect(report.reportType).toBe("customer_simulation");
      expect(report.hasSimulatedData).toBe(true);
      expect(report.simulationMetadata).toBeDefined();
      expect(report.simulationMetadata?.personas.length).toBeGreaterThanOrEqual(3);
      expect(report.markdownContent.includes(SIMULATED_RESEARCH_DISCLAIMER)).toBe(true);
      expect(report.markdownContent.includes("SIMULATION INTEGRITY NOTICE")).toBe(true);
      expect(report.disagreements.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    }
  });

  it("exports report to workspace file and rejects path traversal escape attempts", async () => {
    await db.tasks.create({
      id: "task_exp_01",
      title: "Export Testing Task",
      description: "Verify safe workspace exports",
      department: "engineering",
      assignedAgentId: "agent_arch",
      status: "completed",
      priority: "low",
      contextRefs: [],
      expectedDeliverables: [],
      delegationDepth: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const createRes = await service.generateReport({
      taskId: "task_exp_01",
      title: "Exportable Audit Report",
      summary: "Audit report ready for git check-in.",
    });

    expect(createRes.success).toBe(true);
    if (!createRes.success) throw new Error("Create failed");
    const reportId = createRes.data.id;

    // 1. Safe export within workspace
    const safeExportRes = await service.exportReport(reportId, {
      outputFilePath: "reports/audit-report.md",
    });
    expect(safeExportRes.success).toBe(true);
    if (safeExportRes.success) {
      const exportedFileContent = await readFile(safeExportRes.data.exportedPath, "utf8");
      expect(exportedFileContent.includes("# Exportable Audit Report")).toBe(true);
    }

    // 2. Path traversal attack attempt: escaping workspace root with ../../
    const traversalRes = await service.exportReport(reportId, {
      outputFilePath: "../../escaped-report.md",
    });
    expect(traversalRes.success).toBe(false);
    if (!traversalRes.success) {
      expect(traversalRes.error.message.includes("Security violation")).toBe(true);
    }
  });

  it("queries reports by type and simulation flag", async () => {
    await db.tasks.create({
      id: "task_query_test",
      title: "Query Task",
      description: "Query tests",
      department: "engineering",
      assignedAgentId: "agent_arch",
      status: "completed",
      priority: "low",
      contextRefs: [],
      expectedDeliverables: [],
      delegationDepth: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await service.generateReport({
      taskId: "task_query_test",
      title: "Arch Review 1",
      reportType: "architecture_review",
    });

    await service.simulateCustomerResearch({
      taskId: "task_query_test",
      concept: "Concept A",
    });

    const allReports = await service.listReports();
    expect(allReports.success).toBe(true);
    if (allReports.success) {
      expect(allReports.data.length).toBe(2);
    }

    const simReports = await service.listReports({ hasSimulatedData: true });
    expect(simReports.success).toBe(true);
    if (simReports.success) {
      expect(simReports.data.length).toBe(1);
      expect(simReports.data[0]!.hasSimulatedData).toBe(true);
    }

    const archReports = await service.listReports({ reportType: "architecture_review" });
    expect(archReports.success).toBe(true);
    if (archReports.success) {
      expect(archReports.data.length).toBe(1);
      expect(archReports.data[0]!.reportType).toBe("architecture_review");
    }
  });
});
