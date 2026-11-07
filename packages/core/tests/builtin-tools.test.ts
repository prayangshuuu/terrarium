import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  type ToolExecutionContext,
} from "@terrarium/contracts";
import { createToolRegistry } from "../src/tools/index.ts";
import { ApprovalManager } from "../src/approvals/approval-manager.ts";

describe("Built-in Tools Execution & Approval Suite (A2 & A3)", () => {
  const testDir = join(tmpdir(), `terrarium-tool-tests-${Date.now()}`);
  const testFile = join(testDir, "test.txt");

  const fullAdminContext: ToolExecutionContext = {
    agentId: "agent-admin-01",
    taskId: "task-builtin-01",
    grantedPermissions: ["*"], // Superadmin permissions
  };

  let approvalManager: ApprovalManager;
  let registry: ReturnType<typeof createToolRegistry>;

  beforeEach(async () => {
    approvalManager = new ApprovalManager();
    registry = createToolRegistry({
      approvalManager,
    });
    await Bun.write(testFile, "initial content for test");
  });

  afterEach(() => {
    try {
      if (existsSync(testFile)) unlinkSync(testFile);
    } catch {}
  });

  it("registers all 10 canonical built-in tools by default", () => {
    const tools = registry.list();
    expect(tools.length).toBeGreaterThanOrEqual(10);

    expect(registry.has("fs.read_file")).toBe(true);
    expect(registry.has("fs.write_file")).toBe(true);
    expect(registry.has("fs.delete_file")).toBe(true);
    expect(registry.has("shell.run_command")).toBe(true);
    expect(registry.has("git.status")).toBe(true);
    expect(registry.has("git.commit")).toBe(true);
    expect(registry.has("git.push")).toBe(true);
    expect(registry.has("publish.external")).toBe(true);
    expect(registry.has("deploy.production")).toBe(true);
    expect(registry.has("message.send")).toBe(true);
  });

  it("reads file using fs.read_file without requiring approval", async () => {
    const res = await registry.invoke({
      toolId: "fs.read_file",
      input: { path: testFile },
      context: fullAdminContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.success).toBe(true);
      expect((res.data.output as any).content).toBe("initial content for test");
    }
  });

  it("writes new file using fs.write_file without approval when overwrite=false", async () => {
    const newFilePath = join(testDir, "new-file.txt");
    const res = await registry.invoke({
      toolId: "fs.write_file",
      input: { path: newFilePath, content: "created cleanly", overwrite: false },
      context: fullAdminContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.success).toBe(true);
      expect((res.data.output as any).bytesWritten).toBeGreaterThan(0);
    }
    try {
      unlinkSync(newFilePath);
    } catch {}
  });

  it("requires approval for fs.delete_file (critical risk)", async () => {
    // 1. First attempt requires approval
    const initRes = await registry.invoke({
      toolId: "fs.delete_file",
      input: { path: testFile },
      context: fullAdminContext,
    });

    expect(initRes.success).toBe(true);
    if (!initRes.success) throw new Error("Expected success");
    expect(initRes.data.approvalRequired).toBe(true);
    const approvalId = initRes.data.approvalRequest!.id;
    expect(approvalId).toBeDefined();

    // 2. Approve
    await approvalManager.approve(approvalId, "user-admin", "Approved deletion");

    // 3. Execution succeeds with approval token
    const deleteRes = await registry.invoke({
      toolId: "fs.delete_file",
      input: { path: testFile },
      context: { ...fullAdminContext, approvalId },
    });

    expect(deleteRes.success).toBe(true);
    if (deleteRes.success) {
      expect(deleteRes.data.success).toBe(true);
    }
    expect(existsSync(testFile)).toBe(false);
  });

  it("executes safe commands via shell.run_command without approval", async () => {
    const res = await registry.invoke({
      toolId: "shell.run_command",
      input: { command: "echo 'hello terrarium'" },
      context: fullAdminContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.success).toBe(true);
      expect((res.data.output as any).stdout.trim()).toBe("hello terrarium");
    }
  });

  it("detects destructive commands in shell.run_command and requires approval", async () => {
    const res = await registry.invoke({
      toolId: "shell.run_command",
      input: { command: "rm -rf /tmp/some_important_dir" },
      context: fullAdminContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.approvalRequired).toBe(true);
      expect(res.data.approvalRequest?.actionType).toBe("destructive_operation");
    }
  });

  it("checks git.status without requiring approval", async () => {
    const res = await registry.invoke({
      toolId: "git.status",
      input: {},
      context: fullAdminContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.success).toBe(true);
      expect(typeof (res.data.output as any).branch).toBe("string");
    }
  });

  it("requires approval for git.push to remote", async () => {
    const res = await registry.invoke({
      toolId: "git.push",
      input: { remote: "origin", branch: "main" },
      context: fullAdminContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.approvalRequired).toBe(true);
      expect(res.data.approvalRequest?.actionType).toBe("git_push");
    }
  });

  it("requires approval for publish.external", async () => {
    const res = await registry.invoke({
      toolId: "publish.external",
      input: { packageName: "@terrarium/core", version: "1.0.0" },
      context: fullAdminContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.approvalRequired).toBe(true);
      expect(res.data.approvalRequest?.actionType).toBe("external_publish");
    }
  });

  it("requires approval for deploy.production", async () => {
    const res = await registry.invoke({
      toolId: "deploy.production",
      input: { environment: "production", serviceName: "api-server", tag: "v1.0.0" },
      context: fullAdminContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.approvalRequired).toBe(true);
      expect(res.data.approvalRequest?.actionType).toBe("production_deploy");
    }
  });

  it("requires approval for message.send", async () => {
    const res = await registry.invoke({
      toolId: "message.send",
      input: { recipient: "slack-channel-general", channel: "slack", text: "Release completed" },
      context: fullAdminContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.approvalRequired).toBe(true);
      expect(res.data.approvalRequest?.actionType).toBe("message_send");
    }
  });
});
