/**
 * apps/cli/src/ui/components/ActivityFeed.tsx
 *
 * Observable, event-backed Activity Feed with strict event ordering,
 * deduplication, and reconnect / missed-event replay handling.
 * Contributed by A3 (Data, Security & Reliability) & A4 (Senior CLI/TUI Designer).
 *
 * PLAN.md Section 16 & PROMPT 16:
 * - Real-time stream of orchestration and system events.
 * - Shows connection status (Live, Reconnected, Disconnected).
 * - Distinguishes task, execution, approval, tool, and budget events.
 * - Handles reconnection and replays missed events without duplicates.
 */

import React from "react";
import { TextAttributes } from "@opentui/core";
import { type ActivityFeedEventUI } from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";

export interface ActivityFeedProps {
  readonly title?: string;
  readonly maxItems?: number;
  readonly compact?: boolean;
}

export function ActivityFeed({
  title = "ACTIVITY FEED",
  maxItems = 20,
  compact = false,
}: ActivityFeedProps) {
  const { state, controller } = useTerrariumUi();
  const feed = state.activityFeed;
  const items = feed.items.slice(0, maxItems);

  const formatTime = (isoString?: string): string => {
    if (!isoString) return "--:--:--";
    try {
      return new Date(isoString).toLocaleTimeString();
    } catch {
      return isoString.slice(11, 19) || "--:--:--";
    }
  };

  const getEventColor = (colorName: ActivityFeedEventUI["color"]): string => {
    switch (colorName) {
      case "blue":
        return THEME_COLORS.statusInfo;
      case "green":
        return THEME_COLORS.statusSuccess;
      case "yellow":
        return THEME_COLORS.statusWarning;
      case "red":
        return THEME_COLORS.statusDanger;
      case "magenta":
        return THEME_COLORS.statusAccent;
      case "cyan":
      default:
        return THEME_COLORS.statusInfo;
    }
  };

  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="single"
      borderColor={THEME_COLORS.borderDefault}
      backgroundColor={THEME_COLORS.bgCard}
      paddingX={1}
      paddingY={compact ? 0 : 1}
      flexGrow={compact ? 0 : 1}
    >
      {/* 1. Feed Header: Title, Connection Status, and Replay Counts */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
            {GLYPHS.brandPulse} {title}
          </text>
          <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
            {" "}({feed.items.length} events)
          </text>
        </box>

        <box flexDirection="row" alignItems="center">
          {feed.replayedMissedEventsCount > 0 ? (
            <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
              ○ RECONNECTED (replayed {feed.replayedMissedEventsCount} missed events)
            </text>
          ) : feed.isConnected ? (
            <text fg={THEME_COLORS.statusSuccess} attributes={TextAttributes.BOLD}>
              ● LIVE
            </text>
          ) : (
            <text fg={THEME_COLORS.statusDanger} attributes={TextAttributes.BOLD}>
              ○ DISCONNECTED
            </text>
          )}
        </box>
      </box>

      {/* 2. Event Stream List */}
      {items.length === 0 ? (
        <box flexDirection="column" paddingY={1} alignItems="center" justifyContent="center">
          <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.ITALIC}>
            No recent activity events recorded.
          </text>
          <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.DIM}>
            Live execution, planning, and approval events will appear here in real time.
          </text>
        </box>
      ) : (
        <box flexDirection="column">
          {items.map((event) => {
            const timeStr = formatTime(event.timestamp);
            const eventColor = getEventColor(event.color);
            return (
              <box
                key={event.id}
                flexDirection="row"
                alignItems="center"
                justifyContent="space-between"
                marginBottom={0}
              >
                <box flexDirection="row" alignItems="center">
                  <text fg={eventColor} attributes={TextAttributes.BOLD}>
                    {event.glyph}{" "}
                  </text>
                  <text fg={THEME_COLORS.fgDim}>[{timeStr}] </text>
                  <text fg={eventColor} attributes={TextAttributes.BOLD}>
                    [{event.eventType}]
                  </text>
                  <text fg={THEME_COLORS.fgPrimary}>
                    {" "}{event.summary.length > 40 ? `${event.summary.slice(0, 37)}...` : event.summary}
                  </text>
                </box>

                <box flexDirection="row" alignItems="center">
                  {event.entityType && (
                    <text fg={THEME_COLORS.fgDim}>
                      {event.entityType}:{event.entityId ? event.entityId.slice(0, 8) : "*"}
                    </text>
                  )}
                  {event.level === "error" ? (
                    <text fg={THEME_COLORS.statusDanger} attributes={TextAttributes.BOLD}>
                      {" "}[ERROR]
                    </text>
                  ) : event.level === "warn" ? (
                    <text fg={THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD}>
                      {" "}[WARN]
                    </text>
                  ) : null}
                </box>
              </box>
            );
          })}
        </box>
      )}
    </box>
  );
}
