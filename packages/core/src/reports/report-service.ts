/**
 * @terrarium/core - reports/report-service.ts
 *
 * Primary coordinator service for report generation, evidence aggregation,
 * simulated customer research, provenance verification, and safe workspace export.
 * Aligns strictly with PLAN.md Section 8 & 15 and PROMPT 18.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import {
  type Report,
  type ReportQueryOptions,
  type ReportRepository,
  type TaskRepository,
  type Result,
  type TerrariumError,
  ok,
  fail,
  NotFoundError,
  DomainValidationError,
  validateReport,
} from "@terrarium/contracts";
import { ArtifactAggregator, type AggregateArtifactsOptions } from "./artifact-aggregator.ts";
import { CustomerSimulator, type RunCustomerSimulationOptions } from "./customer-simulator.ts";
import { MarkdownGenerator } from "./markdown-generator.ts";
import { ProvenanceValidator } from "./provenance-validator.ts";
import { ReportSanitizer } from "./report-sanitizer.ts";

export interface ReportServiceOptions {
  readonly repository?: ReportRepository;
  readonly taskRepository?: TaskRepository;
  readonly workspaceRoot?: string;
}

export interface GenerateReportInput extends AggregateArtifactsOptions {
  readonly id?: string;
  readonly exportPath?: string;
}

export interface SimulateCustomerResearchInput extends RunCustomerSimulationOptions {
  readonly taskId?: string;
  readonly title?: string;
  readonly exportPath?: string;
}

export interface ExportReportOptions {
  readonly outputFilePath: string;
  readonly format?: "md" | "json";
  readonly overwrite?: boolean;
}

export class ReportService {
  private readonly repository?: ReportRepository;
  private readonly taskRepository?: TaskRepository;
  private readonly workspaceRoot: string;

  constructor(options: ReportServiceOptions = {}) {
    this.repository = options.repository;
    this.taskRepository = options.taskRepository;
    this.workspaceRoot = options.workspaceRoot ? resolve(options.workspaceRoot) : process.cwd();
  }

  /**
   * Generates a fully structured Report from artifacts, validated against provenance rules.
   */
  async generateReport(input: GenerateReportInput): Promise<Result<Report, TerrariumError>> {
    const reportId = input.id || `rep_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const now = new Date().toISOString();

    // 1. Aggregate deliverables and artifacts into structured report core
    const partialReport = ArtifactAggregator.aggregate(input);

    // 2. Initial assembly to generate standard Markdown content
    let report: Report = {
      ...partialReport,
      id: reportId,
      markdownContent: "",
      createdAt: now,
      updatedAt: now,
    };

    const rawMarkdown = MarkdownGenerator.generate(report);
    const sanitizedMd = ReportSanitizer.sanitize(rawMarkdown).sanitizedText;

    report = {
      ...report,
      markdownContent: sanitizedMd,
    };

    // 3. Domain validation
    const domainRes = validateReport(report);
    if (!domainRes.success) {
      return fail(domainRes.error);
    }

    // 4. Provenance & integrity validation
    const provRes = ProvenanceValidator.validate(report);
    if (!provRes.success) {
      const errorMsg = provRes.error.issues
        .filter((i) => i.severity === "error")
        .map((i) => `[${i.code}] ${i.message}`)
        .join("; ");
      return fail(
        new DomainValidationError(`Report provenance validation failed: ${errorMsg}`, [
          { path: "evidence", message: errorMsg },
        ])
      );
    }

    // 5. Persist to repository if available
    if (this.repository) {
      const saveRes = await this.repository.create(report);
      if (!saveRes.success) {
        return fail(saveRes.error);
      }
    }

    // 6. Optional workspace file export
    if (input.exportPath) {
      const expRes = await this.exportToFile(report, input.exportPath, "md");
      if (!expRes.success) {
        return fail(expRes.error);
      }
    }

    return ok(report);
  }

  /**
   * Runs customer persona simulation and creates a customer simulation report.
   */
  async simulateCustomerResearch(
    input: SimulateCustomerResearchInput
  ): Promise<Result<Report, TerrariumError>> {
    const reportId = `rep_sim_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const taskId = input.taskId || `task_sim_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const title = input.title || `Simulated Customer Research: ${input.concept.slice(0, 50)}`;
    const now = new Date().toISOString();

    // 1. Ensure parent task exists if taskRepository is available
    if (this.taskRepository) {
      const existingTask = await this.taskRepository.findById(taskId);
      if (!existingTask.success || !existingTask.data) {
        await this.taskRepository.create({
          id: taskId,
          title: `Customer Simulation: ${input.concept.slice(0, 50)}`,
          description: `Synthetic customer simulation for concept: ${input.concept}`,
          department: "customer_intelligence",
          assignedAgentId: "agent_cust_intel",
          status: "completed",
          priority: "medium",
          contextRefs: [],
          expectedDeliverables: [],
          delegationDepth: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 2. Run simulation engine across personas
    const simResult = CustomerSimulator.runSimulation({
      concept: input.concept,
      scenario: input.scenario,
      targetPersonas: input.targetPersonas,
      pricingHypothesis: input.pricingHypothesis,
    });

    // 2. Aggregate into structured Report
    const partialReport = ArtifactAggregator.aggregate({
      taskId,
      title,
      reportType: "customer_simulation",
      objective: `Evaluate market reception, usability concerns, pricing sensitivity, and adoption barriers for concept: "${input.concept}"`,
      summary: simResult.summary,
      method:
        "Synthetic customer simulation across diverse archetypes with constraint-driven behavioral modeling. Results are synthetic hypotheses, not empirical survey data.",
      simulationMetadata: simResult.metadata,
      extraEvidence: simResult.evidence,
      extraDisagreements: simResult.disagreements,
      extraRecommendations: simResult.recommendations,
      assumptions: simResult.metadata.assumptions,
      limitations: [
        "Results reflect synthetic persona heuristics and MUST be validated with real-world customer interviews.",
        "No empirical statistical significance or market conversion rates are claimed.",
      ],
      agentsInvolved: ["CustomerIntelligenceAgent", "ProductStrategistAgent"],
    });

    let report: Report = {
      ...partialReport,
      id: reportId,
      hasSimulatedData: true,
      markdownContent: "",
      createdAt: now,
      updatedAt: now,
    };

    const rawMarkdown = MarkdownGenerator.generate(report);
    const sanitizedMd = ReportSanitizer.sanitize(rawMarkdown).sanitizedText;

    report = {
      ...report,
      markdownContent: sanitizedMd,
    };

    // 3. Domain validation
    const domainRes = validateReport(report);
    if (!domainRes.success) {
      return fail(domainRes.error);
    }

    // 4. Provenance validation
    const provRes = ProvenanceValidator.validate(report);
    if (!provRes.success) {
      const errorMsg = provRes.error.issues
        .filter((i) => i.severity === "error")
        .map((i) => `[${i.code}] ${i.message}`)
        .join("; ");
      return fail(
        new DomainValidationError(`Customer simulation provenance validation failed: ${errorMsg}`, [
          { path: "evidence", message: errorMsg },
        ])
      );
    }

    // 5. Persist to repository
    if (this.repository) {
      const saveRes = await this.repository.create(report);
      if (!saveRes.success) {
        return fail(saveRes.error);
      }
    }

    // 6. Optional workspace export
    if (input.exportPath) {
      const expRes = await this.exportToFile(report, input.exportPath, "md");
      if (!expRes.success) {
        return fail(expRes.error);
      }
    }

    return ok(report);
  }

  /**
   * Retrieves a report by ID.
   */
  async getReport(id: string): Promise<Result<Report, TerrariumError>> {
    if (!this.repository) {
      return fail(new NotFoundError("ReportRepository", "not_configured"));
    }
    const res = await this.repository.findById(id);
    if (!res.success) {
      return fail(res.error);
    }
    if (!res.data) {
      return fail(new NotFoundError("Report", id));
    }
    return ok(res.data);
  }

  /**
   * Lists reports matching query options.
   */
  async listReports(options: ReportQueryOptions = {}): Promise<Result<readonly Report[], TerrariumError>> {
    if (!this.repository) {
      return ok([]);
    }
    return this.repository.list(options);
  }

  /**
   * Safely exports an existing report to disk within the workspace boundary.
   */
  async exportReport(id: string, options: ExportReportOptions): Promise<Result<{ exportedPath: string }, TerrariumError>> {
    const reportRes = await this.getReport(id);
    if (!reportRes.success) {
      return fail(reportRes.error);
    }

    const format = options.format || (options.outputFilePath.endsWith(".json") ? "json" : "md");
    const writeRes = await this.exportToFile(reportRes.data, options.outputFilePath, format);
    if (!writeRes.success) {
      return fail(writeRes.error);
    }

    return ok({ exportedPath: writeRes.data });
  }

  /**
   * Deletes a report by ID.
   */
  async deleteReport(id: string): Promise<Result<boolean, TerrariumError>> {
    if (!this.repository) {
      return fail(new NotFoundError("ReportRepository", "not_configured"));
    }
    return this.repository.delete(id);
  }

  /**
   * Safe file export with workspace sandbox path containment checks.
   */
  private async exportToFile(
    report: Report,
    relativeOrAbsolutePath: string,
    format: "md" | "json"
  ): Promise<Result<string, TerrariumError>> {
    const resolvedPath = isAbsolute(relativeOrAbsolutePath)
      ? resolve(relativeOrAbsolutePath)
      : resolve(this.workspaceRoot, relativeOrAbsolutePath);

    // Sandbox boundary containment check: prevent path traversal attacks outside workspace
    const rel = relative(this.workspaceRoot, resolvedPath);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      return fail(
        new DomainValidationError(
          `Security violation: Report export path '${resolvedPath}' escapes workspace root '${this.workspaceRoot}'.`,
          [{ path: "outputFilePath", message: "Path escapes workspace sandbox" }]
        )
      );
    }

    const content = format === "json" ? JSON.stringify(report, null, 2) : report.markdownContent;

    try {
      await mkdir(dirname(resolvedPath), { recursive: true });
      await writeFile(resolvedPath, content, "utf8");
      return ok(resolvedPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(new DomainValidationError(`Failed to write export file: ${msg}`, []));
    }
  }
}

export function createReportService(options: ReportServiceOptions = {}): ReportService {
  return new ReportService(options);
}
