/**
 * apps/cli/src/ui/components/HelpModal.tsx
 *
 * Keyboard shortcuts, navigation reference, and operating guidelines modal.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import React from "react";
import { TextAttributes } from "@opentui/core";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";

export function HelpModal() {
  const { state } = useTerrariumUi();

  if (!state.isHelpModalOpen) {
    return null;
  }

  const shortcuts = [
    { key: "1 - 9, 0", action: "Direct jump to Workspaces 1 through 10" },
    { key: "Tab / Shift+Tab", action: "Cycle focus between navigation and content" },
    { key: "↑ / ↓ / [ / ]", action: "Navigate items in active list" },
    { key: "Ctrl + K / /", action: "Open Command Palette search launcher" },
    { key: "Esc / B / Backspace", action: "Navigate back in history or close active modal" },
    { key: "Ctrl + B", action: "Toggle navigation sidebar collapsed state" },
    { key: "? / F1", action: "Toggle this Keyboard Help reference" },
    { key: "Q / Ctrl + C", action: "Quit Terrarium interactive terminal shell" },
  ];

  return (
    <box
      position="absolute"
      top={2}
      left="15%"
      width="70%"
      minWidth={55}
      maxWidth={85}
      flexDirection="column"
      border={true}
      borderStyle="rounded"
      borderColor={THEME_COLORS.borderFocused}
      backgroundColor={THEME_COLORS.bgCardElevated}
      paddingX={2}
      paddingY={1}
      zIndex={100}
    >
      {/* Modal Header */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
          {GLYPHS.help} TERRARIUM Keyboard & Navigation Reference
        </text>
        <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
          [Esc] to close
        </text>
      </box>

      {/* Intro line */}
      <box marginBottom={1}>
        <text fg={THEME_COLORS.fgSecondary}>
          Keyboard-first multi-agent orchestration shell. Fast access via direct hotkeys:
        </text>
      </box>

      {/* Shortcuts Grid */}
      <box flexDirection="column" marginBottom={1}>
        {shortcuts.map((sc) => (
          <box key={sc.key} flexDirection="row" justifyContent="space-between" paddingY={0}>
            <text fg={THEME_COLORS.statusAccent} attributes={TextAttributes.BOLD}>
              {sc.key.padEnd(20)}
            </text>
            <text fg={THEME_COLORS.fgPrimary}>
              {sc.action}
            </text>
          </box>
        ))}
      </box>

      {/* Core Principles reminder per PLAN.md */}
      <box
        border={["top"]}
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        paddingTop={1}
        flexDirection="column"
      >
        <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.DIM}>
          • Demand-based execution: Agents activate only on task demand.
        </text>
        <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.DIM}>
          • Consequential actions require explicit human approval before execution.
        </text>
        <text fg={THEME_COLORS.statusSimulated} attributes={TextAttributes.DIM}>
          • Simulated customer feedback is clearly labeled {GLYPHS.simulatedTag}.
        </text>
      </box>
    </box>
  );
}
