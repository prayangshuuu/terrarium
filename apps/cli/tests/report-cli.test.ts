/**
 * @terrarium/cli - tests/report-cli.test.ts
 *
 * Test suite for Report CLI command handlers:
 * handleReportList, handleReportView, handleReportExport, handleReportGenerate, handleReportSimulateCustomer.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSqliteDatabase, SqliteDatabase, createReportService, ReportService } from "@terrarium/core";
import {
  handleReportList,
  handleReportView,
  handleReportExport,
  handleReportGenerate,
  handleReportSimulateCustomer,
} from "../src/commands/report-commands.ts";

describe("CLI Report Commands Suite (A4 & A5)", () => {
  let tempDir: string;
  let db: SqliteDatabase;
  let reportService: ReportService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "terrarium-cli-report-"));
    const dbPath = join(tempDir, "test-reports.db");
    db = createSqliteDatabase(dbPath);
    reportService = createReportService({
      repository: db.reports,
      taskRepository: db.tasks,
      workspaceRoot: tempDir,
    });

    // Seed a task to satisfy foreign keys
    await db.tasks.create({
      id: "task_cli_01",
      title: "CLI Report Task",
      description: "Testing CLI report generation",
      department: "engineering",
      assignedAgentId: "agent_arch",
      status: "completed",
      priority: "high",
      contextRefs: [],
      expectedDeliverables: [],
      delegationDepth: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(async () => {
    try {
      db.close();
      await rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("lists reports in formatted terminal table and JSON mode", async () => {
    // Generate a report first
    await reportService.generateReport({
      taskId: "task_cli_01",
      title: "Architecture Review v1",
      reportType: "architecture_review",
    });

    // 1. Text mode
    const listRes = await handleReportList(reportService, { useColor: false });
    expect(listRes.success).toBe(true);
    if (listRes.success) {
      expect(listRes.data.reports.length).toBe(1);
      expect(listRes.data.output.includes("Architecture Review v1")).toBe(true);
      expect(listRes.data.output.includes("Total Reports: 1")).toBe(true);
    }

    // 2. JSON mode
    const jsonRes = await handleReportList(reportService, { json: true });
    expect(jsonRes.success).toBe(true);
    if (jsonRes.success) {
      const parsed = JSON.parse(jsonRes.data.output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
    }
  });

  it("views a report with formatted summary or raw markdown", async () => {
    const genRes = await reportService.generateReport({
      taskId: "task_cli_01",
      title: "Security Findings Report",
      summary: "Identified zero open vulnerabilities.",
    });
    expect(genRes.success).toBe(true);
    if (!genRes.success) throw new Error("Failed to generate report");
    const reportId = genRes.data.id;

    // Formatted view
    const viewRes = await handleReportView(reportService, reportId, { useColor: false });
    expect(viewRes.success).toBe(true);
    if (viewRes.success) {
      expect(viewRes.data.output.includes("Security Findings Report")).toBe(true);
      expect(viewRes.data.output.includes("Summary:")).toBe(true);
    }

    // Raw markdown view
    const mdRes = await handleReportView(reportService, reportId, { markdown: true });
    expect(mdRes.success).toBe(true);
    if (mdRes.success) {
      expect(mdRes.data.output.startsWith("# Security Findings Report")).toBe(true);
    }
  });

  it("exports a report to disk within workspace root", async () => {
    const genRes = await reportService.generateReport({
      taskId: "task_cli_01",
      title: "Export Test Report",
    });
    expect(genRes.success).toBe(true);
    if (!genRes.success) throw new Error("Failed to generate report");
    const reportId = genRes.data.id;

    const expRes = await handleReportExport(reportService, reportId, {
      output: "reports/my-report.md",
    });
    expect(expRes.success).toBe(true);
    if (expRes.success) {
      expect(expRes.data.output.includes("Successfully exported")).toBe(true);
    }
  });

  it("executes customer simulation CLI command with simulation notice banner", async () => {
    const simRes = await handleReportSimulateCustomer(reportService, {
      concept: "Multi-Agent OpenTUI Developer Workstation",
      scenario: "Fullstack engineering productivity evaluation",
      useColor: false,
    });

    expect(simRes.success).toBe(true);
    if (simRes.success) {
      expect(simRes.data.report.hasSimulatedData).toBe(true);
      expect(simRes.data.output.includes("Customer Simulation Completed")).toBe(true);
      expect(simRes.data.output.includes("SIMULATION NOTICE")).toBe(true);
    }
  });
});
