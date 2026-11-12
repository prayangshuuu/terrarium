import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Documentation and Owner Onboarding Integrity", () => {
  const projectRoot = path.resolve(__dirname, "../../..");
  const docsDir = path.join(projectRoot, "docs");
  const guidesDir = path.join(docsDir, "guides");

  const requiredGuideFiles = [
    "AGENT_REGISTRY_AND_CAPABILITIES.md",
    "ARCHITECTURE_AND_SUBSYSTEMS.md",
    "BUDGET_AND_MODEL_ROUTING.md",
    "CONFIGURATION_AND_SECRETS.md",
    "DEMAND_BASED_SELECTION_AND_ORCHESTRATION.md",
    "ENGINEERING_STUDIO.md",
    "OBSERVABILITY_AND_EVENTS.md",
    "OPENTUI_SHELL_AND_NAVIGATION.md",
    "OPERATIONS_AND_MAINTENANCE.md",
    "OWNER_ONBOARDING.md",
    "PERSISTENCE_AND_MIGRATIONS.md",
    "PROJECT_MEMORY_AND_CONTEXT.md",
    "PROVIDER_ADAPTER_LAYER.md",
    "REPORTS_AND_CUSTOMER_RESEARCH.md",
    "TASK_INTAKE_AND_PLANNING.md",
    "TOOL_REGISTRY_AND_APPROVALS.md",
  ];

  it("should have all required architectural and operational guides in docs/guides", () => {
    for (const file of requiredGuideFiles) {
      const filePath = path.join(guidesDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(100);
    }
  });

  it("should have root README.md and docs/INTEGRATIONS.md with non-trivial content", () => {
    const readmePath = path.join(projectRoot, "README.md");
    expect(fs.existsSync(readmePath)).toBe(true);
    const readmeContent = fs.readFileSync(readmePath, "utf8");
    expect(readmeContent.length).toBeGreaterThan(1000);

    const integrationsPath = path.join(docsDir, "INTEGRATIONS.md");
    expect(fs.existsSync(integrationsPath)).toBe(true);
    const integrationsContent = fs.readFileSync(integrationsPath, "utf8");
    expect(integrationsContent.length).toBeGreaterThan(500);
  });

  it("README.md should accurately reflect package structure and maturity matrix", () => {
    const readmeContent = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");

    // Package references
    expect(readmeContent).toContain("@terrarium/contracts");
    expect(readmeContent).toContain("@terrarium/config");
    expect(readmeContent).toContain("@terrarium/core");
    expect(readmeContent).toContain("terrarium-cli");

    // Feature maturity statuses
    expect(readmeContent).toContain("[IMPLEMENTED]");
    expect(readmeContent).toContain("[EXPERIMENTAL]");
    expect(readmeContent).toContain("[PLANNED]");

    // Command groups
    expect(readmeContent).toContain("terrarium workflow run");
    expect(readmeContent).toContain("terrarium task plan");
    expect(readmeContent).toContain("terrarium agent list");
    expect(readmeContent).toContain("terrarium provider list");
    expect(readmeContent).toContain("terrarium tool list");
    expect(readmeContent).toContain("terrarium studio scan");
    expect(readmeContent).toContain("terrarium report generate");
  });

  it("OWNER_ONBOARDING.md should cover OpenTUI workspaces 1 through 10", () => {
    const onboarding = fs.readFileSync(path.join(guidesDir, "OWNER_ONBOARDING.md"), "utf8");

    expect(onboarding).toContain("Workspace 1 — System Overview");
    expect(onboarding).toContain("Workspace 2 — Agent Ecosystem");
    expect(onboarding).toContain("Workspace 3 — Task Manager");
    expect(onboarding).toContain("Workspace 4 — Conversations");
    expect(onboarding).toContain("Workspace 5 — Tools");
    expect(onboarding).toContain("Workspace 6 — Project Memory");
    expect(onboarding).toContain("Workspace 7 — Engineering Studio");
    expect(onboarding).toContain("Workspace 8 — Reports & Evidence");
    expect(onboarding).toContain("Workspace 9 — Budget");
    expect(onboarding).toContain("Workspace 10 — Settings");

    // Hotkeys and shortcuts
    expect(onboarding).toContain("Tab");
    expect(onboarding).toContain("Shift+Tab");
    expect(onboarding).toContain("q");
    expect(onboarding).toContain("Esc");
  });

  it("OPERATIONS_AND_MAINTENANCE.md should document backup, recovery, and troubleshooting", () => {
    const ops = fs.readFileSync(path.join(guidesDir, "OPERATIONS_AND_MAINTENANCE.md"), "utf8");

    // Database operations
    expect(ops).toContain("VACUUM INTO");
    expect(ops).toContain("PRAGMA integrity_check");
    expect(ops).toContain("PRAGMA foreign_key_check");

    // Troubleshooting playbook codes
    expect(ops).toContain("SQLITE_BUSY");
    expect(ops).toContain("PROVIDER_UNAUTHORIZED_CALL_ERROR");
    expect(ops).toContain("APPROVAL_REQUIRED");
    expect(ops).toContain("BUDGET_EXCEEDED");
    expect(ops).toContain("ECONNREFUSED 127.0.0.1:11434");
    expect(ops).toContain("SANDBOX_VIOLATION");
  });

  it("ARCHITECTURE_AND_SUBSYSTEMS.md should document demand-based activation and state machines", () => {
    const arch = fs.readFileSync(path.join(guidesDir, "ARCHITECTURE_AND_SUBSYSTEMS.md"), "utf8");

    expect(arch).toContain("On-Demand Activation");
    expect(arch).toContain("Task Status Machine");
    expect(arch).toContain("Approval Request Machine");
    expect(arch).toContain("Workflow Stage Machine");
    expect(arch).toContain("Dormant Profile Proof");
  });

  it("REPORTS_AND_CUSTOMER_RESEARCH.md should mandate synthetic research disclaimers", () => {
    const rep = fs.readFileSync(path.join(guidesDir, "REPORTS_AND_CUSTOMER_RESEARCH.md"), "utf8");

    expect(rep).toContain("verified_fact");
    expect(rep).toContain("generated_analysis");
    expect(rep).toContain("assumption");
    expect(rep).toContain("simulated_feedback");
    expect(rep).toContain("SIMULATION NOTICE");
    expect(rep).toContain("Mandatory Disclaimer");
    expect(rep).toContain("Prohibited Claims");
  });

  it("ENGINEERING_STUDIO.md should document path traversal guards and rollback mechanisms", () => {
    const studio = fs.readFileSync(path.join(guidesDir, "ENGINEERING_STUDIO.md"), "utf8");

    expect(studio).toContain("Path Traversal Guard");
    expect(studio).toContain("Sensitive File Protection");
    expect(studio).toContain("Unified Diff Standard");
    expect(studio).toContain("Atomic Rollback");
    expect(studio).toContain("Bounded Test Runner");
  });
});
