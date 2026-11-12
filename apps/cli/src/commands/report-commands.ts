/**
 * @terrarium/cli - commands/report-commands.ts
 *
 * Command line handlers for Reports, Evidence, and Customer Simulation:
 * List, view, preview, generate, export, and simulate customer feedback.
 * Contributed by A4 (CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns strictly with PLAN.md Section 8 & 15, and PROMPT 18.
 */

import {
  type Report,
  type ReportQueryOptions,
  type ReportType,
  type Result,
  type TerrariumError,
  ok,
  fail,
  NotFoundError,
  SIMULATED_RESEARCH_DISCLAIMER,
} from "@terrarium/contracts";
import type { ReportService } from "@terrarium/core";

export interface ReportCommandOptions {
  readonly json?: boolean;
  readonly useColor?: boolean;
  readonly taskId?: string;
  readonly type?: ReportType;
  readonly format?: "md" | "json";
  readonly output?: string;
  readonly markdown?: boolean;
  readonly concept?: string;
  readonly scenario?: string;
  readonly title?: string;
}

/**
 * Handles listing reports with type, confidence, and simulation indicators.
 */
export async function handleReportList(
  reportService: ReportService,
  options: ReportCommandOptions = {}
): Promise<Result<{ output: string; reports: readonly Report[] }, TerrariumError>> {
  try {
    const queryOptions: ReportQueryOptions = {
      taskId: options.taskId,
      reportType: options.type,
    };

    const listRes = await reportService.listReports(queryOptions);
    if (!listRes.success) {
      return fail(listRes.error);
    }

    const reports = listRes.data;

    if (options.json) {
      return ok({
        output: JSON.stringify(reports, null, 2),
        reports,
      });
    }

    const useColor = options.useColor ?? true;
    const bold = useColor ? "\x1b[1m" : "";
    const reset = useColor ? "\x1b[0m" : "";
    const cyan = useColor ? "\x1b[36m" : "";
    const green = useColor ? "\x1b[32m" : "";
    const yellow = useColor ? "\x1b[33m" : "";
    const magenta = useColor ? "\x1b[35m" : "";
    const gray = useColor ? "\x1b[90m" : "";

    const lines: string[] = [
      `${bold}${cyan}=== Terrarium Reports & Intelligence ===${reset}`,
      `${gray}Total Reports:${reset} ${reports.length}`,
      "",
    ];

    if (reports.length === 0) {
      lines.push(`${gray}No reports found. Generate one with 'terrarium report generate --task <id>'.${reset}`);
    } else {
      lines.push(`${bold}ID               TYPE                  CONF  SIM  TITLE${reset}`);
      lines.push(`${gray}--------------------------------------------------------------------------------${reset}`);

      for (const rep of reports) {
        const idCol = rep.id.padEnd(16).slice(0, 16);
        const typeCol = rep.reportType.padEnd(21).slice(0, 21);
        const confColor = rep.confidence === "high" ? green : rep.confidence === "medium" ? yellow : magenta;
        const confCol = `${confColor}${rep.confidence.toUpperCase().padEnd(5).slice(0, 5)}${reset}`;
        const simCol = rep.hasSimulatedData ? `${yellow}[SIM]${reset}` : `${gray} —  ${reset}`;
        const titleCol = rep.title.slice(0, 36);

        lines.push(`${idCol} ${typeCol} ${confCol} ${simCol} ${titleCol}`);
      }
    }

    return ok({
      output: lines.join("\n"),
      reports,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(new NotFoundError("ReportService", msg));
  }
}

/**
 * Handles viewing or previewing a specific report.
 */
export async function handleReportView(
  reportService: ReportService,
  reportId: string,
  options: ReportCommandOptions = {}
): Promise<Result<{ output: string; report: Report }, TerrariumError>> {
  try {
    const reportRes = await reportService.getReport(reportId);
    if (!reportRes.success) {
      return fail(reportRes.error);
    }

    const report = reportRes.data;

    if (options.json) {
      return ok({
        output: JSON.stringify(report, null, 2),
        report,
      });
    }

    if (options.markdown) {
      return ok({
        output: report.markdownContent,
        report,
      });
    }

    const useColor = options.useColor ?? true;
    const bold = useColor ? "\x1b[1m" : "";
    const reset = useColor ? "\x1b[0m" : "";
    const cyan = useColor ? "\x1b[36m" : "";
    const green = useColor ? "\x1b[32m" : "";
    const yellow = useColor ? "\x1b[33m" : "";
    const gray = useColor ? "\x1b[90m" : "";

    const lines: string[] = [
      `${bold}${cyan}=== Report: ${report.title} ===${reset}`,
      `${bold}ID:${reset} ${report.id} | ${bold}Type:${reset} ${report.reportType} | ${bold}Task:${reset} ${report.taskId}`,
      `${bold}Confidence:${reset} ${report.confidence.toUpperCase()} | ${bold}Status:${reset} ${report.status}`,
      `${bold}Date:${reset} ${report.createdAt}`,
    ];

    if (report.hasSimulatedData) {
      lines.push("");
      lines.push(`${bold}${yellow}[SIMULATION NOTICE]:${reset}`);
      lines.push(`${yellow}${SIMULATED_RESEARCH_DISCLAIMER}${reset}`);
    }

    lines.push("");
    lines.push(`${bold}Objective:${reset}`);
    lines.push(`  ${report.objective}`);
    lines.push("");
    lines.push(`${bold}Summary:${reset}`);
    lines.push(`  ${report.summary}`);
    lines.push("");

    lines.push(`${bold}Evidence Matrix (${report.evidence.length} items):${reset}`);
    for (const item of report.evidence.slice(0, 6)) {
      const isFact = item.claimType === "verified_fact";
      const tag = isFact ? `${green}[FACT]${reset}` : item.claimType === "simulated_feedback" ? `${yellow}[SIM]${reset}` : `${cyan}[ANALYSIS]${reset}`;
      lines.push(`  ${tag} ${item.claim}`);
    }
    if (report.evidence.length > 6) {
      lines.push(`  ${gray}... and ${report.evidence.length - 6} more evidence items${reset}`);
    }

    if (report.disagreements.length > 0) {
      lines.push("");
      lines.push(`${bold}Preserved Disagreements (${report.disagreements.length}):${reset}`);
      for (const d of report.disagreements) {
        lines.push(`  • ${bold}${d.topic}${reset} (${d.resolutionStatus})`);
        lines.push(`    ${gray}${d.summary}${reset}`);
      }
    }

    if (report.recommendations.length > 0) {
      lines.push("");
      lines.push(`${bold}Prioritized Recommendations (${report.recommendations.length}):${reset}`);
      for (const r of report.recommendations) {
        const pColor = r.priority === "P0" ? "\x1b[31m" : r.priority === "P1" ? yellow : cyan;
        lines.push(`  • ${bold}${pColor}[${r.priority}]${reset} ${bold}${r.title}${reset}`);
        lines.push(`    ${r.description}`);
      }
    }

    lines.push("");
    lines.push(`${gray}Use --markdown flag to output complete raw Markdown content.${reset}`);

    return ok({
      output: lines.join("\n"),
      report,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(new NotFoundError("Report", msg));
  }
}

/**
 * Handles exporting a report to a file within the workspace boundary.
 */
export async function handleReportExport(
  reportService: ReportService,
  reportId: string,
  options: ReportCommandOptions = {}
): Promise<Result<{ output: string; exportedPath: string }, TerrariumError>> {
  try {
    const targetPath = options.output || `reports/${reportId}.${options.format || "md"}`;
    const expRes = await reportService.exportReport(reportId, {
      outputFilePath: targetPath,
      format: options.format,
    });

    if (!expRes.success) {
      return fail(expRes.error);
    }

    const exportedPath = expRes.data.exportedPath;

    if (options.json) {
      return ok({
        output: JSON.stringify({ reportId, exportedPath }, null, 2),
        exportedPath,
      });
    }

    return ok({
      output: `Successfully exported report '${reportId}' to: ${exportedPath}`,
      exportedPath,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(new NotFoundError("Report", msg));
  }
}

/**
 * Handles generating a report from a task.
 */
export async function handleReportGenerate(
  reportService: ReportService,
  options: ReportCommandOptions
): Promise<Result<{ output: string; report: Report }, TerrariumError>> {
  if (!options.taskId) {
    return fail(new NotFoundError("Task", "taskId is required to generate a report"));
  }

  const title = options.title || `Task Execution Report: ${options.taskId}`;
  const genRes = await reportService.generateReport({
    taskId: options.taskId,
    title,
    reportType: options.type || "architecture_review",
    exportPath: options.output,
  });

  if (!genRes.success) {
    return fail(genRes.error);
  }

  const report = genRes.data;

  if (options.json) {
    return ok({
      output: JSON.stringify(report, null, 2),
      report,
    });
  }

  return ok({
    output: `Generated report '${report.id}': "${report.title}" with ${report.evidence.length} evidence items and ${report.sources.length} sources.`,
    report,
  });
}

/**
 * Handles running simulated customer research.
 */
export async function handleReportSimulateCustomer(
  reportService: ReportService,
  options: ReportCommandOptions
): Promise<Result<{ output: string; report: Report }, TerrariumError>> {
  if (!options.concept) {
    return fail(new NotFoundError("Concept", "--concept is required for customer simulation"));
  }

  const simRes = await reportService.simulateCustomerResearch({
    concept: options.concept,
    scenario: options.scenario,
    title: options.title,
    exportPath: options.output,
  });

  if (!simRes.success) {
    return fail(simRes.error);
  }

  const report = simRes.data;

  if (options.json) {
    return ok({
      output: JSON.stringify(report, null, 2),
      report,
    });
  }

  const useColor = options.useColor ?? true;
  const bold = useColor ? "\x1b[1m" : "";
  const reset = useColor ? "\x1b[0m" : "";
  const yellow = useColor ? "\x1b[33m" : "";

  const lines: string[] = [
    `${bold}Customer Simulation Completed:${reset} ${report.title}`,
    `${bold}Report ID:${reset} ${report.id}`,
    "",
    `${bold}${yellow}[SIMULATION NOTICE]:${reset}`,
    `${yellow}${SIMULATED_RESEARCH_DISCLAIMER}${reset}`,
    "",
    `${bold}Summary:${reset} ${report.summary}`,
    `${bold}Disagreements Preserved:${reset} ${report.disagreements.length}`,
    `${bold}Recommendations:${reset} ${report.recommendations.length}`,
  ];

  return ok({
    output: lines.join("\n"),
    report,
  });
}
