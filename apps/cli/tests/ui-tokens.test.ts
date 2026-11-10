/**
 * apps/cli/tests/ui-tokens.test.ts
 *
 * Unit tests for design tokens, semantic color mappings, and terminal layout metrics.
 * Contributed by A5 (Senior Frontend/Product Interface Designer).
 */

import { describe, expect, it } from "bun:test";
import {
  THEME_COLORS,
  getSemanticColor,
  GLYPHS,
  ASCII_FALLBACKS,
  getGlyph,
  LAYOUT_METRICS,
} from "../src/ui/tokens/index.js";

describe("UI Design Tokens & Palette Suite (A5)", () => {
  it("provides restrained dark slate theme colors with required contrast tiers", () => {
    expect(THEME_COLORS.bgApp).toBe("#0B0F17");
    expect(THEME_COLORS.bgCard).toBe("#131B26");
    expect(THEME_COLORS.fgPrimary).toBe("#F8FAFC");
    expect(THEME_COLORS.fgSecondary).toBe("#94A3B8");
    expect(THEME_COLORS.borderSubtle).toBe("#1E293B");
    expect(THEME_COLORS.borderFocused).toBe("#38BDF8");
  });

  it("maps semantic status colors accurately to accessibility guidelines", () => {
    expect(getSemanticColor("success")).toBe(THEME_COLORS.statusSuccess);
    expect(getSemanticColor("warning")).toBe(THEME_COLORS.statusWarning);
    expect(getSemanticColor("danger")).toBe(THEME_COLORS.statusDanger);
    expect(getSemanticColor("info")).toBe(THEME_COLORS.statusInfo);
    expect(getSemanticColor("simulated")).toBe(THEME_COLORS.statusSimulated);
    expect(getSemanticColor("approval")).toBe(THEME_COLORS.statusApproval);
  });

  it("provides distinct color tokens for simulated customer personas per PLAN_CONTEXT.md", () => {
    // Simulated persona color must be distinct from verified/confirmed colors
    expect(THEME_COLORS.statusSimulated).not.toBe(THEME_COLORS.statusSuccess);
    expect(THEME_COLORS.statusSimulated).toBe("#C084FC");
    expect(THEME_COLORS.deptCustomerIntelligence).toBe("#C084FC");
  });

  it("provides glyphs and reliable ASCII fallbacks", () => {
    expect(getGlyph("brandLogo", true)).toBe("◈");
    expect(getGlyph("brandLogo", false)).toBe("*");

    expect(getGlyph("statusSuccess", true)).toBe("✓");
    expect(getGlyph("statusSuccess", false)).toBe("OK");

    expect(getGlyph("simulatedTag", true)).toBe("[SIMULATED]");
    expect(getGlyph("simulatedTag", false)).toBe("[SIMULATED]");
  });

  it("defines standard terminal dimension limits and responsive thresholds", () => {
    expect(LAYOUT_METRICS.minTerminalWidth).toBe(80);
    expect(LAYOUT_METRICS.minTerminalHeight).toBe(20);
    expect(LAYOUT_METRICS.narrowTerminalWidth).toBe(100);
    expect(LAYOUT_METRICS.headerHeight).toBe(3);
    expect(LAYOUT_METRICS.footerHeight).toBe(2);
  });
});
