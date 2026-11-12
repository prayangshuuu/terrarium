/**
 * apps/cli/tests/release-candidate.test.ts
 *
 * TERRARIUM Release Candidate Audit & Verification Suite (Prompt 22)
 *
 * Verifies the foundational core promise:
 * request → inspectable plan → bounded demand-based selection → controlled execution → evidence-backed result
 *
 * Also audits package boundaries, secret sanitization, offline independence, and dormancy proofs.
 * Joint contribution by A1, A2, A3, A4, and A5.
 */

import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { createCoreEngine, assertExternalCallAuthorized } from "@terrarium/core";
import { loadConfig } from "@terrarium/config";
import { SIMULATED_RESEARCH_DISCLAIMER } from "@terrarium/contracts";

describe("TERRARIUM Release Candidate & Core Promise Verification", () => {
  const projectRoot = path.resolve(__dirname, "../../..");

  it("verifies the core promise: request -> inspectable plan -> bounded selection -> execution -> evidence report", async () => {
    const engine = createCoreEngine();

    // 1. Request & 2. Inspectable Plan
    const requestPrompt = "Analyze codebase dependencies and produce recommendations";
    const intakeRes = await engine.intake.processIntake({
      prompt: requestPrompt,
      explicitDepartment: "engineering",
    });
    expect(intakeRes.success).toBe(true);
    if (!intakeRes.success) return;

    const plan = intakeRes.data.plan;
    expect(plan.id).toBeDefined();
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.classification.risk.score).toBeGreaterThanOrEqual(0);

    // 3. Bounded Demand-Based Selection (Dormancy Proof)
    const allProfilesRes = await engine.registry.list();
    expect(allProfilesRes.success).toBe(true);
    const totalCount = allProfilesRes.success ? allProfilesRes.data.length : 0;
    expect(totalCount).toBeGreaterThan(5);

    const workflowRes = await engine.workflow.executeWorkflow({
      prompt: requestPrompt,
      targetDepartment: "engineering",
      autoApprove: true,
      budgetLimitUsd: 2.0,
    });

    expect(workflowRes.success).toBe(true);
    if (!workflowRes.success) return;

    const record = workflowRes.data;

    // Active profiles must be recruited, while unneeded profiles remain strictly dormant
    expect(record.dormantProfilesVerified).toBe(true);
    expect(record.activeProfileSlugs.length).toBeGreaterThan(0);
    expect(record.dormantProfileSlugs.length).toBeGreaterThan(0);

    // Mathematical disjointness: Active ∩ Dormant = ∅
    const overlap = record.activeProfileSlugs.filter((slug) =>
      record.dormantProfileSlugs.includes(slug)
    );
    expect(overlap.length).toBe(0);
    expect(record.activeProfileSlugs.length + record.dormantProfileSlugs.length).toBe(totalCount);

    // 4. Controlled Bounded Execution
    expect(record.status).toBe("completed");
    expect(record.stage).toBe("completed");
    expect(record.metrics.stepsCompleted).toBeGreaterThan(0);
    expect(record.metrics.durationMs).toBeGreaterThanOrEqual(0);

    // 5. Evidence-Backed Result & Deliverables
    expect(record.artifacts.length).toBeGreaterThan(0);
    expect(record.report).toBeDefined();
    expect(record.report?.title).toBeDefined();
    expect(record.report?.summary).toBeDefined();
    expect(record.report?.evidence.length).toBeGreaterThan(0);
    expect(record.report?.sources.length).toBeGreaterThan(0);
  });

  it("verifies consequential action approval gates halt execution until authorized", async () => {
    const engine = createCoreEngine();

    const highRiskWorkflow = await engine.workflow.executeWorkflow({
      prompt: "Execute destructive migration dropping and rebuilding database tables",
      targetDepartment: "engineering",
      autoApprove: false, // Must pause for human authorization
    });

    expect(highRiskWorkflow.success).toBe(true);
    if (highRiskWorkflow.success) {
      expect(highRiskWorkflow.data.stage).toBe("approval");
      expect(highRiskWorkflow.data.status).toBe("waiting_for_approval");
      expect(highRiskWorkflow.data.approvalRequestId).toBeDefined();
    }
  });

  it("verifies synthetic customer research includes mandatory disclaimers and non-claims", async () => {
    const engine = createCoreEngine();

    const simulationRes = await engine.reports.simulateCustomerResearch({
      concept: "New zero-overhead developer terminal shell for multi-agent workflows",
      scenario: "First-run onboarding experience in CLI environment",
      targetPersonas: ["devops_lead", "security_officer"],
      pricingHypothesis: "$20/seat monthly",
    });

    expect(simulationRes.success).toBe(true);
    if (simulationRes.success) {
      const report = simulationRes.data;
      expect(report.hasSimulatedData).toBe(true);
      expect(report.simulationMetadata?.disclaimer).toBe(SIMULATED_RESEARCH_DISCLAIMER);
      expect(report.simulationMetadata?.personas.length).toBeGreaterThan(0);
    }
  });

  it("verifies repository git tracking hygiene and secret absence", () => {
    // 1. Ensure private .env.example exists and contains template
    const envExample = path.join(projectRoot, ".env.example");
    expect(fs.existsSync(envExample)).toBe(true);

    // 2. Ensure .gitignore protects sensitive paths
    const gitignore = fs.readFileSync(path.join(projectRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain("*.sqlite");
    expect(gitignore).toContain(".terrarium/");
    expect(gitignore).toContain("/docs/PLAN.md");
    expect(gitignore).toContain("/docs/PROMPTS.md");
    expect(gitignore).toContain("/docs/PROMPT*_REPORT.md");

    // 3. Verify config secret scrubber
    const configRes = loadConfig({
      env: {
        OPENAI_API_KEY: "sk-proj-superSecretTestKey1234567890",
        ANTHROPIC_API_KEY: "sk-ant-api03-testSecretKey1234567890",
      },
    });
    expect(configRes.success).toBe(true);
    if (configRes.success) {
      const redacted = configRes.data.toJSON(true);
      const serialized = JSON.stringify(redacted);
      expect(serialized).not.toContain("sk-proj-superSecretTestKey1234567890");
      expect(serialized).not.toContain("sk-ant-api03-testSecretKey1234567890");
    }
  });

  it("verifies offline air-gapped execution blocks external network without explicit authorization", async () => {
    const offlineEngine = createCoreEngine();

    // Default configuration: cloud providers must NOT make external network calls
    const checkAuth = assertExternalCallAuthorized("anthropic", "sk-ant-some-key", false);
    expect(checkAuth.success).toBe(false);
    if (!checkAuth.success) {
      expect(checkAuth.error.code).toBe("PROVIDER_UNAUTHORIZED_CALL_ERROR");
    }

    // Local loopback endpoints (e.g. Ollama localhost) are authorized offline
    const localCheck = assertExternalCallAuthorized("ollama", undefined, false, "http://localhost:11434");
    expect(localCheck.success).toBe(true);

    // Full workflow executes mock models safely without network or API keys
    const runRes = await offlineEngine.workflow.executeWorkflow({
      prompt: "Perform complete offline architecture inspection",
      targetDepartment: "engineering",
      autoApprove: true,
    });

    expect(runRes.success).toBe(true);
    if (runRes.success) {
      expect(runRes.data.status).toBe("completed");
    }
  });
});
