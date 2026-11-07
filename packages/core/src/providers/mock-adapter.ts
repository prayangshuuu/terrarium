/**
 * @terrarium/core - providers/mock-adapter.ts
 *
 * Deterministic offline mock model provider adapter.
 * Enables zero-cost contract testing, error simulation, and offline unit/integration test suites.
 * Aligns with PLAN.md Section 12 & Prompt 9 requirements.
 */

import {
  type ModelCapabilities,
  type ModelCompletionRequest,
  type ModelInfo,
  type ModelProviderAdapter,
  type ModelRequestOptions,
  type ModelResponse,
  type ModelStreamChunk,
  type ProviderError,
  type ProviderHealthCheckResult,
  type ProviderType,
  type Result,
  ok,
  fail,
  ProviderRateLimitError,
  ProviderServerError,
  ProviderTimeoutError,
} from "@terrarium/contracts";

export interface MockModelBehavior {
  readonly customOutputText?: string;
  readonly failCount?: number; // Fail the first N calls with transient error
  readonly permanentError?: ProviderError;
  readonly delayMs?: number;
  readonly simulateRateLimit?: boolean;
  readonly retryAfterMs?: number;
  readonly simulatedTokens?: { prompt: number; completion: number };
  readonly chunkCount?: number;
}

export class MockModelAdapter implements ModelProviderAdapter {
  readonly kind = "model_api" as const;
  readonly providerType: ProviderType;
  readonly name: string;
  private readonly behavior: MockModelBehavior;
  private callCount = 0;

  constructor(
    providerType: ProviderType = "custom",
    behavior: MockModelBehavior = {},
    name = "Mock Provider Adapter"
  ) {
    this.providerType = providerType;
    this.behavior = behavior;
    this.name = name;
  }

  async getCapabilities(modelId?: string): Promise<Result<ModelCapabilities, ProviderError>> {
    return ok({
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
      supportsJsonMode: true,
      costPerInputToken: 0.000001,
      costPerOutputToken: 0.000003,
    });
  }

  async listModels(): Promise<Result<readonly ModelInfo[], ProviderError>> {
    return ok([
      {
        id: "mock-flagship",
        displayName: "Mock Flagship Reasoning Model",
        tier: "advanced",
        contextWindow: 128000,
        supportsTools: true,
        supportsStreaming: true,
        costPerInputToken: 0.0000025,
        costPerOutputToken: 0.00001,
      },
      {
        id: "mock-standard",
        displayName: "Mock Standard Model",
        tier: "standard",
        contextWindow: 64000,
        supportsTools: true,
        supportsStreaming: true,
        costPerInputToken: 0.0000005,
        costPerOutputToken: 0.0000015,
      },
    ]);
  }

  async complete(
    request: ModelCompletionRequest,
    options?: ModelRequestOptions
  ): Promise<Result<ModelResponse, ProviderError>> {
    const start = Date.now();
    this.callCount++;

    if (options?.signal?.aborted) {
      return fail(new ProviderTimeoutError("Request aborted by caller signal", this.providerType, 0));
    }

    if (this.behavior.delayMs && this.behavior.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.behavior.delayMs));
    }

    if (options?.signal?.aborted) {
      return fail(new ProviderTimeoutError("Request aborted by caller signal", this.providerType, 0));
    }

    if (this.behavior.permanentError) {
      return fail(this.behavior.permanentError);
    }

    if (this.behavior.simulateRateLimit) {
      return fail(
        new ProviderRateLimitError(
          "Rate limit exceeded (simulated)",
          this.providerType,
          this.behavior.retryAfterMs ?? 1000,
          request.model
        )
      );
    }

    const failCount = this.behavior.failCount ?? 0;
    if (this.callCount <= failCount) {
      return fail(
        new ProviderServerError(
          `Simulated upstream transient failure (attempt ${this.callCount}/${failCount})`,
          this.providerType,
          503,
          request.model
        )
      );
    }

    const promptTokens =
      this.behavior.simulatedTokens?.prompt ??
      request.messages.reduce((sum, m) => sum + Math.max(1, Math.round(m.content.length / 4)), 10);
    const text =
      this.behavior.customOutputText ??
      `Mock response for prompt (${request.messages.length} messages) using model '${request.model}'.`;
    const completionTokens =
      this.behavior.simulatedTokens?.completion ?? Math.max(1, Math.round(text.length / 4));
    const totalTokens = promptTokens + completionTokens;

    return ok({
      id: `mock-resp-${Date.now()}-${this.callCount}`,
      provider: this.providerType,
      model: request.model,
      text,
      finishReason: "stop",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: totalTokens * 0.000002,
      },
      durationMs: Date.now() - start,
    });
  }

  async *stream(
    request: ModelCompletionRequest,
    options?: ModelRequestOptions
  ): AsyncIterable<Result<ModelStreamChunk, ProviderError>> {
    this.callCount++;

    if (options?.signal?.aborted) {
      yield fail(new ProviderTimeoutError("Stream aborted by signal", this.providerType, 0));
      return;
    }

    if (this.behavior.permanentError) {
      yield fail(this.behavior.permanentError);
      return;
    }

    const text =
      this.behavior.customOutputText ??
      `Mock streamed response for prompt (${request.messages.length} messages) using model '${request.model}'.`;

    const chunkCount = this.behavior.chunkCount ?? 5;
    const words = text.split(" ");
    const wordsPerChunk = Math.max(1, Math.ceil(words.length / chunkCount));

    let index = 0;
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      if (options?.signal?.aborted) {
        yield fail(new ProviderTimeoutError("Stream aborted by caller signal", this.providerType, 0));
        return;
      }

      if (this.behavior.delayMs && this.behavior.delayMs > 0) {
        await new Promise((r) => setTimeout(r, Math.round(this.behavior.delayMs! / chunkCount)));
      }

      const chunkWords = words.slice(i, i + wordsPerChunk);
      const deltaText = (i === 0 ? "" : " ") + chunkWords.join(" ");
      const isLast = i + wordsPerChunk >= words.length;

      yield ok({
        index: index++,
        deltaText,
        finishReason: isLast ? "stop" : undefined,
        usage: isLast
          ? {
              promptTokens: 25,
              completionTokens: words.length,
              totalTokens: 25 + words.length,
              estimatedCostUsd: 0.00005,
            }
          : undefined,
      });
    }
  }

  async checkHealth(): Promise<Result<ProviderHealthCheckResult, ProviderError>> {
    return ok({
      isHealthy: true,
      latencyMs: 12,
      message: "Mock provider is operational (offline test double).",
      timestamp: new Date().toISOString(),
    });
  }
}
