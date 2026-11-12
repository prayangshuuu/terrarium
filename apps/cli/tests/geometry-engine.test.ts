/**
 * apps/cli/tests/geometry-engine.test.ts
 *
 * Comprehensive unit and geometry calculation tests for the Terminal Geometry Engine.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns strictly with PROMPT 25 Phase C, D, and L.
 */

import { describe, expect, it } from "bun:test";
import {
  calculateLayoutGeometry,
  resolveBreakpoint,
  splitHorizontal,
  splitVertical,
  splitColumns,
  calculateTableColumns,
  truncateWithEllipsis,
} from "../src/ui/layout/geometry-engine.js";

describe("Terminal Geometry Engine (PROMPT 25 Phase C & D)", () => {
  describe("Breakpoint Resolution", () => {
    it("classifies viewports below 80 columns as compact", () => {
      expect(resolveBreakpoint(60, 24)).toBe("compact");
      expect(resolveBreakpoint(79, 30)).toBe("compact");
    });

    it("classifies viewports below 24 rows as compact regardless of width", () => {
      expect(resolveBreakpoint(100, 20)).toBe("compact");
      expect(resolveBreakpoint(140, 22)).toBe("compact");
      expect(resolveBreakpoint(200, 18)).toBe("compact");
    });

    it("classifies 80-119 columns (>=24 rows) as standard", () => {
      expect(resolveBreakpoint(80, 24)).toBe("standard");
      expect(resolveBreakpoint(100, 30)).toBe("standard");
      expect(resolveBreakpoint(119, 40)).toBe("standard");
    });

    it("classifies 120-159 columns (>=24 rows) as wide", () => {
      expect(resolveBreakpoint(120, 30)).toBe("wide");
      expect(resolveBreakpoint(140, 40)).toBe("wide");
      expect(resolveBreakpoint(159, 45)).toBe("wide");
    });

    it("classifies 160+ columns (>=24 rows) as ultra_wide", () => {
      expect(resolveBreakpoint(160, 50)).toBe("ultra_wide");
      expect(resolveBreakpoint(200, 60)).toBe("ultra_wide");
    });
  });

  describe("calculateLayoutGeometry Matrix Tests", () => {
    it("handles 60 columns x 18 rows (compact boundary)", () => {
      const geo = calculateLayoutGeometry({ terminalWidth: 60, terminalHeight: 18 });
      expect(geo.breakpoint).toBe("compact");
      expect(geo.isTooSmall).toBe(false);
      expect(geo.isCompact).toBe(true);
      expect(geo.sidebarWidth).toBe(0); // Auto-collapsed in compact
      expect(geo.paddingX).toBe(1);
      expect(geo.mainContentWidth).toBe(60);
      expect(geo.mainContentHeight).toBe(18 - 7); // 11 rows
    });

    it("detects severely constrained viewport (<60x18)", () => {
      const geo1 = calculateLayoutGeometry({ terminalWidth: 55, terminalHeight: 25 });
      expect(geo1.isTooSmall).toBe(true);

      const geo2 = calculateLayoutGeometry({ terminalWidth: 90, terminalHeight: 15 });
      expect(geo2.isTooSmall).toBe(true);
    });

    it("handles 80 columns x 24 rows (standard terminal standard min)", () => {
      const geo = calculateLayoutGeometry({ terminalWidth: 80, terminalHeight: 24 });
      expect(geo.breakpoint).toBe("standard");
      expect(geo.isTooSmall).toBe(false);
      expect(geo.sidebarWidth).toBe(16); // compact sidebar on <100 cols
      expect(geo.paddingX).toBe(2);
      expect(geo.mainContentWidth).toBe(80 - 16 - 1); // 63 cols
      expect(geo.mainContentHeight).toBe(24 - 7); // 17 rows
    });

    it("handles 100 columns x 30 rows (standard)", () => {
      const geo = calculateLayoutGeometry({ terminalWidth: 100, terminalHeight: 30 });
      expect(geo.breakpoint).toBe("standard");
      expect(geo.sidebarWidth).toBe(24); // standard sidebar
      expect(geo.mainContentWidth).toBe(100 - 24 - 1); // 75 cols
      expect(geo.mainContentHeight).toBe(30 - 7); // 23 rows
    });

    it("handles 120 columns x 40 rows (wide)", () => {
      const geo = calculateLayoutGeometry({ terminalWidth: 120, terminalHeight: 40 });
      expect(geo.breakpoint).toBe("wide");
      expect(geo.isWide).toBe(true);
      expect(geo.sidebarWidth).toBe(24);
      expect(geo.mainContentWidth).toBe(120 - 24 - 1); // 95 cols
      expect(geo.mainContentHeight).toBe(40 - 7); // 33 rows
    });

    it("handles 160 columns x 50 rows (ultra-wide)", () => {
      const geo = calculateLayoutGeometry({ terminalWidth: 160, terminalHeight: 50 });
      expect(geo.breakpoint).toBe("ultra_wide");
      expect(geo.isUltraWide).toBe(true);
      expect(geo.sidebarWidth).toBe(24);
      expect(geo.mainContentWidth).toBe(160 - 24 - 1); // 135 cols
      expect(geo.mainContentHeight).toBe(50 - 7); // 43 rows
    });

    it("handles 200 columns x 60 rows (large monitor)", () => {
      const geo = calculateLayoutGeometry({ terminalWidth: 200, terminalHeight: 60 });
      expect(geo.breakpoint).toBe("ultra_wide");
      expect(geo.mainContentWidth).toBe(200 - 24 - 1); // 175 cols
      expect(geo.mainContentHeight).toBe(60 - 7); // 53 rows
    });

    it("expands mainContentWidth when sidebar is explicitly collapsed", () => {
      const geo = calculateLayoutGeometry({
        terminalWidth: 100,
        terminalHeight: 30,
        isSidebarCollapsed: true,
      });
      expect(geo.sidebarWidth).toBe(0);
      expect(geo.mainContentWidth).toBe(100);
    });
  });

  describe("splitHorizontal Partitioning", () => {
    it("splits evenly with gap", () => {
      const { leftWidth, rightWidth } = splitHorizontal(100, 0.5, 1);
      expect(leftWidth + rightWidth + 1).toBe(100);
      expect(leftWidth).toBe(49);
      expect(rightWidth).toBe(50);
    });

    it("splits with 60/40 ratio", () => {
      const { leftWidth, rightWidth } = splitHorizontal(100, 0.6, 1);
      expect(leftWidth + rightWidth + 1).toBe(100);
      expect(leftWidth).toBe(59);
      expect(rightWidth).toBe(40);
    });

    it("enforces minimum widths on tight spaces", () => {
      const { leftWidth, rightWidth } = splitHorizontal(50, 0.8, 1, 25, 20);
      expect(leftWidth + rightWidth + 1).toBe(50);
      expect(leftWidth).toBeGreaterThanOrEqual(25);
      expect(rightWidth).toBeGreaterThanOrEqual(20);
    });
  });

  describe("splitVertical Partitioning", () => {
    it("splits vertical space proportionally without overflow", () => {
      const { topHeight, bottomHeight } = splitVertical(30, 0.6, 1);
      expect(topHeight + bottomHeight + 1).toBe(30);
      expect(topHeight).toBe(17);
      expect(bottomHeight).toBe(12);
    });
  });

  describe("splitColumns Distribution", () => {
    it("splits available width into N equal columns with gaps", () => {
      const cols = splitColumns(100, 3, 1);
      expect(cols.length).toBe(3);
      const totalUsed = cols.reduce((sum, w) => sum + w, 0) + 2 * 1;
      expect(totalUsed).toBe(100);
    });

    it("handles single column gracefully", () => {
      const cols = splitColumns(80, 1, 1);
      expect(cols).toEqual([80]);
    });
  });

  describe("calculateTableColumns", () => {
    it("allocates table column widths fitting strictly within available width", () => {
      const cols = calculateTableColumns(100, [
        { id: "id", minWidth: 20 },
        { id: "name", minWidth: 25, flex: 1 },
        { id: "dept", minWidth: 20 },
        { id: "status", minWidth: 15, flex: 1 },
      ], 1);

      const totalWidth = Object.values(cols).reduce((a, b) => a + b, 0) + 3; // 3 gaps
      expect(totalWidth).toBeLessThanOrEqual(100);
      expect(cols["id"]).toBe(20);
      expect(cols["name"]!).toBeGreaterThanOrEqual(25);
      expect(cols["dept"]).toBe(20);
      expect(cols["status"]!).toBeGreaterThanOrEqual(15);
    });
  });

  describe("truncateWithEllipsis", () => {
    it("preserves strings that fit within max columns", () => {
      expect(truncateWithEllipsis("short", 10)).toBe("short");
    });

    it("truncates with ellipsis when string exceeds max columns", () => {
      expect(truncateWithEllipsis("a very long string that should be truncated", 15)).toBe("a very long ...");
      expect("a very long ...".length).toBe(15);
    });
  });
});
