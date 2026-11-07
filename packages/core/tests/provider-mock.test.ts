/**
 * @terrarium/core - tests/provider-mock.test.ts
 *
 * Unit tests for the deterministic offline MockModelAdapter.
 * Verifies contract compliance, streaming chunk generation, simulated error modes,
 * and consumeStream integration.
 * Aligns with Prompt 9 requirements (mock adapter and contract tests).
 */

import { describe, expect, it } from "bun:test";
import {
  type ModelCompletionRequest,
  type ModelStreamChunk,
  ProviderRateLimitError,
} from "@terrarium/contracts";
import {
  MockModelAdapter,
  consumeStream,
} from "../src/providers/index.ts";

describe("MockModelAdapter Contracts & Offline Execution", () => {
  const sampleRequest: ModelCompletionRequest = {
    model: "mock-flagship",
    messages: [
      { role: "system", content: "You are a test assistant." },
      { role: "user", content: "Describe architectural principles." },
    ],
  };

  it("conforms to ModelProviderAdapter contracts", async () => {
    const adapter = new MockModelAdapter("custom");
    expect(adapter.kind).toBe("model_api");
    expect(adapter.providerType).toBe("custom");

    const capsRes = await adapter.getCapabilities();
    expect(capsRes.success).toBe(true);
    if (capsRes.success) {
      expect(capsRes.data.supportsStreaming).toBe(true);
      expect(capsRes.data.contextWindow).toBeGreaterThan(10000);
    }

    const modelsRes = await adapter.listModels();
    expect(modelsRes.success).toBe(true);
    if (modelsRes.success) {
      expect(modelsRes.data.length).toBeGreaterThan(0);
      expect(modelsRes.data[0]?.tier).toBe("advanced");
    }

    const healthRes = await adapter.checkHealth();
    expect(healthRes.success).toBe(true);
    if (healthRes.success) {
      expect(healthRes.data.isHealthy).toBe(true);
      expect(healthRes.data.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("produces deterministic non-streaming responses with normalized usage metadata", async () => {
    const adapter = new MockModelAdapter("custom", {
      customOutputText: "Deterministic architecture guidance for Terrarium.",
      simulatedTokens: { prompt: 50, completion: 20 },
    });

    const res = await adapter.complete(sampleRequest);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.text).toBe("Deterministic architecture guidance for Terrarium.");
      expect(res.data.finishReason).toBe("stop");
      expect(res.data.usage.promptTokens).toBe(50);
      expect(res.data.usage.completionTokens).toBe(20);
      expect(res.data.usage.totalTokens).toBe(70);
      expect(res.data.usage.estimatedCostUsd).toBeDefined();
    }
  });

  it("yields streaming chunks and integrates with consumeStream", async () => {
    const adapter = new MockModelAdapter("custom", {
      customOutputText: "Terrarium multi-agent provider adapter layer verified.",
      chunkCount: 3,
    });

    const chunks: ModelStreamChunk[] = [];
    const stream = adapter.stream(sampleRequest);

    const compiledRes = await consumeStream(
      stream,
      { id: "test-stream-1", provider: "custom", model: "mock-flagship" },
      {
        onChunk: (_, chunk) => chunks.push(chunk),
      }
    );

    expect(compiledRes.success).toBe(true);
    expect(chunks.length).toBeGreaterThan(1);
    if (compiledRes.success) {
      expect(compiledRes.data.text).toBe("Terrarium multi-agent provider adapter layer verified.");
      expect(compiledRes.data.finishReason).toBe("stop");
      expect(compiledRes.data.usage.completionTokens).toBeGreaterThan(0);
    }
  });

  it("simulates transient failures and recovers on subsequent attempt", async () => {
    const adapter = new MockModelAdapter("custom", {
      failCount: 2, // Fails call 1 and 2, succeeds on call 3
    });

    const call1 = await adapter.complete(sampleRequest);
    expect(call1.success).toBe(false);

    const call2 = await adapter.complete(sampleRequest);
    expect(call2.success).toBe(false);

    const call3 = await adapter.complete(sampleRequest);
    expect(call3.success).toBe(true);
  });

  it("simulates rate limit responses with custom retryAfterMs", async () => {
    const adapter = new MockModelAdapter("custom", {
      simulateRateLimit: true,
      retryAfterMs: 3500,
    });

    const res = await adapter.complete(sampleRequest);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBeInstanceOf(ProviderRateLimitError);
      expect((res.error as ProviderRateLimitError).retryAfterMs).toBe(3500);
      expect(res.error.isRetryable).toBe(true);
    }
  });

  it("respects AbortSignal cancellation during completion", async () => {
    const adapter = new MockModelAdapter("custom", { delayMs: 100 });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);

    const res = await adapter.complete(sampleRequest, { signal: controller.signal });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.name).toBe("ProviderTimeoutError");
    }
  });
});
