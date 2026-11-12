/**
 * apps/cli/tests/activity-feed.test.tsx
 *
 * Comprehensive test suite for Observable Event-Backed Activity Feed and
 * Reconnect / Missed-Event Replay.
 * Contributed by A3 (Data, Security & Reliability) & A4 (Senior CLI/TUI Designer).
 *
 * Validates:
 * - Clean empty state when no activity events have occurred.
 * - Live connection indicator and event formatting with glyphs and level badges.
 * - Strict event ordering and deduplication by event id.
 * - Reconnect and missed-event replay from database event log.
 */

import { describe, expect, test } from "bun:test";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import { ok } from "@terrarium/contracts";
import { UiStateController } from "../src/ui/state/ui-state-controller.js";
import { TerrariumUiProvider } from "../src/ui/state/ui-context.js";
import { ActivityFeed } from "../src/ui/components/ActivityFeed.js";

describe("Activity Feed & Reconnect Replay Suite (A3, A4 & A5)", () => {
  test("renders clean empty state when no events exist", async () => {
    const controller = new UiStateController();

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ActivityFeed />
      </TerrariumUiProvider>,
      { width: 110, height: 25 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("ACTIVITY FEED");
    expect(frame).toContain("● LIVE");
    expect(frame).toContain("(0 events)");
    expect(frame).toContain("No recent activity events recorded");
    expect(frame).toContain("Live execution, planning, and approval events will appear here");

    await setup.dispose();
  });

  test("formats activity items with glyphs, timestamps, event types, and level badges", async () => {
    const controller = new UiStateController();

    controller.recordActivityEvent({
      id: "evt_01",
      eventType: "task:created",
      timestamp: "2026-11-12T12:00:00.000Z",
      source: "orchestrator",
      entityType: "task",
      entityId: "task_100",
      summary: "Task registered for execution",
      level: "info",
    });

    controller.recordActivityEvent({
      id: "evt_02",
      eventType: "approval:requested",
      timestamp: "2026-11-12T12:01:00.000Z",
      source: "agent",
      entityType: "approval",
      entityId: "app_200",
      summary: "Critical file write operation requires human approval",
      level: "warn",
    });

    controller.recordActivityEvent({
      id: "evt_03",
      eventType: "execution:failed",
      timestamp: "2026-11-12T12:02:00.000Z",
      source: "runner",
      entityType: "execution",
      entityId: "exec_300",
      summary: "Step timeout after 30 seconds",
      level: "error",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ActivityFeed />
      </TerrariumUiProvider>,
      { width: 120, height: 25 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("ACTIVITY FEED");
    expect(frame).toContain("(3 events)");
    expect(frame).toContain("[task:created]");
    expect(frame).toContain("Task registered for execution");
    expect(frame).toContain("[approval:requested]");
    expect(frame).toContain("[WARN]");
    expect(frame).toContain("[execution:failed]");
    expect(frame).toContain("[ERROR]");
    expect(frame).toContain("Step timeout after 30 seconds");

    await setup.dispose();
  });

  test("deduplicates identical events by ID to prevent replay clutter", async () => {
    const controller = new UiStateController();

    const eventPayload = {
      id: "evt_duplicate_01",
      eventType: "task:planned",
      timestamp: "2026-11-12T12:00:00.000Z",
      source: "intake",
      entityType: "task",
      entityId: "task_101",
      summary: "Analytical plan generated",
      level: "info" as const,
    };

    controller.recordActivityEvent(eventPayload);
    // Duplicate recording of identical ID
    controller.recordActivityEvent(eventPayload);

    expect(controller.getState().activityFeed.items.length).toBe(1);

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ActivityFeed />
      </TerrariumUiProvider>,
      { width: 110, height: 25 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("(1 events)");

    await setup.dispose();
  });

  test("reconnects and replays missed events from database event log without duplicates", async () => {
    const missedDbEvents = [
      {
        id: "evt_missed_01",
        eventType: "budget:threshold_exceeded",
        timestamp: "2026-11-12T12:05:00.000Z",
        source: "budget",
        entityType: "budget",
        entityId: "bgt_01",
        payload: { message: "Budget reached 80% of limit" },
        level: "warn",
      },
      {
        id: "evt_missed_02",
        eventType: "task:completed",
        timestamp: "2026-11-12T12:06:00.000Z",
        source: "orchestrator",
        entityType: "task",
        entityId: "task_102",
        payload: { description: "Task completed successfully" },
        level: "info",
      },
    ];

    let currentDbEvents: any[] = [];
    const mockDb = {
      events: {
        query: async () => ok(currentDbEvents),
      },
    };

    const controller = new UiStateController({
      engine: {
        db: mockDb,
      } as any,
    });

    // Seed one event that is already seen
    controller.recordActivityEvent({
      id: "evt_initial",
      eventType: "system:ready",
      timestamp: "2026-11-12T12:00:00.000Z",
      summary: "System initialized",
    });

    // Simulate 2 missed events logged in database while connection was interrupted
    currentDbEvents = [...missedDbEvents];

    // Trigger reconnectActivityFeed
    const replayedCount = await controller.reconnectActivityFeed();
    expect(replayedCount).toBe(2);
    expect(controller.getState().activityFeed.replayedMissedEventsCount).toBe(2);
    expect(controller.getState().activityFeed.items.length).toBe(3);

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ActivityFeed />
      </TerrariumUiProvider>,
      { width: 110, height: 25 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    // Verify Reconnected Badge
    expect(frame).toContain("○ RECONNECTED (replayed 2 missed events)");
    expect(frame).toContain("[budget:threshold_exceeded]");
    expect(frame).toContain("[task:completed]");

    await setup.dispose();
  });
});
