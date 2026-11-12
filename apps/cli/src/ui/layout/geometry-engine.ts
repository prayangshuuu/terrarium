/**
 * apps/cli/src/ui/layout/geometry-engine.ts
 *
 * Precise Terminal Geometry Engine, Box Dimension Calculator, and Responsive Breakpoint Resolver.
 *
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns strictly with PROMPT 25 Phase C & D:
 * - Single source of truth for viewport dimensions.
 * - Exact width and height calculations with zero horizontal or vertical overflow.
 * - Deliberate responsive profiles (compact, standard, wide, ultra-wide).
 * - Safe fallback for constrained terminals (<60x18).
 */

import { DESIGN_TOKENS, type TerminalBreakpoint } from "../tokens/design-system.js";

export interface TerminalGeometry {
  /** Raw terminal columns */
  readonly terminalWidth: number;
  /** Raw terminal rows */
  readonly terminalHeight: number;
  /** Responsive layout profile */
  readonly breakpoint: TerminalBreakpoint;
  /** True if viewport is below minimal readable bounds (<60x18) */
  readonly isTooSmall: boolean;
  /** True if terminal is compact (<80 cols or <24 rows) */
  readonly isCompact: boolean;
  /** True if terminal is wide (>=120 cols) */
  readonly isWide: boolean;
  /** True if terminal is ultra-wide (>=160 cols) */
  readonly isUltraWide: boolean;
  /** Width allocated to navigation sidebar (0 if collapsed or auto-hidden) */
  readonly sidebarWidth: number;
  /** Effective horizontal padding per side */
  readonly paddingX: number;
  /** Usable width for main view content */
  readonly mainContentWidth: number;
  /** Usable height for main view content */
  readonly mainContentHeight: number;
  /** Static chrome vertical height (header + footer + breadcrumbs) */
  readonly chromeHeight: number;
}

/**
 * Options for computing terminal layout geometry.
 */
export interface LayoutGeometryOptions {
  readonly terminalWidth: number;
  readonly terminalHeight: number;
  readonly isSidebarCollapsed?: boolean;
}

/**
 * Resolves responsive breakpoint from terminal dimensions.
 */
export function resolveBreakpoint(width: number, height: number): TerminalBreakpoint {
  if (width < DESIGN_TOKENS.breakpoints.standardMinWidth || height < DESIGN_TOKENS.breakpoints.compactMaxHeight + 1) {
    return "compact";
  }
  if (width < DESIGN_TOKENS.breakpoints.wideMinWidth) {
    return "standard";
  }
  if (width < DESIGN_TOKENS.breakpoints.ultraWideMinWidth) {
    return "wide";
  }
  return "ultra_wide";
}

/**
 * Computes exact terminal layout geometry from terminal dimensions.
 * Guarantees all dimensions are non-negative and account for padding, borders, and chrome.
 */
export function calculateLayoutGeometry(options: LayoutGeometryOptions): TerminalGeometry {
  const terminalWidth = Math.max(1, Math.floor(options.terminalWidth));
  const terminalHeight = Math.max(1, Math.floor(options.terminalHeight));
  const breakpoint = resolveBreakpoint(terminalWidth, terminalHeight);

  const isTooSmall =
    terminalWidth < DESIGN_TOKENS.breakpoints.minReadableWidth ||
    terminalHeight < DESIGN_TOKENS.breakpoints.minReadableHeight;

  const isCompact = breakpoint === "compact";
  const isWide = breakpoint === "wide";
  const isUltraWide = breakpoint === "ultra_wide";

  // Sidebar behavior:
  // - If manually collapsed: 0 cols
  // - If compact viewport: auto-collapse (0 cols) to give maximum room to content
  // - If narrow terminal (<100 cols): compact sidebar width (16 cols)
  // - If standard or wide: standard sidebar width (24 cols)
  let sidebarWidth = 0;
  if (!options.isSidebarCollapsed && !isCompact) {
    sidebarWidth =
      terminalWidth < DESIGN_TOKENS.breakpoints.standardMaxWidth - 19
        ? DESIGN_TOKENS.sidebar.compactWidth
        : DESIGN_TOKENS.sidebar.standardWidth;
  }

  const paddingX = isCompact ? DESIGN_TOKENS.spacing.paddingXCompact : DESIGN_TOKENS.spacing.paddingXStandard;
  const chromeHeight = DESIGN_TOKENS.structure.chromeVerticalHeight;

  // Main content width: total columns minus sidebar and divider gap
  const sidebarOverhead = sidebarWidth > 0 ? sidebarWidth + DESIGN_TOKENS.spacing.panelGap : 0;
  const mainContentWidth = Math.max(10, terminalWidth - sidebarOverhead);

  // Main content height: total rows minus header, footer, and breadcrumbs
  const mainContentHeight = Math.max(5, terminalHeight - chromeHeight);

  return {
    terminalWidth,
    terminalHeight,
    breakpoint,
    isTooSmall,
    isCompact,
    isWide,
    isUltraWide,
    sidebarWidth,
    paddingX,
    mainContentWidth,
    mainContentHeight,
    chromeHeight,
  };
}

/**
 * Splits an available width into two columns based on a ratio (e.g. 0.5 for 50/50, 0.6 for 60/40).
 * Guarantees leftWidth + rightWidth + gap <= availableWidth with zero overflow.
 */
export function splitHorizontal(
  availableWidth: number,
  leftRatio: number = 0.5,
  gap: number = 1,
  minLeftWidth: number = 20,
  minRightWidth: number = 20
): { leftWidth: number; rightWidth: number } {
  const usableWidth = Math.max(0, availableWidth - gap);
  if (usableWidth <= minLeftWidth + minRightWidth) {
    const half = Math.floor(usableWidth / 2);
    return {
      leftWidth: half,
      rightWidth: Math.max(0, usableWidth - half),
    };
  }

  let leftWidth = Math.floor(usableWidth * leftRatio);
  let rightWidth = usableWidth - leftWidth;

  if (leftWidth < minLeftWidth) {
    leftWidth = minLeftWidth;
    rightWidth = Math.max(0, usableWidth - leftWidth);
  } else if (rightWidth < minRightWidth) {
    rightWidth = minRightWidth;
    leftWidth = Math.max(0, usableWidth - rightWidth);
  }

  return { leftWidth, rightWidth };
}

/**
 * Splits available height into two regions (top and bottom) based on a ratio.
 */
export function splitVertical(
  availableHeight: number,
  topRatio: number = 0.5,
  gap: number = 1,
  minTopHeight: number = 4,
  minBottomHeight: number = 4
): { topHeight: number; bottomHeight: number } {
  const usableHeight = Math.max(0, availableHeight - gap);
  if (usableHeight <= minTopHeight + minBottomHeight) {
    const half = Math.floor(usableHeight / 2);
    return {
      topHeight: half,
      bottomHeight: Math.max(0, usableHeight - half),
    };
  }

  let topHeight = Math.floor(usableHeight * topRatio);
  let bottomHeight = usableHeight - topHeight;

  if (topHeight < minTopHeight) {
    topHeight = minTopHeight;
    bottomHeight = Math.max(0, usableHeight - topHeight);
  } else if (bottomHeight < minBottomHeight) {
    bottomHeight = minBottomHeight;
    topHeight = Math.max(0, usableHeight - bottomHeight);
  }

  return { topHeight, bottomHeight };
}

/**
 * Splits available width evenly across N columns with a gap between each.
 */
export function splitColumns(availableWidth: number, columnCount: number, gap: number = 1): number[] {
  if (columnCount <= 0) return [];
  if (columnCount === 1) return [Math.max(1, availableWidth)];

  const totalGaps = (columnCount - 1) * gap;
  const usableWidth = Math.max(0, availableWidth - totalGaps);
  const baseColWidth = Math.floor(usableWidth / columnCount);
  const remainder = usableWidth % columnCount;

  const result: number[] = [];
  for (let i = 0; i < columnCount; i++) {
    // Distribute remainder one pixel at a time to first few columns
    result.push(Math.max(1, baseColWidth + (i < remainder ? 1 : 0)));
  }

  return result;
}

export interface ColumnDefinition {
  readonly id: string;
  readonly minWidth: number;
  readonly flex?: number;
  readonly maxWidth?: number;
}

/**
 * Allocates column widths for tabular layouts fitting strictly within availableWidth.
 */
export function calculateTableColumns(
  availableWidth: number,
  definitions: readonly ColumnDefinition[],
  gap: number = 1
): Record<string, number> {
  const result: Record<string, number> = {};
  if (definitions.length === 0) return result;

  const totalGaps = (definitions.length - 1) * gap;
  let remainingWidth = Math.max(0, availableWidth - totalGaps);

  // 1. Allocate minimum widths
  let totalFlex = 0;
  for (const col of definitions) {
    const min = Math.min(col.minWidth, remainingWidth);
    result[col.id] = min;
    remainingWidth -= min;
    totalFlex += col.flex ?? 0;
  }

  // 2. Distribute leftover width according to flex factors
  if (remainingWidth > 0 && totalFlex > 0) {
    const unallocated = remainingWidth;
    for (const col of definitions) {
      if ((col.flex ?? 0) > 0) {
        const extra = Math.floor((unallocated * (col.flex ?? 0)) / totalFlex);
        const current = result[col.id] ?? 0;
        const max = col.maxWidth ?? Infinity;
        const added = Math.min(extra, max - current);
        if (added > 0) {
          result[col.id] = current + added;
          remainingWidth -= added;
        }
      }
    }
  }

  return result;
}

/**
 * Safely truncates a text string to fit a maximum column width without clipping or overflowing.
 */
export function truncateWithEllipsis(text: string, maxColumns: number): string {
  if (maxColumns <= 0) return "";
  if (text.length <= maxColumns) return text;
  if (maxColumns <= 3) return text.substring(0, maxColumns);
  return text.substring(0, maxColumns - 3) + "...";
}
