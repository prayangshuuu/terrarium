import { describe, it, expect } from "bun:test";
import {
  type ToolDefinition,
  type ToolExecutionContext,
  ok,
  fail,
  ToolExecutionError,
} from "@terrarium/contracts";
import { createToolRegistry, DefaultToolRegistry } from "../src/tools/index.ts";

describe("Tool Registry & Runtime Invocation Suite (A2)", () => {
  const baseContext: ToolExecutionContext = {
    agentId: "agent-eng-01",
    taskId: "task-test-001",
    grantedPermissions: ["test:read", "test:write", "test:compute"],
  };

  const echoTool: ToolDefinition<{ message: string; count?: number }, { echoed: string }> = {
    id: "test.echo",
    name: "Echo Tool",
    description: "Echoes message back count times",
    category: "testing",
    version: "1.0.0",
    riskLevel: "low",
    sideEffectClass: "none",
    requiredPermissions: ["test:read"],
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Text to echo", required: true },
        count: { type: "number", default: 1, description: "Repeat count" },
      },
      required: ["message"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        echoed: { type: "string" },
      },
      required: ["echoed"],
    },
    defaultTimeoutMs: 1000,
    maxTimeoutMs: 5000,
    requiresApproval: false,
    isConsequential: false,
    async execute(input) {
      const repeated = Array(input.count ?? 1)
        .fill(input.message)
        .join(" ");
      return ok({ echoed: repeated });
    },
  };

  it("registers, discovers, and unregisters tools", () => {
    const registry = createToolRegistry({ skipBuiltinRegistration: true });
    expect(registry.list().length).toBe(0);

    registry.register(echoTool);
    expect(registry.has("test.echo")).toBe(true);
    expect(registry.get("test.echo")?.name).toBe("Echo Tool");
    expect(registry.list().length).toBe(1);

    const filtered = registry.list({ category: "testing" });
    expect(filtered.length).toBe(1);

    const emptyFiltered = registry.list({ category: "production" });
    expect(emptyFiltered.length).toBe(0);

    const unregistered = registry.unregister("test.echo");
    expect(unregistered).toBe(true);
    expect(registry.has("test.echo")).toBe(false);
  });

  it("invokes a tool successfully with default values applied", async () => {
    const registry = createToolRegistry({ skipBuiltinRegistration: true });
    registry.register(echoTool);

    const res = await registry.invoke({
      toolId: "test.echo",
      input: { message: "Hello World" },
      context: baseContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.toolId).toBe("test.echo");
      expect(res.data.output).toEqual({ echoed: "Hello World" });
      expect(res.data.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns ToolNotFoundError when invoking an unregistered tool", async () => {
    const registry = createToolRegistry({ skipBuiltinRegistration: true });

    const res = await registry.invoke({
      toolId: "non.existent",
      input: {},
      context: baseContext,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.name).toBe("ToolNotFoundError");
    }
  });

  it("fails invocation when input parameters violate schema", async () => {
    const registry = createToolRegistry({ skipBuiltinRegistration: true });
    registry.register(echoTool);

    // Missing required 'message'
    const res = await registry.invoke({
      toolId: "test.echo",
      input: { count: 3 } as any,
      context: baseContext,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.name).toBe("ToolValidationError");
    }
  });

  it("fails invocation when extra properties are supplied and additionalProperties is false", async () => {
    const registry = createToolRegistry({ skipBuiltinRegistration: true });
    registry.register(echoTool);

    const res = await registry.invoke({
      toolId: "test.echo",
      input: { message: "test", maliciousInjection: true } as any,
      context: baseContext,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.name).toBe("ToolValidationError");
    }
  });

  it("enforces execution timeout when tool execution hangs", async () => {
    const slowTool: ToolDefinition<{ delayMs: number }, { ok: boolean }> = {
      id: "test.slow",
      name: "Slow Tool",
      description: "Deliberately slow tool",
      category: "testing",
      version: "1.0.0",
      riskLevel: "low",
      sideEffectClass: "none",
      requiredPermissions: ["test:compute"],
      inputSchema: {
        type: "object",
        properties: {
          delayMs: { type: "number", required: true },
        },
        required: ["delayMs"],
      },
      defaultTimeoutMs: 100, // 100ms timeout
      maxTimeoutMs: 200,
      requiresApproval: false,
      isConsequential: false,
      async execute(input) {
        await new Promise((r) => setTimeout(r, input.delayMs));
        return ok({ ok: true });
      },
    };

    const registry = createToolRegistry({ skipBuiltinRegistration: true });
    registry.register(slowTool);

    const res = await registry.invoke({
      toolId: "test.slow",
      input: { delayMs: 400 }, // Takes 400ms > 100ms timeout
      context: baseContext,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.name).toBe("ToolTimeoutError");
      expect((res.error as any).toolId).toBe("test.slow");
    }
  });

  it("respects external cancellation signal during tool execution", async () => {
    const registry = createToolRegistry({ skipBuiltinRegistration: true });
    registry.register(echoTool);

    const abortController = new AbortController();
    abortController.abort(); // Pre-aborted

    const res = await registry.invoke({
      toolId: "test.echo",
      input: { message: "test" },
      context: { ...baseContext, signal: abortController.signal },
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.name).toBe("ToolTimeoutError");
    }
  });

  it("captures runtime errors from execute function cleanly", async () => {
    const brokenTool: ToolDefinition<Record<string, unknown>, unknown> = {
      id: "test.broken",
      name: "Broken Tool",
      description: "Throws runtime error",
      category: "testing",
      version: "1.0.0",
      riskLevel: "low",
      sideEffectClass: "none",
      requiredPermissions: ["test:compute"],
      inputSchema: { type: "object", properties: {} },
      defaultTimeoutMs: 1000,
      maxTimeoutMs: 5000,
      requiresApproval: false,
      isConsequential: false,
      async execute() {
        return fail(new ToolExecutionError("test.broken", "Simulated runtime crash"));
      },
    };

    const registry = createToolRegistry({ skipBuiltinRegistration: true });
    registry.register(brokenTool);

    const res = await registry.invoke({
      toolId: "test.broken",
      input: {},
      context: baseContext,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.success).toBe(false);
      expect(res.data.error?.name).toBe("ToolExecutionError");
    }
  });
});
