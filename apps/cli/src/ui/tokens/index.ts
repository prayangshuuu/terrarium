/**
 * apps/cli/src/ui/tokens/index.ts
 *
 * Central design tokens, geometry metrics, and glyphs barrel export.
 * Contributed by A4 & A5.
 */

export * from "./colors.js";
export * from "./glyphs.js";
export * from "./design-system.js";

import { DESIGN_TOKENS } from "./design-system.js";

/**
 * Standard terminal layout bounds and breakpoints (backwards-compatible alias).
 */
export const LAYOUT_METRICS = {
  minTerminalWidth: DESIGN_TOKENS.breakpoints.standardMinWidth,
  minTerminalHeight: 20,
  narrowTerminalWidth: 100,
  compactSidebarWidth: DESIGN_TOKENS.sidebar.compactWidth,
  standardSidebarWidth: DESIGN_TOKENS.sidebar.standardWidth,
  headerHeight: DESIGN_TOKENS.structure.headerHeight,
  footerHeight: DESIGN_TOKENS.structure.footerHeight,
  maxContentWidth: DESIGN_TOKENS.content.maxReadableWidth,
  commandPaletteWidth: DESIGN_TOKENS.content.commandPaletteWidth,
  commandPaletteHeight: DESIGN_TOKENS.content.commandPaletteHeight,
  modalMaxHeight: DESIGN_TOKENS.content.modalMaxHeight,
} as const;
