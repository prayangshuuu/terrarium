/**
 * apps/cli/src/ui/components/CommandPalette.tsx
 *
 * Keyboard-first command palette overlay modal.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import React from "react";
import { TextAttributes } from "@opentui/core";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";

export function CommandPalette() {
  const { state, controller } = useTerrariumUi();

  if (!state.isCommandPaletteOpen) {
    return null;
  }

  const items = controller.getCommandPaletteItems();
  const maxVisibleItems = 8;
  const selectedIndex = Math.min(state.selectedPaletteIndex, Math.max(0, items.length - 1));

  const visibleItems = items.slice(0, maxVisibleItems);

  return (
    <box
      position="absolute"
      top={3}
      left="15%"
      width="70%"
      minWidth={50}
      maxWidth={80}
      flexDirection="column"
      border={true}
      borderStyle="rounded"
      borderColor={THEME_COLORS.borderFocused}
      backgroundColor={THEME_COLORS.bgCardElevated}
      paddingX={1}
      paddingY={1}
      zIndex={100}
    >
      {/* Palette Title */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
          {GLYPHS.search} Command Palette
        </text>
        <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
          [Esc] to close
        </text>
      </box>

      {/* Filter / Query Display */}
      <box
        border={true}
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        backgroundColor={THEME_COLORS.bgInput}
        paddingX={1}
        marginBottom={1}
      >
        <text fg={THEME_COLORS.fgPrimary}>
          {"> " + (state.paletteQuery || "Type to filter commands...")}
        </text>
      </box>

      {/* Item List */}
      <box flexDirection="column">
        {items.length === 0 ? (
          <box paddingY={1}>
            <text fg={THEME_COLORS.fgMuted}>No commands found matching "{state.paletteQuery}"</text>
          </box>
        ) : (
          visibleItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const itemBg = isSelected ? THEME_COLORS.bgActive : "transparent";
            const fgColor = isSelected ? THEME_COLORS.statusInfo : THEME_COLORS.fgPrimary;

            return (
              <box
                key={item.id}
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                backgroundColor={itemBg}
                paddingX={1}
              >
                <box flexDirection="row" alignItems="center">
                  <text fg={isSelected ? THEME_COLORS.statusInfo : THEME_COLORS.fgDim}>
                    {isSelected ? GLYPHS.navArrow + " " : "  "}
                  </text>
                  <text fg={fgColor} attributes={isSelected ? TextAttributes.BOLD : TextAttributes.NONE}>
                    {item.title}
                  </text>
                </box>

                {item.shortcut ? (
                  <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.DIM}>
                    {item.shortcut}
                  </text>
                ) : null}
              </box>
            );
          })
        )}
      </box>

      {/* Footer Navigation Hints */}
      <box marginTop={1} flexDirection="row" justifyContent="space-between">
        <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
          [↑ / ↓] Navigate  [Enter] Execute  [Esc] Cancel
        </text>
        <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
          {items.length} {items.length === 1 ? "command" : "commands"}
        </text>
      </box>
    </box>
  );
}
