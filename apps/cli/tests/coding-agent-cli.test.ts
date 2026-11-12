/**
 * apps/cli/tests/coding-agent-cli.test.ts
 *
 * Unit tests for CLI coding-agent command handlers:
 * - list coding agent integrations
 * - generate compatibility matrix
 * - context disclosure preview
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import { describe, expect, it } from "bun:test";
import {
  createCodingAgentRegistry,
  createCodingAgentRouter,
} from "@terrarium/core";
import {
  handleCodingAgentList,
  handleCodingAgentMatrix,
  handleCodingAgentPreview,
} from "../src/commands/coding-agent-commands.ts";

describe("CLI Coding Agent Commands Suite (A4 & A5)", () => {
  it("lists coding agent integrations in a formatted table", async () => {
    const registry = createCodingAgentRegistry();
    const res = await handleCodingAgentList(registry, { json: false });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("TERRARIUM CODING AGENT INTEGRATIONS");
      expect(res.data).toContain("claude_code");
      expect(res.data).toContain("codex_cli");
      expect(res.data).toContain("opencode");
      expect(res.data).toContain("gemini_cli");
    }
  });

  it("outputs valid JSON when requested for coding agent list", async () => {
    const registry = createCodingAgentRegistry();
    const res = await handleCodingAgentList(registry, { json: true });

    expect(res.success).toBe(true);
    if (res.success) {
      const parsed = JSON.parse(res.data);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("prints honest compatibility matrix with limitations", () => {
    const registry = createCodingAgentRegistry();
    const res = handleCodingAgentMatrix(registry, false);

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("TERRARIUM CODING AGENT COMPATIBILITY MATRIX");
      expect(res.data).toContain("Claude Code");
      expect(res.data).toContain("Cursor IDE Agent");
      expect(res.data).toContain("Aider Coding CLI");
      expect(res.data).toContain("Limitations:");
    }
  });

  it("prints context preview before execution disclosing target and files", () => {
    const registry = createCodingAgentRegistry();
    const router = createCodingAgentRouter({ registry });

    const res = handleCodingAgentPreview(router, {
      agentId: "claude_code",
      prompt: "Refactor SQLite queries in packages/core/src/persistence",
      contextFiles: ["packages/core/src/persistence/sqlite-database.ts"],
      readOnly: true,
      json: false,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toContain("CODING AGENT CONTEXT DISCLOSURE PREVIEW");
      expect(res.data).toContain("Claude Code CLI");
      expect(res.data).toContain("READ-ONLY (Safe)");
      expect(res.data).toContain("packages/core/src/persistence/sqlite-database.ts");
    }
  });
});
