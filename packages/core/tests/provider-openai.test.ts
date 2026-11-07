/**
 * @terrarium/core - tests/provider-openai.test.ts
 *
 * Contract & integration tests for OpenAIProviderAdapter.
 * Tests end-to-end HTTP/SSE parsing, token normalization, rate limits, error mapping,
 * and security authorization guards using offline mocked fetch handlers.
 * Aligns with Prompt 9 requirements (A2, A3).
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
import { OpenAIProviderAdapter, consumeStream, type FetchFunction } from "../src/providers/index.ts";

describe("OpenAIProviderAdapter End-to-End Adapter Suite", () => {
  const sampleRequest: ModelCompletionRequest = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a code reviewer." },
      { role: "user", content: "Check boundary validations." },
    ],
    options: {
      temperature: 0.3,
      maxTokens: 500,
    },
  };

  describe("Security Authorization & Guard Rails", () => {
    it("blocks remote execution if allowExternalCalls is false", async () => {
      const adapter = new OpenAIProviderAdapter({
        apiKey: "sk-proj-actual-test-key",
        baseUrl: "https://api.openai.com/v1",
        allowExternalCalls: false,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderUnauthorizedCallError);
      }
    });

    it("blocks remote execution if API key is missing", async () => {
      const adapter = new OpenAIProviderAdapter({
        baseUrl: "https://api.openai.com/v1",
        allowExternalCalls: true,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderUnauthorizedCallError);
      }
    });

    it("permits local OpenAI-compatible endpoint calls without API key", async () => {
      const mockFetch: FetchFunction = async (url) => {
        return new Response(
          JSON.stringify({
            id: "chatcmpl-local-123",
            choices: [{ message: { content: "Local Ollama response" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const adapter = new OpenAIProviderAdapter({
        baseUrl: "http://localhost:11434/v1",
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.text).toBe("Local Ollama response");
      }
    });
  });

  describe("Chat Completion & Usage Normalization", () => {
    it("executes completion, sends authorization header, and normalizes usage & cost", async () => {
      let capturedHeaders: HeadersInit | undefined;
      let capturedBody: any;

      const mockFetch: FetchFunction = async (url, init) => {
        capturedHeaders = init?.headers;
        capturedBody = JSON.parse(init?.body as string);

        return new Response(
          JSON.stringify({
            id: "chatcmpl-test-abc",
            choices: [
              {
                message: { content: "Verified architecture conformance." },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 200,
              completion_tokens: 80,
              total_tokens: 280,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const adapter = new OpenAIProviderAdapter({
        apiKey: "sk-proj-valid-authorized-key",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe("chatcmpl-test-abc");
        expect(res.data.provider).toBe("openai");
        expect(res.data.model).toBe("gpt-4o-mini");
        expect(res.data.text).toBe("Verified architecture conformance.");
        expect(res.data.finishReason).toBe("stop");
        expect(res.data.usage.promptTokens).toBe(200);
        expect(res.data.usage.completionTokens).toBe(80);
        expect(res.data.usage.totalTokens).toBe(280);
        expect(res.data.usage.estimatedCostUsd).toBeGreaterThan(0);
      }

      expect((capturedHeaders as Record<string, string>)["Authorization"]).toBe(
        "Bearer sk-proj-valid-authorized-key"
      );
      expect(capturedBody.model).toBe("gpt-4o-mini");
      expect(capturedBody.messages.length).toBe(2);
      expect(capturedBody.temperature).toBe(0.3);
    });
  });

  describe("SSE Streaming & Cancellation", () => {
    it("streams Server-Sent Events, extracts delta chunks, and finalizes stream", async () => {
      const ssePayload = [
        'data: {"choices":[{"delta":{"content":"Streaming "},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":"output "},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":"chunk."},"finish_reason":"stop"}],"usage":{"prompt_tokens":15,"completion_tokens":5,"total_tokens":20}}\n\n',
        "data: [DONE]\n\n",
      ].join("");

      const mockFetch: FetchFunction = async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(ssePayload));
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
      };

      const adapter = new OpenAIProviderAdapter({
        apiKey: "sk-proj-valid-key",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const chunks: ModelStreamChunk[] = [];
      const stream = adapter.stream(sampleRequest);

      const compiledRes = await consumeStream(
        stream,
        { id: "stream-id-1", provider: "openai", model: "gpt-4o-mini" },
        {
          onChunk: (_, chunk) => chunks.push(chunk),
        }
      );

      expect(compiledRes.success).toBe(true);
      expect(chunks.length).toBe(3);
      if (compiledRes.success) {
        expect(compiledRes.data.text).toBe("Streaming output chunk.");
        expect(compiledRes.data.finishReason).toBe("stop");
        expect(compiledRes.data.usage.totalTokens).toBe(20);
      }
    });

    it("handles client AbortSignal cancellation during streaming", async () => {
      const controller = new AbortController();
      controller.abort();

      const adapter = new OpenAIProviderAdapter({
        apiKey: "sk-proj-valid-key",
        allowExternalCalls: true,
        fetchFn: async () => new Response(""),
      });

      const stream = adapter.stream(sampleRequest, { signal: controller.signal });
      const chunks: ModelStreamChunk[] = [];
      let hadError = false;

      for await (const chunkRes of stream) {
        if (!chunkRes.success) {
          hadError = true;
          expect(chunkRes.error).toBeInstanceOf(ProviderTimeoutError);
          break;
        }
        chunks.push(chunkRes.data);
      }

      expect(hadError).toBe(true);
    });
  });

  describe("HTTP Error Normalization", () => {
    it("normalizes HTTP 401 to ProviderAuthenticationError", async () => {
      const mockFetch: FetchFunction = async () =>
        new Response(JSON.stringify({ error: { message: "Incorrect API key provided" } }), {
          status: 401,
        });

      const adapter = new OpenAIProviderAdapter({
        apiKey: "sk-invalid-key",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderAuthenticationError);
        expect(res.error.isRetryable).toBe(false);
        expect(res.error.statusCode).toBe(401);
      }
    });

    it("normalizes HTTP 429 with Retry-After header to ProviderRateLimitError", async () => {
      const mockFetch: FetchFunction = async () =>
        new Response(JSON.stringify({ error: { message: "Rate limit reached for requests" } }), {
          status: 429,
          headers: { "retry-after": "5" },
        });

      const adapter = new OpenAIProviderAdapter({
        apiKey: "sk-valid-key",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderRateLimitError);
        expect((res.error as ProviderRateLimitError).retryAfterMs).toBe(5000);
        expect(res.error.isRetryable).toBe(true);
      }
    });

    it("normalizes HTTP 400 to ProviderInvalidRequestError", async () => {
      const mockFetch: FetchFunction = async () =>
        new Response(JSON.stringify({ error: { message: "Model 'non-existent' does not exist" } }), {
          status: 400,
        });

      const adapter = new OpenAIProviderAdapter({
        apiKey: "sk-valid-key",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete({ ...sampleRequest, model: "non-existent" });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderInvalidRequestError);
        expect(res.error.isRetryable).toBe(false);
      }
    });

    it("normalizes HTTP 503 to ProviderServerError", async () => {
      const mockFetch: FetchFunction = async () =>
        new Response(JSON.stringify({ error: { message: "The engine is currently overloaded" } }), {
          status: 503,
        });

      const adapter = new OpenAIProviderAdapter({
        apiKey: "sk-valid-key",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderServerError);
        expect(res.error.isRetryable).toBe(true);
        expect(res.error.statusCode).toBe(503);
      }
    });
  });

  describe("Model Discovery & Health Checks", () => {
    it("discovers models from /models API when authorized", async () => {
      const mockFetch: FetchFunction = async () =>
        new Response(
          JSON.stringify({
            data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }, { id: "o1-mini" }, { id: "whisper-1" }],
          }),
          { status: 200 }
        );

      const adapter = new OpenAIProviderAdapter({
        apiKey: "sk-valid-key",
        allowExternalCalls: true,
        fetchFn: mockFetch,
      });

      const res = await adapter.listModels();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.length).toBe(3); // whisper filtered out
        expect(res.data.map((m) => m.id)).toContain("gpt-4o");
        expect(res.data.map((m) => m.id)).toContain("gpt-4o-mini");
        expect(res.data.map((m) => m.id)).toContain("o1-mini");
      }
    });

    it("checks provider health status and records latency", async () => {
      const mockFetch: FetchFunction = async () => new Response("{}", { status: 200 });

      const adapter = new OpenAIProviderAdapter({
        baseUrl: "http://localhost:11434/v1",
        fetchFn: mockFetch,
      });

      const healthRes = await adapter.checkHealth();
      expect(healthRes.success).toBe(true);
      if (healthRes.success) {
        expect(healthRes.data.isHealthy).toBe(true);
        expect(healthRes.data.latencyMs).toBeGreaterThanOrEqual(0);
        expect(healthRes.data.timestamp).toBeDefined();
      }
    });
  });
});
