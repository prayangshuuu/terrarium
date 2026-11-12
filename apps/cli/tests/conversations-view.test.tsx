/**
 * apps/cli/tests/conversations-view.test.tsx
 *
 * Comprehensive test suite for Workspace 4: Conversations, Multi-Agent Debates
 * and Interview Sessions.
 * Contributed by A2 (Orchestration & AI Runtime) & A4 (Senior CLI/TUI Designer).
 *
 * Validates:
 * - Clean new-install empty state when zero sessions exist.
 * - Message role separation (user, agent, tool, system).
 * - Multi-agent debate support with preserved specialist disagreements.
 * - Epistemic uncertainty indicators.
 * - Prominent [SIMULATED] labeling on synthetic customer persona content.
 * - Session list navigation and interactive message creation.
 */

import { describe, expect, test } from "bun:test";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import {
  type Session,
  type ConversationMessageUI,
} from "@terrarium/contracts";
import { UiStateController } from "../src/ui/state/ui-state-controller.js";
import { TerrariumUiProvider } from "../src/ui/state/ui-context.js";
import { ConversationsView } from "../src/ui/views/ConversationsView.js";

describe("Conversations & Multi-Agent Debates Suite (A2, A4 & A5)", () => {
  test("renders clean new-install empty state when zero sessions exist", async () => {
    const controller = new UiStateController({
      initialWorkspace: "conversations",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ConversationsView />
      </TerrariumUiProvider>,
      { width: 110, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("CONVERSATIONS & MULTI-AGENT DEBATES");
    expect(frame).toContain("NO SESSIONS ACTIVE");
    expect(frame).toContain("Clean installation: No chat sessions");
    expect(frame).toContain("Press [n] to create a new interactive conversation session.");

    await setup.dispose();
  });

  test("renders populated session list and messages separating user, agent, tool, and system roles", async () => {
    const session: Session = {
      id: "sess_01",
      title: "Storage Engine Architecture Debate",
      mode: "interactive",
      status: "active",
      participantAgentIds: ["sophia_chen", "marcus_vance"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const messages: ConversationMessageUI[] = [
      {
        id: "msg_01",
        sessionId: session.id,
        senderId: "user",
        senderName: "User",
        senderType: "user",
        role: "user",
        content: "Should we migrate from SQLite to Postgres for our state persistence layer?",
        timestamp: new Date().toISOString(),
        isSimulatedPersona: false,
      },
      {
        id: "msg_02",
        sessionId: session.id,
        senderId: "sophia_chen",
        senderName: "Sophia Chen",
        senderRole: "Staff Software Architect",
        senderDepartment: "engineering",
        senderType: "agent",
        role: "assistant",
        content: "SQLite with WAL mode satisfies our low latency requirements with zero network roundtrips.",
        timestamp: new Date().toISOString(),
        isSimulatedPersona: false,
      },
      {
        id: "msg_03",
        sessionId: session.id,
        senderId: "tool_bench",
        senderName: "benchmark_tool",
        senderType: "system",
        role: "tool",
        content: "Benchmark results: SQLite read p99: 0.12ms, Postgres read p99: 1.45ms",
        timestamp: new Date().toISOString(),
        isSimulatedPersona: false,
        toolCalls: [{ name: "benchmark_runner", riskLevel: "low", isConsequential: false }],
      },
    ];

    const controller = new UiStateController({
      initialWorkspace: "conversations",
    });

    (controller as any).setState({
      sessions: [session],
      selectedSessionId: session.id,
      selectedSessionIndex: 0,
      sessionMessages: messages,
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ConversationsView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("Storage Engine Architecture Debate");
    expect(frame).toContain("You");
    expect(frame).toContain("Should we migrate from SQLite to Postgres");
    expect(frame).toContain("[AGENT] Sophia Chen");
    expect(frame).toContain("SQLite with WAL mode satisfies our low latency");
    expect(frame).toContain("[TOOL]");
    expect(frame).toContain("Benchmark results: SQLite read p99: 0.12ms");
    expect(frame).toContain("Tool executed: benchmark_runner");

    await setup.dispose();
  });

  test("preserves specialist disagreements and epistemic uncertainty indicators in debate", async () => {
    const session: Session = {
      id: "sess_debate",
      title: "Consensus & Trade-off Review",
      mode: "cross_functional",
      status: "active",
      participantAgentIds: ["elena_rostova", "alex_rivera"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const messages: ConversationMessageUI[] = [
      {
        id: "msg_debate_01",
        sessionId: session.id,
        senderId: "elena_rostova",
        senderName: "Elena Rostova",
        senderRole: "Chief Executive Officer",
        senderDepartment: "executive",
        senderType: "agent",
        role: "assistant",
        content: "We need to accelerate delivery of autonomous multi-agent task execution.",
        timestamp: new Date().toISOString(),
        isSimulatedPersona: false,
        disagreements: [
          {
            specialist: "Alex Rivera (Lead Security Engineer)",
            argument: "Releasing full autonomy without consequential action approval gates introduces unmitigated blast radius.",
          },
        ],
        uncertaintyLevel: "medium",
        uncertaintyExplanation: "Enterprise client compliance constraints not yet finalized.",
      },
    ];

    const controller = new UiStateController({
      initialWorkspace: "conversations",
    });

    (controller as any).setState({
      sessions: [session],
      selectedSessionId: session.id,
      selectedSessionIndex: 0,
      sessionMessages: messages,
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ConversationsView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    // Verify Preserved Specialist Disagreement
    expect(frame).toContain("PRESERVED SPECIALIST DISAGREEMENT");
    expect(frame).toContain("Alex Rivera (Lead Security Engineer)");
    expect(frame).toContain("unmitigated blast radius");

    // Verify Epistemic Uncertainty Badge
    expect(frame).toContain("[UNCERTAINTY: MEDIUM]");
    expect(frame).toContain("Enterprise client compliance constraints not yet finalized");

    await setup.dispose();
  });

  test("prominently labels simulated customer persona content with [SIMULATED]", async () => {
    const session: Session = {
      id: "sess_cust",
      title: "Simulated Customer Focus Group",
      mode: "focused",
      status: "active",
      participantAgentIds: ["customer_enterprise_buyer"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const messages: ConversationMessageUI[] = [
      {
        id: "msg_cust_01",
        sessionId: session.id,
        senderId: "persona_sarah",
        senderName: "Sarah Jenkins (Enterprise CISO)",
        senderRole: "Simulated Enterprise Buyer",
        senderDepartment: "customer_intelligence",
        senderType: "agent",
        role: "assistant",
        content: "Our procurement team requires SOC 2 Type II attestation before any pilot deployment.",
        timestamp: new Date().toISOString(),
        isSimulatedPersona: true,
      },
    ];

    const controller = new UiStateController({
      initialWorkspace: "conversations",
    });

    (controller as any).setState({
      sessions: [session],
      selectedSessionId: session.id,
      selectedSessionIndex: 0,
      sessionMessages: messages,
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ConversationsView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    // Verify prominent [SIMULATED] badge
    expect(frame).toContain("[SIMULATED]");
    expect(frame).toContain("Sarah Jenkins (Enterprise CISO)");
    expect(frame).toContain("Our procurement team requires SOC 2");

    await setup.dispose();
  });

  test("creates a new session on 'n' hotkey", async () => {
    const controller = new UiStateController({
      initialWorkspace: "conversations",
    });

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ConversationsView />
      </TerrariumUiProvider>,
      { width: 120, height: 35 }
    );

    await setup.renderOnce();

    // Press 'n' to trigger createSession
    setup.mockInput.pressKey("n");
    await setup.renderOnce();

    expect(controller.getState().sessions.length).toBe(1);
    expect(controller.getState().sessions[0]?.title).toBe("Session #1");

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Session #1");

    await setup.dispose();
  });
});
