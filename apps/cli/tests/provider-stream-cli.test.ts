/**
 * @terrarium/cli - tests/provider-stream-cli.test.ts
 *
 * Tests for terminal streaming renderer and live UX feedback.
 * Aligns with Prompt 9 requirements (A4 - streaming UX).
 */

import { describe, expect, it } from "bun:test";
import {
  type ModelStreamChunk,
  ProviderServerError,
  ok,
  fail,
} from "@terrarium/contracts";
import { renderStreamToTerminal } from "../src/commands/stream-renderer.ts";

describe("CLI Streaming UX & Terminal Renderer", () => {
  it("renders live streaming chunks, aggregates tokens, and outputs summary", async () => {
    async function* mockStream() {
      yield ok({ index: 0, deltaText: "Architectural " });
      yield ok({ index: 1, deltaText: "evaluation " });
      yield ok({ index: 2, deltaText: "complete." });
    }

    const writtenChunks: string[] = [];
    const res = await renderStreamToTerminal(mockStream(), {
      useColor: false,
      writeFn: (chunk) => writtenChunks.push(chunk),
      prefix: "Model Output: ",
    });

    expect(res.success).toBe(true);
    expect(writtenChunks).toContain("Model Output: ");
    expect(writtenChunks).toContain("Architectural ");
    expect(writtenChunks).toContain("evaluation ");
    expect(writtenChunks).toContain("complete.");

    if (res.success) {
      expect(res.data.text).toBe("Architectural evaluation complete.");
      expect(res.data.tokenCount).toBeGreaterThan(0);
      expect(res.data.formattedSummary).toContain("streamed");
      expect(res.data.formattedSummary).toContain("tok/s");
    }
  });

  it("handles upstream streaming error cleanly without crashing terminal", async () => {
    async function* failingStream() {
      yield ok({ index: 0, deltaText: "Initial chunk." });
      yield fail(new ProviderServerError("Overloaded", "openai", 503));
    }

    const writtenChunks: string[] = [];
    const res = await renderStreamToTerminal(failingStream(), {
      writeFn: (c) => writtenChunks.push(c),
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBeInstanceOf(ProviderServerError);
      expect(res.error.statusCode).toBe(503);
    }
  });
});
