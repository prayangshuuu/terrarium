/**
 * apps/cli/src/ui/tokens/design-system.ts
 *
 * Central Terminal Design System tokens, responsive breakpoints, spacing rules,
 * and component dimension bounds for TERRARIUM.
 *
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns strictly with PROMPT 25 Phase B: Minimal, calm, precise, emoji-free terminal product.
 */

import { THEME_COLORS, type ThemeColorName } from "./colors.js";
import { GLYPHS } from "./glyphs.js";

export { THEME_COLORS, GLYPHS, type ThemeColorName };

/**
 * Responsive Terminal Breakpoint Classifications.
 */
export type TerminalBreakpoint = "compact" | "standard" | "wide" | "ultra_wide";

/**
 * Central design tokens for dimensions, spacing, and geometry.
 */
export const DESIGN_TOKENS = {
  // Terminal Responsive Breakpoints (columns and rows)
  breakpoints: {
    minReadableWidth: 60,
    minReadableHeight: 18,
    compactMaxWidth: 79,
    compactMaxHeight: 23,
    standardMinWidth: 80,
    standardMaxWidth: 119,
    wideMinWidth: 120,
    wideMaxWidth: 159,
    ultraWideMinWidth: 160,
  },

  // Fixed Structural Regions (in terminal rows)
  structure: {
    headerHeight: 3,
    footerHeight: 2,
    breadcrumbsHeight: 2,
    // Total vertical space consumed by static app chrome
    chromeVerticalHeight: 7,
  },

  // Sidebar Dimensions (columns)
  sidebar: {
    standardWidth: 24,
    compactWidth: 16,
    collapsedWidth: 0,
    minContentWidth: 40,
  },

  // Spacing & Padding
  spacing: {
    paddingXCompact: 1,
    paddingXStandard: 2,
    paddingY: 1,
    panelGap: 1,
    sectionGap: 1,
    itemGap: 0,
  },

  // Content Width Constraints (prevents excessive line-length on ultra-wide monitors)
  content: {
    maxReadableWidth: 160,
    maxCardWidth: 140,
    commandPaletteWidth: 64,
    commandPaletteHeight: 16,
    modalMaxWidth: 80,
    modalMaxHeight: 22,
  },

  // Visual Hierarchy & Typography Weights
  hierarchy: {
    headingUnderline: "─",
    doubleDivider: "═",
    singleDivider: "─",
    dottedDivider: "┄",
  },
} as const;
