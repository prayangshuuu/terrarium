/**
 * @terrarium/core - tests/provider-gemini.test.ts
 *
 * Comprehensive contract & integration tests for GeminiProviderAdapter.
 * Tests Generative AI REST endpoints (:generateContent, :streamGenerateContent),
 * massive context window handling, system instructions, function calling translation,
 * usage normalization, and error mappings.
 * Aligns with PROMPT 19 requirements (A2 - Adapter Runtime & A3 - Security & Reliability).
 */

import { describe, expect, it } from "bun:test";
import {
  type ModelCompletionRequest,
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderUnauthorizedCallError,
} from "@terrarium/contracts";
import { GeminiProviderAdapter, consumeStream, type FetchFunction } from "../src/providers/index.ts";

describe("GeminiProviderAdapter Suite", () => {
  const sampleRequest: ModelCompletionRequest = {
    model: "gemini-1.5-pro",
    messages: [
      { role: "system", content: "You are a code auditor." },
      { role: "user", content: "Audit repository security." },
    ],
    options: {
      temperature: 0.2,
      maxTokens: 1000,
    },
  };

  describe("Security Authorization & Guard Rails", () => {
    it("blocks remote execution if allowExternalCalls is false", async () => {
      const adapter = new GeminiProviderAdapter({
        apiKey: "AIzaSyTestKey123",
        allowExternalCalls: false,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderUnauthorizedCallError);
      }
    });

    it("blocks remote execution if API key is missing", async () => {
      const adapter = new GeminiProviderAdapter({
        allowExternalCalls: true,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderUnauthorizedCallError);
      }
    });
  });

  describe("Non-streaming Completion Execution", () => {
    it("executes completion, passes x-goog-api-key, and normalizes usageMetadata", async () => {
      let capturedHeaders: any;
      let capturedBody: any;

      const mockFetch: FetchFunction = async (url, init) => {
        expect(url.toString()).toContain("/v1beta/models/gemini-1.5-pro:generateContent");
        capturedHeaders = init?.headers;
        capturedBody = JSON.parse(init?.body as string);

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Security audit completed. No vulnerabilities detected." }],
                  role: "model",
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 50,
              candidatesTokenCount: 20,
              totalTokenCount: 70,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const adapter = new GeminiProviderAdapter({
        apiKey: "AIzaSyValidGeminiKey",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.provider).toBe("gemini");
        expect(res.data.text).toBe("Security audit completed. No vulnerabilities detected.");
        expect(res.data.finishReason).toBe("stop");
        expect(res.data.usage.promptTokens).toBe(50);
        expect(res.data.usage.completionTokens).toBe(20);
        expect(res.data.usage.totalTokens).toBe(70);
        expect(res.data.usage.estimatedCostUsd).toBeGreaterThan(0);
      }

      expect(capturedHeaders["x-goog-api-key"]).toBe("AIzaSyValidGeminiKey");
      expect(capturedBody.systemInstruction?.parts[0]?.text).toBe("You are a code auditor.");
      expect(capturedBody.contents[0].parts[0].text).toBe("Audit repository security.");
    });

    it("parses returned functionCall from Gemini candidates", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: "inspect_file",
                        args: { path: "src/index.ts" },
                      },
                    },
                  ],
                  role: "model",
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 15 },
          }),
          { status: 200 }
        );
      };

      const adapter = new GeminiProviderAdapter({
        apiKey: "AIzaSyTestKey",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.toolCalls?.length).toBe(1);
        expect(res.data.toolCalls?.[0]?.function.name).toBe("inspect_file");
        expect(JSON.parse(res.data.toolCalls?.[0]?.function.arguments ?? "{}").path).toBe("src/index.ts");
      }
    });
  });

  describe("SSE Streaming Execution", () => {
    it("parses SSE chunks and yields deltas and token usage", async () => {
      const ssePayload = [
        'data: {"candidates":[{"content":{"parts":[{"text":"Audit "}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"passed."}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":30,"candidatesTokenCount":10}}\n\n',
      ].join("");

      const mockFetch: FetchFunction = async () => {
        return new Response(ssePayload, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      };

      const adapter = new GeminiProviderAdapter({
        apiKey: "AIzaSyTestKey",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const streamRes = await consumeStream(adapter.stream(sampleRequest), {
        id: "gemini_stream_1",
        provider: "gemini",
        model: sampleRequest.model,
      });

      expect(streamRes.success).toBe(true);
      if (streamRes.success) {
        expect(streamRes.data.text).toBe("Audit passed.");
        expect(streamRes.data.finishReason).toBe("stop");
        expect(streamRes.data.usage?.totalTokens).toBe(40);
      }
    });
  });

  describe("Error Mapping & Diagnostics", () => {
    it("maps 400 invalid API key to ProviderAuthenticationError", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({ error: { message: "API key not valid. Please pass a valid API key." } }),
          { status: 400 }
        );
      };

      const adapter = new GeminiProviderAdapter({
        apiKey: "AIzaSyBadKey",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderAuthenticationError);
        expect(res.error.message).toContain("Invalid Google API key");
      }
    });

    it("maps 429 quota exhausted to ProviderRateLimitError", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({ error: { message: "Resource has been exhausted (e.g. check quota)." } }),
          { status: 429 }
        );
      };

      const adapter = new GeminiProviderAdapter({
        apiKey: "AIzaSyQuotaKey",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderRateLimitError);
      }
    });

    it("evaluates health status cleanly when key is missing", async () => {
      const unconfigured = new GeminiProviderAdapter({});
      const health = await unconfigured.checkHealth();
      expect(health.success).toBe(true);
      if (health.success) {
        expect(health.data.isHealthy).toBe(false);
        expect(health.data.message).toContain("GEMINI_API_KEY");
      }
    });
  });
});
