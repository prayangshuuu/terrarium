/**
 * apps/cli/src/ui/components/ResponsiveContainer.tsx
 *
 * Terminal dimension observer, responsive layout manager, and narrow display adapter.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import React, { type ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { TextAttributes } from "@opentui/core";
import { LAYOUT_METRICS } from "../tokens/index.js";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";

export interface ResponsiveContainerProps {
  readonly children: (dimensions: {
    width: number;
    height: number;
    isNarrow: boolean;
    isTooSmall: boolean;
  }) => ReactNode;
  readonly forcedWidth?: number;
  readonly forcedHeight?: number;
}

export function ResponsiveContainer({
  children,
  forcedWidth,
  forcedHeight,
}: ResponsiveContainerProps) {
  let terminalWidth = 100;
  let terminalHeight = 30;

  try {
    const dims = useTerminalDimensions();
    if (dims && dims.width > 0 && dims.height > 0) {
      terminalWidth = dims.width;
      terminalHeight = dims.height;
    }
  } catch {
    // Fallback if not inside OpenTUI active terminal runtime (e.g. standard tests)
  }

  const width = forcedWidth ?? terminalWidth;
  const height = forcedHeight ?? terminalHeight;

  const isTooSmall = width < LAYOUT_METRICS.minTerminalWidth || height < LAYOUT_METRICS.minTerminalHeight;
  const isNarrow = width < LAYOUT_METRICS.narrowTerminalWidth;

  return (
    <box flexDirection="column" flexGrow={1} width="100%" height="100%">
      {/* Warning banner when terminal is below minimum size */}
      {isTooSmall && (
        <box
          backgroundColor={THEME_COLORS.bgCardElevated}
          border={["bottom"]}
          borderStyle="single"
          borderColor={THEME_COLORS.statusWarning}
          paddingX={1}
        >
          <text fg={THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD}>
            {GLYPHS.statusWarning} Terminal {width}x{height} (Recommended min: 80x20)
          </text>
        </box>
      )}

      {children({ width, height, isNarrow, isTooSmall })}
    </box>
  );
}
