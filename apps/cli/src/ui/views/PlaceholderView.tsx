/**
 * apps/cli/src/ui/views/PlaceholderView.tsx
 *
 * Generic workspace content container for workspaces planned in upcoming prompts.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

import React from "react";
import { TextAttributes } from "@opentui/core";
import { WORKSPACE_AREAS, type WorkspaceId } from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { DemoDataBadge } from "../components/ViewStates.js";

export interface PlaceholderViewProps {
  readonly workspaceId: WorkspaceId;
}

export function PlaceholderView({ workspaceId }: PlaceholderViewProps) {
  const meta = WORKSPACE_AREAS[workspaceId];
  if (!meta) {
    return null;
  }

  const isSimulated = workspaceId === "ecosystem" || workspaceId === "reports";

  return (
    <box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* Workspace Header */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            {meta.icon} {meta.label}
          </text>
          <text fg={THEME_COLORS.fgMuted}>
            {" "}• Planned in Prompt {meta.plannedPrompt}
          </text>
        </box>

        {isSimulated ? (
          <DemoDataBadge isSimulated={true} />
        ) : (
          <DemoDataBadge isSimulated={false} label="[PREVIEW]" />
        )}
      </box>

      {/* Description Card */}
      <box
        border={true}
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        backgroundColor={THEME_COLORS.bgCard}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <text fg={THEME_COLORS.fgSecondary}>
          {meta.description}
        </text>
      </box>

      {/* Structured preview placeholder */}
      <box
        border={true}
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        backgroundColor={THEME_COLORS.bgCard}
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD}>
          ROADMAP & SCOPE (PLAN.md Section 16):
        </text>
        <box marginTop={1} flexDirection="column">
          <text fg={THEME_COLORS.fgSecondary}>
            • Implementation sequence: Prompt {meta.plannedPrompt}
          </text>
          <text fg={THEME_COLORS.fgSecondary}>
            • Shell navigation ready: Keyboard shortcut [{meta.shortcut}]
          </text>
          <text fg={THEME_COLORS.fgSecondary}>
            • Use [Esc] or [B] to return to previous workspace
          </text>
        </box>
      </box>
    </box>
  );
}
