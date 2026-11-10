/**
 * apps/cli/src/ui/tokens/index.ts
 *
 * Design tokens and layout metrics barrel export.
 * Contributed by A4 & A5.
 */

export * from "./colors.js";
export * from "./glyphs.js";

/**
 * Standard terminal layout bounds and breakpoints.
 */
export const LAYOUT_METRICS = {
  minTerminalWidth: 80,
  minTerminalHeight: 20,
  narrowTerminalWidth: 100,
  compactSidebarWidth: 16,
  standardSidebarWidth: 26,
  headerHeight: 3,
  footerHeight: 2,
  maxContentWidth: 160,
  commandPaletteWidth: 64,
  commandPaletteHeight: 16,
  modalMaxHeight: 22,
} as const;
