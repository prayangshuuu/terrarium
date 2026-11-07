import { describe, it, expect, beforeEach } from "bun:test";
import { ApprovalManager } from "@terrarium/core";
import {
  handleApprovalList,
  handleApprovalShow,
  handleApprovalDecision,
} from "../src/commands/approval-commands.ts";
import { explainConsequences, formatRiskBadge } from "../src/commands/risk-communicator.ts";

describe("CLI Approval & Risk Communication Commands Suite (A4 & A5)", () => {
  let approvalManager: ApprovalManager;
  let sampleApprovalId: string;

  beforeEach(async () => {
    approvalManager = new ApprovalManager();
    const createRes = await approvalManager.createRequest({
      taskId: "task-deploy-01",
      actionType: "production_deploy",
      description: "Deploy api service v2.0.0 to production",
      toolId: "deploy.production",
      riskLevel: "critical",
      requestedByAgentId: "agent-devops-01",
      payload: {
        environment: "production",
        serviceName: "api-backend",
        tag: "v2.0.0",
      },
    });
    if (!createRes.success) throw new Error("Failed to create sample approval");
    sampleApprovalId = createRes.data.id;
  });

  it("lists approvals in formatted table with status glyphs and risk badges", async () => {
    const res = await handleApprovalList(approvalManager);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.output).toContain("Terrarium Consequential Action Approvals");
      expect(res.data.output).toContain(sampleApprovalId);
      expect(res.data.output).toContain("production_deploy");
      expect(res.data.approvals.length).toBe(1);
    }
  });

  it("outputs structured JSON when --json is provided for list", async () => {
    const res = await handleApprovalList(approvalManager, { json: true });
    expect(res.success).toBe(true);
    if (res.success) {
      const parsed = JSON.parse(res.data.output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe(sampleApprovalId);
    }
  });

  it("displays full inspectable approval card with consequence warning and payload", async () => {
    const res = await handleApprovalShow(sampleApprovalId, approvalManager);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("APPROVAL REQUEST: " + sampleApprovalId);
      expect(res.data).toContain("CONSEQUENCE WARNING");
      expect(res.data).toContain("Live Production Deployment");
      expect(res.data).toContain("api-backend");
      expect(res.data).toContain("v2.0.0");
      expect(res.data).toContain("Payload Hash:");
    }
  });

  it("outputs structured JSON for approval card inspection", async () => {
    const res = await handleApprovalShow(sampleApprovalId, approvalManager, { json: true });
    expect(res.success).toBe(true);
    if (res.success) {
      const parsed = JSON.parse(res.data);
      expect(parsed.id).toBe(sampleApprovalId);
      expect(parsed.actionType).toBe("production_deploy");
      expect(parsed.payload.serviceName).toBe("api-backend");
    }
  });

  it("executes approval decision: approve, reject, cancel", async () => {
    // 1. Approve
    const appRes = await handleApprovalDecision(sampleApprovalId, "approve", approvalManager, {
      userId: "chief-engineer",
      reason: "Approved release candidate",
    });
    expect(appRes.success).toBe(true);
    if (appRes.success) {
      expect(appRes.data.approval.status).toBe("approved");
      expect(appRes.data.output).toContain("APPROVED");
      expect(appRes.data.output).toContain("chief-engineer");
    }

    // 2. Cannot reject an already approved request (state machine transition assertion)
    const rejRes = await handleApprovalDecision(sampleApprovalId, "reject", approvalManager);
    expect(rejRes.success).toBe(false);
  });

  it("supports cancelling pending approvals", async () => {
    const createRes = await approvalManager.createRequest({
      taskId: "task-002",
      actionType: "file_delete",
      description: "Delete obsolete cache",
      toolId: "fs.delete_file",
      riskLevel: "critical",
      requestedByAgentId: "agent-cleaner",
      payload: { path: "/tmp/cache.bin" },
    });
    if (!createRes.success) throw new Error("Failed to create approval");
    const id = createRes.data.id;

    const cancelRes = await handleApprovalDecision(id, "cancel", approvalManager, {
      userId: "operator",
      reason: "No longer needed",
    });
    expect(cancelRes.success).toBe(true);
    if (cancelRes.success) {
      expect(cancelRes.data.approval.status).toBe("cancelled");
    }
  });

  it("explainConsequences returns accurate risk explanations across action types", () => {
    const del = explainConsequences("file_delete", { path: "/etc/passwd" });
    expect(del.severity).toBe("critical");
    expect(del.title).toContain("File Deletion");

    const push = explainConsequences("git_push", { remote: "origin", branch: "main", force: true });
    expect(push.severity).toBe("critical");
    expect(push.title).toContain("Destructive Force Push");

    const pub = explainConsequences("external_publish", { packageName: "my-lib", version: "1.0.0" });
    expect(pub.title).toContain("External Artifact Publication");

    const msg = explainConsequences("message_send", { recipient: "all@company.com", channel: "email" });
    expect(msg.title).toContain("External Message Dispatch");
  });

  it("formatRiskBadge renders expected severity tags", () => {
    expect(formatRiskBadge("read_only")).toBe("[READ_ONLY]");
    expect(formatRiskBadge("low")).toBe("[LOW]");
    expect(formatRiskBadge("medium")).toBe("[MEDIUM]");
    expect(formatRiskBadge("high")).toBe("[HIGH]");
    expect(formatRiskBadge("critical")).toBe("[CRITICAL]");
  });
});
