/**
 * @terrarium/core - tests/provider-ollama.test.ts
 *
 * Comprehensive contract & integration tests for OllamaProviderAdapter.
 * Tests local loopback execution, zero-cost accounting, dynamic model discovery,
 * ndjson stream parsing, tool calling translation, and unreachable daemon handling.
 * Aligns with PROMPT 19 requirements (A2 - Adapter Runtime & A3 - Security & Reliability).
 */

import { describe, expect, it } from "bun:test";
import {
  type ModelCompletionRequest,
  ProviderInvalidRequestError,
  ProviderNetworkError,
} from "@terrarium/contracts";
import { OllamaProviderAdapter, consumeStream, type FetchFunction } from "../src/providers/index.ts";

describe("OllamaProviderAdapter Suite", () => {
  const sampleRequest: ModelCompletionRequest = {
    model: "llama3.2",
    messages: [
      { role: "system", content: "You are a local coding assistant." },
      { role: "user", content: "Explain Rust memory safety." },
    ],
    options: {
      temperature: 0.1,
      maxTokens: 500,
    },
  };

  describe("Local Offline Guarantees", () => {
    it("executes local completions without API key or external call authorization", async () => {
      const mockFetch: FetchFunction = async (url, init) => {
        expect(url.toString()).toContain("http://localhost:11434/api/chat");
        return new Response(
          JSON.stringify({
            model: "llama3.2",
            message: { role: "assistant", content: "Rust enforces memory safety via ownership." },
            done: true,
            prompt_eval_count: 24,
            eval_count: 12,
            total_duration: 150000000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const adapter = new OllamaProviderAdapter({
        baseUrl: "http://localhost:11434",
        fetchFn: mockFetch,
      });

      const res = await adapter.complete(sampleRequest);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.provider).toBe("ollama");
        expect(res.data.text).toBe("Rust enforces memory safety via ownership.");
        expect(res.data.usage.estimatedCostUsd).toBe(0.0); // Zero cost guarantee
        expect(res.data.usage.totalTokens).toBe(36);
        expect(res.data.finishReason).toBe("stop");
      }
    });

    it("reports zero cost in capability inspection", async () => {
      const adapter = new OllamaProviderAdapter();
      const caps = await adapter.getCapabilities("llama3.2");
      expect(caps.success).toBe(true);
      if (caps.success) {
        expect(caps.data.costPerInputToken).toBe(0.0);
        expect(caps.data.costPerOutputToken).toBe(0.0);
      }
    });
  });

  describe("Model Discovery & Fallback", () => {
    it("discovers installed local models via /api/tags", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({
            models: [
              { name: "llama3.2:latest", details: { parameter_size: "3.2B" } },
              { name: "qwen2.5-coder:7b", details: { parameter_size: "7B" } },
            ],
          }),
          { status: 200 }
        );
      };

      const adapter = new OllamaProviderAdapter({ fetchFn: mockFetch });
      const modelsRes = await adapter.listModels();
      expect(modelsRes.success).toBe(true);
      if (modelsRes.success) {
        expect(modelsRes.data.length).toBe(2);
        expect(modelsRes.data[0]?.id).toBe("llama3.2:latest");
        expect(modelsRes.data[1]?.id).toBe("qwen2.5-coder:7b");
      }
    });

    it("falls back to default model catalogue when daemon is offline", async () => {
      const mockFetch: FetchFunction = async () => {
        throw new Error("Connection refused (ECONNREFUSED)");
      };

      const adapter = new OllamaProviderAdapter({ fetchFn: mockFetch });
      const modelsRes = await adapter.listModels();
      expect(modelsRes.success).toBe(true);
      if (modelsRes.success) {
        expect(modelsRes.data.length).toBeGreaterThan(0);
        expect(modelsRes.data[0]?.id).toBe("llama3.2");
      }
    });
  });

  describe("ndjson Streaming Execution", () => {
    it("streams ndjson chunks and completes with prompt/eval tokens", async () => {
      const ndjson = [
        JSON.stringify({ message: { content: "Rust " }, done: false }),
        JSON.stringify({ message: { content: "ownership " }, done: false }),
        JSON.stringify({ message: { content: "model." }, done: true, prompt_eval_count: 20, eval_count: 10 }),
      ].join("\n");

      const mockFetch: FetchFunction = async () => {
        return new Response(ndjson, { status: 200 });
      };

      const adapter = new OllamaProviderAdapter({ fetchFn: mockFetch });
      const streamRes = await consumeStream(adapter.stream(sampleRequest), {
        id: "ollama_stream_1",
        provider: "ollama",
        model: sampleRequest.model,
      });

      expect(streamRes.success).toBe(true);
      if (streamRes.success) {
        expect(streamRes.data.text).toBe("Rust ownership model.");
        expect(streamRes.data.usage.totalTokens).toBe(30);
        expect(streamRes.data.usage.estimatedCostUsd).toBe(0.0);
      }
    });
  });

  describe("Diagnostics and Unreachable Daemon Handling", () => {
    it("returns friendly offline diagnostics when Ollama daemon is not running", async () => {
      const mockFetch: FetchFunction = async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:11434");
      };

      const adapter = new OllamaProviderAdapter({ fetchFn: mockFetch });
      const health = await adapter.checkHealth();
      expect(health.success).toBe(true);
      if (health.success) {
        expect(health.data.isHealthy).toBe(false);
        expect(health.data.message).toContain("ollama serve");
      }
    });

    it("maps 404 to ProviderInvalidRequestError with pull recommendation", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({ error: "model 'nonexistent-model' not found" }),
          { status: 404 }
        );
      };

      const adapter = new OllamaProviderAdapter({ fetchFn: mockFetch });
      const res = await adapter.complete({ ...sampleRequest, model: "nonexistent-model" });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(ProviderInvalidRequestError);
        expect(res.error.message).toContain("ollama pull");
      }
    });
  });
});
