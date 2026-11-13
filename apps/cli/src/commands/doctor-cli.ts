/**
 * apps/cli/src/commands/doctor-cli.ts
 *
 * Diagnostic health check CLI for TERRARIUM (Prompt 26).
 * Inspects Bun runtime, project context, database integrity, provider CLI tools,
 * and system PATH configuration.
 *
 * Contributed by A1 (Platform & Architecture) & A4 (Senior CLI/TUI Designer).
 * Zero emoji terminal typography.
 */

import { DoctorService } from "@terrarium/core";
import { type DoctorReport } from "@terrarium/contracts";

export async function handleDoctorCommand(args: readonly string[] = []): Promise<number> {
  const asJson = args.includes("--json");
  const projectOverride = extractWorkspaceFlag(args);

  const report = await DoctorService.generateReport(projectOverride ?? process.cwd());

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return report.allChecksPassed ? 0 : 1;
  }

  printDoctorBanner();
  printSystemSection(report);
  printProjectSection(report);
  printDatabaseSection(report);
  printProvidersSection(report);
  printPathSection(report);
  printSummarySection(report);

  return report.allChecksPassed ? 0 : 1;
}

function extractWorkspaceFlag(args: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--workspace" || args[i] === "-w") {
      return args[i + 1];
    }
  }
  return undefined;
}

function printDoctorBanner(): void {
  console.log(`
TERRARIUM SYSTEM HEALTH DIAGNOSTICS
================================================================================`);
}

function printSystemSection(report: DoctorReport): void {
  console.log(`\n[RUNTIME ENVIRONMENT]`);
  console.log(`  Terrarium CLI:  v${report.terrariumVersion}`);
  console.log(`  Bun Runtime:    v${report.bunVersion}`);
  console.log(`  Platform:       ${report.platform} (${report.architecture})`);
  console.log(`  Binary Path:    ${report.executablePath}`);
  console.log(`  Timestamp:      ${report.timestamp}`);
}

function printProjectSection(report: DoctorReport): void {
  console.log(`\n[PROJECT CONTEXT]`);
  const statusTag = report.isGitRepo ? "[OK]  " : "[INFO]";
  console.log(`  ${statusTag} Project Root:     ${report.projectRoot}`);
  console.log(`         Git Repository:   ${report.isGitRepo ? "Yes" : "No (.git root not detected)"}`);
}

function printDatabaseSection(report: DoctorReport): void {
  console.log(`\n[DATA STORAGE & CACHE]`);
  const dbHealth = report.databaseHealth;
  const statusTag = dbHealth.status === "ok" ? "[OK]  " : "[FAIL]";
  console.log(`  ${statusTag} SQLite Database:  ${dbHealth.path}`);
  console.log(`         Health Status:    ${dbHealth.status.toUpperCase()}${dbHealth.error ? ` (${dbHealth.error})` : ""}`);
  console.log(`         Config Directory: ${report.configDir}`);
  console.log(`         Data Directory:   ${report.dataDir}`);
}

function printProvidersSection(report: DoctorReport): void {
  console.log(`\n[PROVIDER & CODING AGENT ADAPTERS]`);
  console.log(`  Provider         Status     Version             Executable Path`);
  console.log(`  ─────────────────────────────────────────────────────────────────────────────`);

  for (const p of report.providers) {
    const statusText = p.installed ? "[OK]  " : "[WARN]";
    const namePadded = p.name.padEnd(16, " ");
    const verPadded = (p.version ?? "not installed").padEnd(19, " ");
    const pathText = p.executablePath ?? (p.error ?? "not found in PATH");
    console.log(`  ${namePadded} ${statusText}   ${verPadded} ${pathText}`);
  }
}

function printPathSection(report: DoctorReport): void {
  console.log(`\n[SYSTEM PATH ANALYSIS]`);
  const path = report.pathCheck;
  const statusTag = path.inPath ? "[OK]  " : "[WARN]";
  console.log(`  ${statusTag} Executable in PATH:  ${path.inPath ? "Yes" : "No"}`);
  console.log(`         Shell:              ${path.userShell}`);
  if (path.resolvedPath) {
    console.log(`         Resolved Path:      ${path.resolvedPath}`);
  }
  if (path.issues.length > 0) {
    for (const issue of path.issues) {
      console.log(`  [WARN] ${issue}`);
    }
  }
  if (path.recommendedPathExport) {
    console.log(`  [TIP] Recommended export: ${path.recommendedPathExport}`);
  }
}

function printSummarySection(report: DoctorReport): void {
  console.log(`\n================================================================================`);
  const ready = report.providers.filter((p) => p.installed).length;
  const total = report.providers.length;
  console.log(`DIAGNOSTIC SUMMARY: ${ready}/${total} external coding providers detected.`);

  if (report.allChecksPassed) {
    console.log(`\nResult: ALL CORE CHECKS PASSED. Terrarium is ready for execution.`);
  } else {
    console.log(`\nResult: OPERATIONAL WITH ADVISORIES. You can run Terrarium, but some providers require setup.`);
  }
  console.log(`================================================================================\n`);
}
