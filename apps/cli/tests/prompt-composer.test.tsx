/**
 * apps/cli/tests/prompt-composer.test.tsx
 *
 * Test suite for PromptComposer component and interactive conversations prompt workflow.
 * Prompt 26 verification suite. Zero emoji typography.
 */

import { describe, expect, test } from "bun:test";
import React from "react";
import { testRender } from "@opentui/react/test-utils";
import { PromptComposer } from "../src/ui/components/PromptComposer.js";
import { UiStateController } from "../src/ui/state/ui-state-controller.js";
import { TerrariumUiProvider } from "../src/ui/state/ui-context.js";
import { ConversationsView } from "../src/ui/views/ConversationsView.js";

describe("PromptComposer Component (Prompt 26)", () => {
  test("renders prompt composer with headers, provider pill, and controls", async () => {
    const setup = await testRender(
      <PromptComposer
        isFocused={true}
        height={9}
        onSubmit={() => {}}
        initialText="Explain the core engine architecture"
        initialProvider="claude_code"
      />,
      { width: 100, height: 15 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("PROMPT");
    expect(frame).toContain("COMPOSER");
    expect(frame).toContain("Claude Code");
    expect(frame).toContain("Explain the core engine architecture");
    expect(frame).toContain("Ctrl+Enter: Send");
    expect(frame).toContain("Ctrl+P: Cycle");
    expect(frame).toContain("Templates");
    expect(frame).toContain("History");
    expect(frame).toContain("Esc: Unfocus");

    // Zero emoji check
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
    expect(emojiRegex.test(frame)).toBe(false);

    await setup.dispose();
  });

  test("renders prompt composer inside ConversationsView when session is selected", async () => {
    const controller = new UiStateController({
      initialWorkspace: "conversations",
    });

    // Create session to avoid clean install empty state
    await controller.createSession("Test Architecture Session", []);

    const setup = await testRender(
      <TerrariumUiProvider controller={controller}>
        <ConversationsView />
      </TerrariumUiProvider>,
      { width: 130, height: 35 }
    );

    await setup.renderOnce();
    const frame = setup.captureCharFrame();

    expect(frame).toContain("CONVERSATIONS & MULTI-AGENT DEBATES");
    expect(frame).toContain("Test Architecture Session");
    expect(frame).toContain("Open Prompt Composer");
    expect(frame).toContain("Templates");
    expect(frame).toContain("History");
    expect(frame).toContain("Claude / Antigravity");

    await setup.dispose();
  });
});
