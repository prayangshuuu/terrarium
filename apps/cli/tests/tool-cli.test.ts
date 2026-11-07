import { describe, it, expect } from "bun:test";
import { createToolRegistry } from "@terrarium/core";
import { handleToolList, handleToolInfo } from "../src/commands/tool-commands.ts";

describe("CLI Tool Registry Commands Suite (A4 & A5)", () => {
  const registry = createToolRegistry();

  it("lists all registered tools in formatted terminal table", async () => {
    const res = await handleToolList(registry);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.output).toContain("Terrarium Registered Tools");
      expect(res.data.output).toContain("fs.read_file");
      expect(res.data.output).toContain("fs.delete_file");
      expect(res.data.output).toContain("git.push");
      expect(res.data.tools.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("outputs structured JSON when --json flag is provided", async () => {
    const res = await handleToolList(registry, { json: true });
    expect(res.success).toBe(true);
    if (res.success) {
      const parsed = JSON.parse(res.data.output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.some((t: any) => t.id === "fs.delete_file")).toBe(true);
    }
  });

  it("filters tools by category or risk level", async () => {
    const catRes = await handleToolList(registry, { category: "git" });
    expect(catRes.success).toBe(true);
    if (catRes.success) {
      expect(catRes.data.tools.every((t) => t.category === "git")).toBe(true);
    }

    const riskRes = await handleToolList(registry, { risk: "critical" });
    expect(riskRes.success).toBe(true);
    if (riskRes.success) {
      expect(riskRes.data.tools.every((t) => t.riskLevel === "critical")).toBe(true);
    }
  });

  it("displays detailed tool info card with input schema parameters", async () => {
    const res = await handleToolInfo("fs.read_file", registry);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("TOOL: fs.read_file");
      expect(res.data).toContain("Read File");
      expect(res.data).toContain("Input Parameters (Schema)");
      expect(res.data).toContain("path");
    }
  });

  it("outputs structured JSON for tool info card", async () => {
    const res = await handleToolInfo("git.push", registry, { json: true });
    expect(res.success).toBe(true);
    if (res.success) {
      const parsed = JSON.parse(res.data);
      expect(parsed.id).toBe("git.push");
      expect(parsed.riskLevel).toBe("critical");
      expect(parsed.requiresApproval).toBe(true);
    }
  });

  it("returns ToolNotFoundError when inspecting non-existent tool", async () => {
    const res = await handleToolInfo("non.existent.tool", registry);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.name).toBe("ToolNotFoundError");
    }
  });
});
