import { describe, it, expect } from "bun:test";
import {
  type DomainEvent,
  type EventRepository,
  type ToolDefinition,
  type ToolExecutionContext,
  ok,
  fail,
  ApprovalRequiredError,
  ApprovalRejectedError,
  ApprovalExpiredError,
  ApprovalCancelledError,
  DuplicateExecutionError,
  PermissionDeniedError,
} from "@terrarium/contracts";
import { createToolRegistry } from "../src/tools/index.ts";
import { ApprovalManager } from "../src/approvals/approval-manager.ts";
import { ToolSecurityEnforcer } from "../src/tools/security-enforcer.ts";

describe("Tool Permissions, Approvals & Bypass Resistance Suite (A3)", () => {
  class MockEventRepository implements EventRepository {
    readonly events: DomainEvent[] = [];
    async record(event: DomainEvent) {
      this.events.push(event);
      return ok(event);
    }
    async query() {
      return ok(this.events);
    }
  }

  const consequentialTool: ToolDefinition<
    { targetResource: string; force?: boolean },
    { destroyed: boolean }
  > = {
    id: "system.destroy_cluster",
    name: "Destroy Production Cluster",
    description: "Permanently terminates cluster infrastructure",
    category: "infrastructure",
    version: "1.0.0",
    riskLevel: "critical",
    sideEffectClass: "consequential",
    requiredPermissions: ["cluster:destroy"],
    inputSchema: {
      type: "object",
      properties: {
        targetResource: { type: "string", required: true },
        force: { type: "boolean", default: false },
      },
      required: ["targetResource"],
      additionalProperties: false,
    },
    defaultTimeoutMs: 5000,
    maxTimeoutMs: 30000,
    requiresApproval: true,
    isConsequential: true,
    async execute(input) {
      return ok({ destroyed: true });
    },
  };

  it("enforces least privilege: denies execution when caller lacks required permission", async () => {
    const registry = createToolRegistry({ skipBuiltinRegistration: true });
    registry.register(consequentialTool);

    const unauthorizedContext: ToolExecutionContext = {
      agentId: "agent-junior-01",
      taskId: "task-001",
      grantedPermissions: ["cluster:read"], // Lacks cluster:destroy
    };

    const res = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "prod-cluster-us-east" },
      context: unauthorizedContext,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBeInstanceOf(PermissionDeniedError);
      expect((res.error as PermissionDeniedError).action).toBe("execute");
    }
  });

  it("enforces least privilege: supports wildcard permissions (* and namespace:*)", async () => {
    const registry = createToolRegistry({ skipBuiltinRegistration: true });
    registry.register(consequentialTool);

    const enforcer = new ToolSecurityEnforcer();

    // Specific permission
    const res1 = enforcer.checkPermission(consequentialTool, {
      agentId: "agent-1",
      taskId: "task-1",
      grantedPermissions: ["cluster:destroy"],
    });
    expect(res1.success).toBe(true);

    // Namespace wildcard
    const res2 = enforcer.checkPermission(consequentialTool, {
      agentId: "agent-2",
      taskId: "task-2",
      grantedPermissions: ["cluster:*"],
    });
    expect(res2.success).toBe(true);

    // Superadmin wildcard
    const res3 = enforcer.checkPermission(consequentialTool, {
      agentId: "agent-3",
      taskId: "task-3",
      grantedPermissions: ["*"],
    });
    expect(res3.success).toBe(true);
  });

  it("denies execution when tool is explicitly listed in agent disallowedTools", async () => {
    const registry = createToolRegistry({ skipBuiltinRegistration: true });
    registry.register(consequentialTool);

    const contextWithDisallowed: ToolExecutionContext = {
      agentId: "agent-restricted",
      taskId: "task-001",
      grantedPermissions: ["cluster:destroy"], // Has permission
      disallowedTools: ["system.destroy_cluster"], // But tool is disallowed
    };

    const res = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "prod-cluster" },
      context: contextWithDisallowed,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBeInstanceOf(PermissionDeniedError);
      expect(res.error.message).toContain("disallowedTools");
    }
  });

  it("requires human approval for consequential tool: creates pending request and pauses invocation", async () => {
    const eventRepo = new MockEventRepository();
    const approvalManager = new ApprovalManager({ eventRepository: eventRepo });
    const registry = createToolRegistry({
      skipBuiltinRegistration: true,
      approvalManager,
      eventRepository: eventRepo,
    });
    registry.register(consequentialTool);

    const authorizedContext: ToolExecutionContext = {
      agentId: "agent-lead-01",
      taskId: "task-consequential-01",
      grantedPermissions: ["cluster:destroy"],
      // No approvalId supplied
    };

    const res = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-staging" },
      context: authorizedContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.success).toBe(false);
      expect(res.data.approvalRequired).toBe(true);
      expect(res.data.approvalRequest).toBeDefined();
      expect(res.data.approvalRequest?.status).toBe("pending");
      expect(res.data.approvalRequest?.toolId).toBe("system.destroy_cluster");
      expect(res.data.error).toBeInstanceOf(ApprovalRequiredError);
    }

    // Verify audit event was logged
    expect(eventRepo.events.some((e) => e.eventType === "approval:requested")).toBe(true);
    expect(eventRepo.events.some((e) => e.eventType === "tool:blocked")).toBe(true);
  });

  it("completes execution when valid human approval token is provided", async () => {
    const eventRepo = new MockEventRepository();
    const approvalManager = new ApprovalManager({ eventRepository: eventRepo });
    const registry = createToolRegistry({
      skipBuiltinRegistration: true,
      approvalManager,
      eventRepository: eventRepo,
    });
    registry.register(consequentialTool);

    const context: ToolExecutionContext = {
      agentId: "agent-lead-01",
      taskId: "task-001",
      grantedPermissions: ["cluster:destroy"],
    };

    // 1. Initial attempt -> triggers approval requirement
    const initRes = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-staging", force: false },
      context,
    });
    expect(initRes.success).toBe(true);
    if (!initRes.success) throw new Error("Expected success");
    const approvalId = initRes.data.approvalRequest!.id;
    expect(approvalId).toBeDefined();

    // 2. Human reviews and approves
    const approveRes = await approvalManager.approve(
      approvalId,
      "user-admin-42",
      "Authorized for maintenance window"
    );
    expect(approveRes.success).toBe(true);
    if (!approveRes.success) throw new Error("Expected approve success");
    expect(approveRes.data.status).toBe("approved");

    // 3. Retry invocation with authorized approvalId token
    const authorizedRun = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-staging", force: false },
      context: { ...context, approvalId },
    });

    expect(authorizedRun.success).toBe(true);
    if (authorizedRun.success) {
      expect(authorizedRun.data.success).toBe(true);
      expect(authorizedRun.data.output).toEqual({ destroyed: true });
    }

    // Verify approval events
    expect(eventRepo.events.some((e) => e.eventType === "approval:approved")).toBe(true);
    expect(eventRepo.events.some((e) => e.eventType === "tool:succeeded")).toBe(true);
  });

  it("bypass resistance: retry/delegation cannot bypass a REJECTED approval", async () => {
    const approvalManager = new ApprovalManager();
    const registry = createToolRegistry({ skipBuiltinRegistration: true, approvalManager });
    registry.register(consequentialTool);

    const context: ToolExecutionContext = {
      agentId: "agent-lead-01",
      taskId: "task-001",
      grantedPermissions: ["cluster:destroy"],
    };

    // 1. Create approval request
    const initRes = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-prod" },
      context,
    });
    if (!initRes.success) throw new Error("Expected success");
    const approvalId = initRes.data.approvalRequest!.id;

    // 2. Human rejects the request
    await approvalManager.reject(approvalId, "user-admin-42", "Too dangerous for peak hours");

    // 3. Attempting to execute with rejected approvalId is strictly blocked
    const bypassAttempt = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-prod" },
      context: { ...context, approvalId },
    });

    expect(bypassAttempt.success).toBe(false);
    if (!bypassAttempt.success) {
      expect(bypassAttempt.error).toBeInstanceOf(ApprovalRejectedError);
      expect((bypassAttempt.error as ApprovalRejectedError).reason).toContain("Too dangerous");
    }
  });

  it("bypass resistance: retry cannot bypass an EXPIRED approval", async () => {
    const approvalManager = new ApprovalManager({ defaultExpirationSeconds: -10 }); // Already expired
    const registry = createToolRegistry({ skipBuiltinRegistration: true, approvalManager });
    registry.register(consequentialTool);

    const context: ToolExecutionContext = {
      agentId: "agent-lead-01",
      taskId: "task-001",
      grantedPermissions: ["cluster:destroy"],
    };

    const initRes = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-prod" },
      context,
    });
    if (!initRes.success) throw new Error("Expected success");
    const approvalId = initRes.data.approvalRequest!.id;

    // Approve an expired token
    const approveRes = await approvalManager.approve(approvalId, "user-admin");
    expect(approveRes.success).toBe(false);
    if (!approveRes.success) {
      expect(approveRes.error).toBeInstanceOf(ApprovalExpiredError);
    }

    // Attempting to invoke with expired token fails
    const runRes = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-prod" },
      context: { ...context, approvalId },
    });

    expect(runRes.success).toBe(false);
    if (!runRes.success) {
      expect(runRes.error).toBeInstanceOf(ApprovalExpiredError);
    }
  });

  it("bypass resistance: cannot use a CANCELLED approval", async () => {
    const approvalManager = new ApprovalManager();
    const registry = createToolRegistry({ skipBuiltinRegistration: true, approvalManager });
    registry.register(consequentialTool);

    const context: ToolExecutionContext = {
      agentId: "agent-lead-01",
      taskId: "task-001",
      grantedPermissions: ["cluster:destroy"],
    };

    const initRes = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-prod" },
      context,
    });
    if (!initRes.success) throw new Error("Expected success");
    const approvalId = initRes.data.approvalRequest!.id;

    // Cancel approval
    await approvalManager.cancel(approvalId, "agent-lead-01", "Plan changed, aborting");

    // Attempt to invoke
    const runRes = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-prod" },
      context: { ...context, approvalId },
    });

    expect(runRes.success).toBe(false);
    if (!runRes.success) {
      expect(runRes.error).toBeInstanceOf(ApprovalCancelledError);
      expect((runRes.error as ApprovalCancelledError).reason).toContain("Plan changed");
    }
  });

  it("tamper detection: detects altered payload parameters after approval grant", async () => {
    const approvalManager = new ApprovalManager();
    const registry = createToolRegistry({ skipBuiltinRegistration: true, approvalManager });
    registry.register(consequentialTool);

    const context: ToolExecutionContext = {
      agentId: "agent-lead-01",
      taskId: "task-001",
      grantedPermissions: ["cluster:destroy"],
    };

    // 1. User approves destroying cluster-staging
    const initRes = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-staging", force: false },
      context,
    });
    if (!initRes.success) throw new Error("Expected success");
    const approvalId = initRes.data.approvalRequest!.id;
    await approvalManager.approve(approvalId, "user-admin", "Approved staging teardown");

    // 2. Malicious/accidental caller swaps payload to cluster-production!
    const tamperedAttempt = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-production-PRIMARY", force: true }, // TAMPERED!
      context: { ...context, approvalId },
    });

    expect(tamperedAttempt.success).toBe(false);
    if (!tamperedAttempt.success) {
      expect(tamperedAttempt.error).toBeInstanceOf(PermissionDeniedError);
      expect(tamperedAttempt.error.message).toContain("Approval payload tampering detected");
    }
  });

  it("duplicate execution prevention: approved token cannot be executed more than once (replay attack)", async () => {
    const approvalManager = new ApprovalManager();
    const registry = createToolRegistry({ skipBuiltinRegistration: true, approvalManager });
    registry.register(consequentialTool);

    const context: ToolExecutionContext = {
      agentId: "agent-lead-01",
      taskId: "task-001",
      grantedPermissions: ["cluster:destroy"],
    };

    const initRes = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-dev", force: false },
      context,
    });
    if (!initRes.success) throw new Error("Expected success");
    const approvalId = initRes.data.approvalRequest!.id;
    await approvalManager.approve(approvalId, "user-admin", "Approved");

    // First execution succeeds and marks approval executed
    const firstRun = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-dev", force: false },
      context: { ...context, approvalId },
    });
    expect(firstRun.success).toBe(true);

    // Second execution with same approvalId MUST fail with DuplicateExecutionError
    const replayRun = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-dev", force: false },
      context: { ...context, approvalId },
    });

    expect(replayRun.success).toBe(false);
    if (!replayRun.success) {
      expect(replayRun.error).toBeInstanceOf(DuplicateExecutionError);
      expect(replayRun.error.message).toContain("already been executed");
    }
  });

  it("task boundary isolation: cannot use an approval issued for a different task", async () => {
    const approvalManager = new ApprovalManager();
    const registry = createToolRegistry({ skipBuiltinRegistration: true, approvalManager });
    registry.register(consequentialTool);

    // Issued for task-001
    const initRes = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-dev", force: false },
      context: {
        agentId: "agent-1",
        taskId: "task-001",
        grantedPermissions: ["cluster:destroy"],
      },
    });
    expect(initRes.success).toBe(true);
    if (!initRes.success) throw new Error("Expected success");
    const approvalId = initRes.data.approvalRequest!.id;
    await approvalManager.approve(approvalId, "user-admin");

    // Attempted under task-999
    const crossTaskRun = await registry.invoke({
      toolId: "system.destroy_cluster",
      input: { targetResource: "cluster-dev", force: false },
      context: {
        agentId: "agent-2",
        taskId: "task-999", // Different task
        grantedPermissions: ["cluster:destroy"],
        approvalId,
      },
    });

    expect(crossTaskRun.success).toBe(false);
    if (!crossTaskRun.success) {
      expect(crossTaskRun.error).toBeInstanceOf(PermissionDeniedError);
      expect(crossTaskRun.error.message).toContain("task-001");
    }
  });
});
