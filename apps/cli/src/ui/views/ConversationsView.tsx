/**
 * apps/cli/src/ui/views/ConversationsView.tsx
 *
 * Workspace 4: Conversations, Multi-Agent Debates & Interview Sessions.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer),
 * with role separation and debate tracking by A2, and simulated persona guarantees by A3.
 *
 * PLAN.md Section 7, Section 13 & Section 16; PROMPT 16:
 * - Separates user, agent, tool, and system messages with distinct visual hierarchies.
 * - Supports multi-agent debates with preserved specialist disagreements.
 * - Highlights epistemic uncertainty indicators (missing facts, confidence).
 * - Prominently labels simulated customer content [SIMULATED].
 * - Clean new-install empty state when no sessions exist.
 */

import React, { useState, useCallback } from "react";
import { TextAttributes, type KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import {
  type Session,
  type ConversationMessageUI,
  TOOL_RISK_UI,
} from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";

export function ConversationsView() {
  const { state, controller } = useTerrariumUi();
  const [isTyping, setIsTyping] = useState(false);
  const [draft, setDraft] = useState("");

  const sessions = state.sessions;
  const selectedSession: Session | null = sessions[state.selectedSessionIndex] ?? null;
  const messages: readonly ConversationMessageUI[] = state.sessionMessages;

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      // Overlays take precedence
      if (state.isCommandPaletteOpen || state.isHelpModalOpen) return;

      const keyName = event.name.toLowerCase();

      // If typing in the chat draft input
      if (isTyping) {
        if (keyName === "escape" || keyName === "esc" || event.sequence === "\u001b") {
          setIsTyping(false);
          return;
        }

        if (keyName === "return" || keyName === "enter") {
          if (draft.trim().length > 0) {
            void controller.sendMessage(draft.trim());
            setDraft("");
            setIsTyping(false);
          }
          return;
        }

        if (keyName === "backspace") {
          setDraft((prev) => prev.slice(0, -1));
          return;
        }

        if (event.sequence && event.sequence.length === 1 && !event.ctrl && !event.meta) {
          setDraft((prev) => prev + event.sequence);
          return;
        }

        return;
      }

      // Normal Navigation / Command Mode

      // 1. Session Navigation: Up / Down, j / k
      if (keyName === "up" || (!event.ctrl && !event.meta && keyName === "k")) {
        const nextIdx = Math.max(0, state.selectedSessionIndex - 1);
        controller.setSessionIndex(nextIdx);
        return;
      }

      if (keyName === "down" || (!event.ctrl && !event.meta && keyName === "j")) {
        const nextIdx = Math.min(sessions.length - 1, state.selectedSessionIndex + 1);
        controller.setSessionIndex(nextIdx);
        return;
      }

      // 2. Start Typing / Focus Input: 'i' or Enter
      if (
        keyName === "return" ||
        keyName === "enter" ||
        (!event.ctrl && !event.meta && keyName === "i")
      ) {
        setIsTyping(true);
        return;
      }

      // 3. New Session: 'n'
      if (!event.ctrl && !event.meta && keyName === "n") {
        const num = sessions.length + 1;
        void controller.createSession(`Session #${num}`, []);
        return;
      }
    },
    [state, controller, isTyping, draft, sessions]
  );

  useKeyboard(handleKeyboard);

  const isCleanInstall = sessions.length === 0;

  return (
    <box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* 1. Header Banner */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            {GLYPHS.wsConversations} CONVERSATIONS & MULTI-AGENT DEBATES
          </text>
          <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
            {" "}({sessions.length} sessions)
          </text>
        </box>

        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.fgMuted}>
            [n] New Session • [i/Enter] Chat • [↑/↓ j/k] Navigate
          </text>
        </box>
      </box>

      {/* 2. Main Body: Left Sessions Pane + Right Message Thread Pane */}
      {isCleanInstall ? (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          borderColor={THEME_COLORS.borderDefault}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={2}
          paddingY={2}
          alignItems="center"
          justifyContent="center"
          flexGrow={1}
        >
          <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
            {GLYPHS.wsConversations} NO SESSIONS ACTIVE
          </text>
          <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.ITALIC} marginTop={1}>
            Clean installation: No chat sessions, agent debates, or customer interviews recorded.
          </text>
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD} marginTop={1}>
            Press [n] to create a new interactive conversation session.
          </text>
        </box>
      ) : (
        <box flexDirection="row" flexGrow={1}>
          {/* Left Session Selector Sidebar (~26% width) */}
          <box
            flexDirection="column"
            width="26%"
            border={true}
            borderStyle="single"
            borderColor={THEME_COLORS.borderDefault}
            backgroundColor={THEME_COLORS.bgCard}
            paddingX={1}
            marginRight={1}
          >
            <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
              <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
                SESSIONS
              </text>
              <text fg={THEME_COLORS.statusInfo}>[n] New</text>
            </box>

            {sessions.map((sess, idx) => {
              const isSelected = idx === state.selectedSessionIndex;
              return (
                <box
                  key={sess.id}
                  flexDirection="column"
                  backgroundColor={isSelected ? THEME_COLORS.bgActive : undefined}
                  paddingX={1}
                  marginBottom={1}
                >
                  <box flexDirection="row" alignItems="center">
                    <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
                      {isSelected ? "▶ " : "  "}
                    </text>
                    <text
                      fg={isSelected ? THEME_COLORS.fgPrimary : THEME_COLORS.fgSecondary}
                      attributes={isSelected ? TextAttributes.BOLD : undefined}
                    >
                      {sess.title.length > 18 ? `${sess.title.slice(0, 16)}...` : sess.title}
                    </text>
                  </box>
                  <box flexDirection="row" alignItems="center">
                    <text fg={THEME_COLORS.fgDim}>
                      {"   "}[{sess.mode.toUpperCase()}] • {sess.participantAgentIds.length} agents
                    </text>
                  </box>
                </box>
              );
            })}
          </box>

          {/* Right Message Thread & Input Pane (flexGrow: 1) */}
          <box
            flexDirection="column"
            flexGrow={1}
            border={true}
            borderStyle="single"
            borderColor={THEME_COLORS.borderDefault}
            backgroundColor={THEME_COLORS.bgCard}
            paddingX={1}
            paddingY={1}
          >
            {/* Session Thread Header */}
            {selectedSession && (
              <box
                flexDirection="column"
                border={true}
                borderStyle="single"
                borderColor={THEME_COLORS.borderSubtle}
                backgroundColor={THEME_COLORS.bgCardElevated}
                paddingX={1}
                marginBottom={1}
              >
                <box flexDirection="row" alignItems="center">
                  <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
                    {selectedSession.title}
                  </text>
                  <text fg={THEME_COLORS.fgDim}>
                    {" "}({selectedSession.mode} • {selectedSession.status})
                  </text>
                </box>
                {selectedSession.participantAgentIds.length > 0 && (
                  <text fg={THEME_COLORS.fgMuted}>
                    Participants: {selectedSession.participantAgentIds.join(", ")}
                  </text>
                )}
              </box>
            )}

            {/* Message Thread Scroll Area */}
            <box flexDirection="column" flexGrow={1} marginBottom={1}>
              {messages.length === 0 ? (
                <box flexDirection="column" paddingY={2} alignItems="center" justifyContent="center">
                  <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.ITALIC}>
                    No messages in this session yet.
                  </text>
                  <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.DIM}>
                    Press [i] or [Enter] to start chatting with agents or trigger a multi-agent debate.
                  </text>
                </box>
              ) : (
                <box flexDirection="column">
                  {messages.map((msg) => {
                    const isUser = msg.senderType === "user" || msg.role === "user";
                    const isTool = msg.role === "tool" || (msg.toolCalls && msg.toolCalls.length > 0);
                    const isSystem = msg.role === "system";
                    const isSimulated = msg.isSimulatedPersona;

                    // Message Header Colors
                    const senderColor = isUser
                      ? THEME_COLORS.fgPrimary
                      : isSimulated
                      ? THEME_COLORS.statusSimulated
                      : isTool
                      ? THEME_COLORS.statusInfo
                      : isSystem
                      ? THEME_COLORS.fgDim
                      : THEME_COLORS.statusAccent;

                    return (
                      <box
                        key={msg.id}
                        flexDirection="column"
                        backgroundColor={isUser ? THEME_COLORS.bgActive : THEME_COLORS.bgCardElevated}
                        border={true}
                        borderStyle="single"
                        borderColor={
                          isSimulated
                            ? THEME_COLORS.statusSimulated
                            : isTool
                            ? THEME_COLORS.statusInfo
                            : THEME_COLORS.borderSubtle
                        }
                        paddingX={1}
                        marginBottom={1}
                      >
                        {/* Prominent Simulated Content Banner (A3 & A5) */}
                        {isSimulated && (
                          <box
                            flexDirection="row"
                            backgroundColor={THEME_COLORS.bgCard}
                            border={true}
                            borderStyle="single"
                            borderColor={THEME_COLORS.statusSimulated}
                            paddingX={1}
                            marginBottom={1}
                          >
                            <text fg={THEME_COLORS.statusSimulated} attributes={TextAttributes.BOLD}>
                              {GLYPHS.simulatedTag} SIMULATED CUSTOMER PERSONA • SYNTHETIC CONTENT
                            </text>
                          </box>
                        )}

                        {/* Message Header */}
                        <box flexDirection="row" justifyContent="space-between" alignItems="center">
                          <box flexDirection="row" alignItems="center">
                            <text fg={senderColor} attributes={TextAttributes.BOLD}>
                              {isUser ? "👤 You" : isTool ? "⚡ Tool" : `🤖 ${msg.senderName}`}
                            </text>
                            {isSimulated && (
                              <text fg={THEME_COLORS.statusSimulated} attributes={TextAttributes.BOLD}>
                                {" "}{GLYPHS.simulatedTag}
                              </text>
                            )}
                            {msg.senderRole && !isSimulated && (
                              <text fg={THEME_COLORS.fgMuted}> ({msg.senderRole})</text>
                            )}
                          </box>

                          <text fg={THEME_COLORS.fgDim}>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </text>
                        </box>

                        {/* Message Content */}
                        <box marginTop={0}>
                          <text fg={THEME_COLORS.fgPrimary}>{msg.content}</text>
                        </box>

                        {/* Preserved Specialist Disagreements (A2 & A5) */}
                        {msg.disagreements && msg.disagreements.length > 0 && (
                          <box
                            flexDirection="column"
                            border={true}
                            borderStyle="single"
                            borderColor={THEME_COLORS.statusWarning}
                            backgroundColor={THEME_COLORS.bgCard}
                            paddingX={1}
                            marginTop={1}
                          >
                            <text fg={THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD}>
                              {GLYPHS.statusWarning} PRESERVED SPECIALIST DISAGREEMENT:
                            </text>
                            {msg.disagreements.map((d, i) => (
                              <text key={i} fg={THEME_COLORS.fgSecondary}>
                                • {d.specialist}: "{d.argument}"
                              </text>
                            ))}
                          </box>
                        )}

                        {/* Epistemic Uncertainty Indicator (A2 & A3) */}
                        {msg.uncertaintyLevel && (
                          <box flexDirection="column" marginTop={1}>
                            <text
                              fg={
                                msg.uncertaintyLevel === "high" || msg.uncertaintyLevel === "critical"
                                  ? THEME_COLORS.statusDanger
                                  : THEME_COLORS.statusWarning
                              }
                              attributes={TextAttributes.BOLD}
                            >
                              [UNCERTAINTY: {msg.uncertaintyLevel.toUpperCase()}]
                            </text>
                            <text fg={THEME_COLORS.fgMuted}>
                              {msg.uncertaintyExplanation ?? "Incomplete information acknowledged"}
                            </text>
                          </box>
                        )}

                        {/* Tool Calls Summary */}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <box flexDirection="row" alignItems="center" marginTop={1}>
                            <text fg={THEME_COLORS.statusInfo}>
                              Tool executed: {msg.toolCalls.map((t) => t.name).join(", ")}{" "}
                            </text>
                            {msg.toolCalls.some((t) => t.isConsequential) && (
                              <text fg={THEME_COLORS.statusApproval} attributes={TextAttributes.BOLD}>
                                [CONSEQUENTIAL]
                              </text>
                            )}
                          </box>
                        )}
                      </box>
                    );
                  })}
                </box>
              )}
            </box>

            {/* Bottom Chat Prompt Input */}
            <box
              flexDirection="row"
              alignItems="center"
              border={true}
              borderStyle="single"
              borderColor={isTyping ? THEME_COLORS.borderFocused : THEME_COLORS.borderDefault}
              backgroundColor={THEME_COLORS.bgInput}
              paddingX={1}
            >
              <text fg={isTyping ? THEME_COLORS.statusInfo : THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD}>
                {isTyping ? "💬 Typing: " : "💬 [i/Enter to chat]: "}
              </text>
              <text fg={draft ? THEME_COLORS.fgPrimary : THEME_COLORS.fgDim}>
                {draft || (isTyping ? "" : "Ask agents, debate trade-offs, or evaluate simulated customer feedback...")}
              </text>
              {isTyping && (
                <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
                  ▎
                </text>
              )}
            </box>
          </box>
        </box>
      )}
    </box>
  );
}
