/**
 * packages/core/tests/prompt-templates.test.ts
 *
 * Tests for starter prompt templates, category search, and variable interpolation.
 * Prompt 26 verification suite. Zero emoji typography.
 */

import { describe, it, expect } from "bun:test";
import {
  STARTER_TEMPLATES,
  getStarterTemplates,
  getPromptTemplateById,
  searchPromptTemplates,
  renderPromptTemplate,
} from "../src/prompt/prompt-templates.ts";

describe("Prompt Templates Catalog (Prompt 26)", () => {
  it("provides at least 11 production-grade starter templates", () => {
    const templates = getStarterTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(11);
  });

  it("ensures every template satisfies the contract schema", () => {
    for (const t of STARTER_TEMPLATES) {
      expect(typeof t.id).toBe("string");
      expect(t.id.length).toBeGreaterThan(0);
      expect(typeof t.title).toBe("string");
      expect(t.title.length).toBeGreaterThan(0);
      expect(typeof t.description).toBe("string");
      expect(t.description.length).toBeGreaterThan(0);
      expect(typeof t.content).toBe("string");
      expect(t.content.length).toBeGreaterThan(10);
      expect([
        "architecture",
        "engineering",
        "testing",
        "review",
        "research",
        "documentation",
      ]).toContain(t.category);
    }
  });

  it("finds a template by exact ID", () => {
    const t = getPromptTemplateById("review-architecture");
    expect(t).toBeDefined();
    expect(t?.category).toBe("architecture");
    expect(t?.title).toContain("Architectural");
  });

  it("filters templates by category", () => {
    const testingTemplates = searchPromptTemplates({ category: "testing" });
    expect(testingTemplates.length).toBeGreaterThan(0);
    for (const t of testingTemplates) {
      expect(t.category).toBe("testing");
    }
  });

  it("searches templates by text query across titles and descriptions", () => {
    const bugSearch = searchPromptTemplates({ query: "bug" });
    expect(bugSearch.length).toBeGreaterThan(0);
    expect(bugSearch.some((t) => t.id === "find-bug")).toBe(true);
  });

  it("interpolates template variables with defaults or custom values", () => {
    const template = getPromptTemplateById("write-tests");
    expect(template).toBeDefined();

    const rendered = renderPromptTemplate(template!, {
      target: "packages/core/src/intake.ts",
      framework: "bun:test",
    });

    expect(rendered).toContain("packages/core/src/intake.ts");
    expect(rendered).toContain("bun:test");
    expect(rendered).not.toContain("{{target}}");
    expect(rendered).not.toContain("{{framework}}");
  });
});
