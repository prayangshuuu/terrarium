/**
 * @terrarium/core - tests/provider-anthropic.test.ts
 *
 * Comprehensive contract & integration tests for AnthropicProviderAdapter.
 * Tests Messages API formatting, role alternation, SSE stream parsing, tool calling translation,
 * token usage calculation, rate limit header parsing, security authorization guards, and error mappings.
 * Aligns with PROMPT 19 requirements (A2 - Adapter Runtime & A3 - Security & Reliability).
 */

import { describe, expect, it } from "bun:test";
import {
  type ModelCompletionRequest,
  type ModelStreamChunk,
  ProviderAuthenticationError,
  ProviderInvalidRequestError,
  ProviderRateLimitError,
  ProviderServerError,
  ProviderTimeoutError,
  ProviderUnauthorizedCallError,
} from "@terrarium/contracts";
import { AnthropicProviderAdapter, consumeStream, type FetchFunction } from "../src/providers/index.ts";

describe("AnthropicProviderAdapter Suite", () => {
  const sampleRequest: ModelCompletionRequest = {
    model: "claude-3-5-sonnet-20241022",
    messages: [
      { role: "system", content: "You are an expert software architect." },
      { role: "user", content: "Evaluate the architecture boundaries." },
    ],
    options: {
      temperature: 0.2,
      maxTokens: 1000,
    },
  };

  describe("Security Authorization & Guard Rails", () => {
    it("blocks remote execution if allowExternalCalls is false", async () => {
      const adapter = new AnthropicProviderAdapter({
        apiKey: "sk-ant-test-key-12345",
        allowExternalCalls: false,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderUnauthorizedCallError);
      }
    });

    it("blocks remote execution if API key is missing", async () => {
      const adapter = new AnthropicProviderAdapter({
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
    it("executes completion, separates system prompt, and normalizes usage", async () => {
      let capturedBody: any;
      let capturedHeaders: any;

      const mockFetch: FetchFunction = async (url, init) => {
        capturedHeaders = init?.headers;
        capturedBody = JSON.parse(init?.body as string);

        return new Response(
          JSON.stringify({
            id: "msg_anthropic_12345",
            type: "message",
            role: "assistant",
            model: "claude-3-5-sonnet-20241022",
            content: [{ type: "text", text: "The architectural boundaries are cleanly decoupled." }],
            stop_reason: "end_turn",
            usage: {
              input_tokens: 45,
              output_tokens: 18,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "anthropic-ratelimit-requests-remaining": "99",
              "anthropic-ratelimit-tokens-remaining": "99500",
            },
          }
        );
      };

      const adapter = new AnthropicProviderAdapter({
        apiKey: "sk-ant-valid-key",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.provider).toBe("anthropic");
        expect(res.data.text).toBe("The architectural boundaries are cleanly decoupled.");
        expect(res.data.finishReason).toBe("stop");
        expect(res.data.usage.promptTokens).toBe(45);
        expect(res.data.usage.completionTokens).toBe(18);
        expect(res.data.usage.totalTokens).toBe(63);
        expect(res.data.usage.estimatedCostUsd).toBeGreaterThan(0);
      }

      // Verify payload structure matches Anthropic requirements
      expect(capturedHeaders["x-api-key"]).toBe("sk-ant-valid-key");
      expect(capturedHeaders["anthropic-version"]).toBe("2023-06-01");
      expect(capturedBody.system).toBe("You are an expert software architect.");
      expect(capturedBody.messages[0].role).toBe("user");
      expect(capturedBody.messages[0].content).toBe("Evaluate the architecture boundaries.");
    });

    it("translates tool calling definitions and parses returned tool_use blocks", async () => {
      const mockFetch: FetchFunction = async (url, init) => {
        return new Response(
          JSON.stringify({
            id: "msg_tool_call_99",
            type: "message",
            role: "assistant",
            model: "claude-3-5-sonnet-20241022",
            content: [
              {
                type: "tool_use",
                id: "toolu_01A",
                name: "query_database",
                input: { query: "SELECT * FROM reports" },
              },
            ],
            stop_reason: "tool_use",
            usage: { input_tokens: 80, output_tokens: 30 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const adapter = new AnthropicProviderAdapter({
        apiKey: "sk-ant-test-key",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const reqWithTools: ModelCompletionRequest = {
        ...sampleRequest,
        options: {
          tools: [
            {
              type: "function",
              function: {
                name: "query_database",
                description: "Runs SQL query against database",
                parameters: { type: "object", properties: { query: { type: "string" } } },
              },
            },
          ],
        },
      };

      const res = await adapter.complete(reqWithTools);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.finishReason).toBe("tool_calls");
        expect(res.data.toolCalls?.length).toBe(1);
        expect(res.data.toolCalls?.[0]?.function.name).toBe("query_database");
        expect(JSON.parse(res.data.toolCalls?.[0]?.function.arguments ?? "{}").query).toBe("SELECT * FROM reports");
      }
    });
  });

  describe("SSE Streaming Execution", () => {
    it("parses Anthropic SSE events and streams deltas", async () => {
      const ssePayload = [
        'data: {"type":"message_start","message":{"id":"msg_stream","type":"message","role":"assistant","usage":{"input_tokens":35}}}\n\n',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Decoupled "}}\n\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"architecture"}}\n\n',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":12}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ].join("");

      const mockFetch: FetchFunction = async () => {
        return new Response(ssePayload, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      };

      const adapter = new AnthropicProviderAdapter({
        apiKey: "sk-ant-test-key",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const streamResult = await consumeStream(adapter.stream(sampleRequest), {
        id: "msg_stream_123",
        provider: "anthropic",
        model: sampleRequest.model,
      });
      expect(streamResult.success).toBe(true);
      if (streamResult.success) {
        expect(streamResult.data.text).toBe("Decoupled architecture");
        expect(streamResult.data.finishReason).toBe("stop");
        expect(streamResult.data.usage?.promptTokens).toBe(35);
        expect(streamResult.data.usage?.completionTokens).toBe(12);
        expect(streamResult.data.usage?.totalTokens).toBe(47);
      }
    });
  });

  describe("Error Normalization & Health Diagnostics", () => {
    it("maps HTTP 401 to ProviderAuthenticationError", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({ error: { type: "authentication_error", message: "invalid x-api-key" } }),
          { status: 401 }
        );
      };

      const adapter = new AnthropicProviderAdapter({
        apiKey: "sk-ant-invalid",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderAuthenticationError);
        expect(res.error.message).toContain("invalid x-api-key");
      }
    });

    it("maps HTTP 429 to ProviderRateLimitError with retry-after metadata", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({ error: { message: "rate_limit_exceeded" } }),
          { status: 429, headers: { "retry-after": "5" } }
        );
      };

      const adapter = new AnthropicProviderAdapter({
        apiKey: "sk-ant-test-key",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderRateLimitError);
        expect((res.error as ProviderRateLimitError).retryAfterMs).toBe(5000);
      }
    });

    it("evaluates health status cleanly for missing credentials", async () => {
      const unconfigured = new AnthropicProviderAdapter({});
      const health = await unconfigured.checkHealth();
      expect(health.success).toBe(true);
      if (health.success) {
        expect(health.data.isHealthy).toBe(false);
        expect(health.data.message).toContain("ANTHROPIC_API_KEY");
      }
    });
  });
});
