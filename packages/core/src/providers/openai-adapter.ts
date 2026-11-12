/**
 * @terrarium/core - providers/openai-adapter.ts
 *
 * Production-ready OpenAI & OpenAI-compatible provider adapter.
 * Handles model discovery, non-streaming completions, SSE streaming, cancellation,
 * rate limit headers, error normalization, and token usage estimation.
 * Aligns with PLAN.md Section 10.4, Section 12 & Prompt 9 requirements.
 */

import {
  type ModelCapabilities,
  type ModelCompletionRequest,
  type ModelInfo,
  type ModelMessage,
  type ModelProviderAdapter,
  type ModelRequestOptions,
  type ModelResponse,
  type ModelStreamChunk,
  type ProviderError,
  type ProviderHealthCheckResult,
  type Result,
  ok,
  fail,
  ProviderAuthenticationError,
  ProviderInvalidRequestError,
  ProviderNetworkError,
  ProviderRateLimitError,
  ProviderServerError,
  ProviderTimeoutError,
} from "@terrarium/contracts";
import {
  calculateEstimatedCostUsd,
  DEFAULT_OPENAI_MODELS,
  KNOWN_OPENAI_PRICING,
  type FetchFunction,
  type ProviderAdapterConfig,
} from "./types.ts";
import { assertExternalCallAuthorized, sanitizeHeaders } from "./security.ts";

export type { FetchFunction };

export interface OpenAIAdapterOptions extends ProviderAdapterConfig {
  readonly fetchFn?: FetchFunction;
}

export class OpenAIProviderAdapter implements ModelProviderAdapter {
  readonly kind = "model_api" as const;
  readonly providerType = "openai" as const;
  readonly name = "OpenAI Provider Adapter";

  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly organizationId?: string;
  private readonly timeoutMs: number;
  private readonly allowExternalCalls: boolean;
  private readonly fetchFn: FetchFunction;

  constructor(options: Partial<OpenAIAdapterOptions> = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    this.organizationId = options.organizationId;
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.allowExternalCalls = options.allowExternalCalls ?? false;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  async getCapabilities(modelId = "gpt-4o"): Promise<Result<ModelCapabilities, ProviderError>> {
    const isReasoning = modelId.startsWith("o1");
    const pricing = KNOWN_OPENAI_PRICING[modelId] ?? { inputPer1M: 2.5, outputPer1M: 10.0 };

    return ok({
      contextWindow: 128000,
      maxOutputTokens: isReasoning ? 32768 : 4096,
      supportsStreaming: true,
      supportsTools: !isReasoning,
      supportsVision: true,
      supportsJsonMode: true,
      costPerInputToken: pricing.inputPer1M / 1_000_000,
      costPerOutputToken: pricing.outputPer1M / 1_000_000,
    });
  }

  async listModels(): Promise<Result<readonly ModelInfo[], ProviderError>> {
    // If external calls are unauthorized and not on localhost, return default seeded catalog
    const isLocal =
      this.baseUrl.includes("localhost") ||
      this.baseUrl.includes("127.0.0.1") ||
      this.baseUrl.includes("0.0.0.0");

    if (!isLocal && (!this.apiKey || !this.allowExternalCalls)) {
      return ok(DEFAULT_OPENAI_MODELS);
    }

    try {
      const headers = this.buildHeaders();
      const response = await this.fetchWithTimeout(`${this.baseUrl}/models`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        return ok(DEFAULT_OPENAI_MODELS);
      }

      const body = (await response.json()) as { data?: Array<{ id: string }> };
      if (!Array.isArray(body?.data)) {
        return ok(DEFAULT_OPENAI_MODELS);
      }

      const models: ModelInfo[] = body.data
        .filter((m) => m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.includes("claude") || m.id.includes("llama"))
        .map((m) => {
          const isFlagship = m.id.includes("4o") && !m.id.includes("mini");
          const isSpecialist = m.id.startsWith("o1");
          return {
            id: m.id,
            displayName: m.id,
            tier: isFlagship || isSpecialist ? ("advanced" as const) : ("standard" as const),
            contextWindow: 128000,
            supportsTools: !isSpecialist,
            supportsStreaming: true,
          };
        });

      return ok(models.length > 0 ? models : DEFAULT_OPENAI_MODELS);
    } catch {
      return ok(DEFAULT_OPENAI_MODELS);
    }
  }

  async complete(
    request: ModelCompletionRequest,
    options?: ModelRequestOptions
  ): Promise<Result<ModelResponse, ProviderError>> {
    const start = Date.now();

    // 1. Authorization guard
    const authCheck = assertExternalCallAuthorized(
      this.providerType,
      this.apiKey,
      this.allowExternalCalls || (options?.allowExternalCalls ?? false),
      this.baseUrl
    );
    if (!authCheck.success) {
      return fail(authCheck.error);
    }

    if (options?.signal?.aborted) {
      return fail(new ProviderTimeoutError("Request cancelled by caller signal", this.providerType, 0, request.model));
    }

    // 2. Format OpenAI request payload
    const payload = this.buildChatPayload(request, options, false);
    const headers = this.buildHeaders();

    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        },
        options?.timeoutMs ?? this.timeoutMs,
        options?.signal
      );

      if (!response.ok) {
        const error = await this.normalizeHttpError(response, request.model);
        return fail(error);
      }

      const data = (await response.json()) as any;
      const choice = data.choices?.[0];
      const text = choice?.message?.content ?? "";
      const finishReason = this.mapFinishReason(choice?.finish_reason);

      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;
      const estimatedCostUsd = calculateEstimatedCostUsd(request.model, promptTokens, completionTokens);

      return ok({
        id: data.id ?? `resp-${Date.now()}`,
        provider: this.providerType,
        model: request.model,
        text,
        finishReason,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
        },
        durationMs: Date.now() - start,
        toolCalls: choice?.message?.tool_calls,
        rawResponse: data,
      });
    } catch (err: any) {
      return fail(this.mapCatchError(err, request.model));
    }
  }

  async *stream(
    request: ModelCompletionRequest,
    options?: ModelRequestOptions
  ): AsyncIterable<Result<ModelStreamChunk, ProviderError>> {
    // 1. Authorization guard
    const authCheck = assertExternalCallAuthorized(
      this.providerType,
      this.apiKey,
      this.allowExternalCalls || (options?.allowExternalCalls ?? false),
      this.baseUrl
    );
    if (!authCheck.success) {
      yield fail(authCheck.error);
      return;
    }

    if (options?.signal?.aborted) {
      yield fail(new ProviderTimeoutError("Stream cancelled by caller signal", this.providerType, 0, request.model));
      return;
    }

    // 2. Format streaming request payload
    const payload = this.buildChatPayload(request, options, true);
    const headers = this.buildHeaders();

    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        `${this.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        },
        options?.timeoutMs ?? this.timeoutMs,
        options?.signal
      );
    } catch (err: any) {
      yield fail(this.mapCatchError(err, request.model));
      return;
    }

    if (!response.ok) {
      const error = await this.normalizeHttpError(response, request.model);
      yield fail(error);
      return;
    }

    if (!response.body) {
      yield fail(new ProviderServerError("Response body is empty", this.providerType, 500, request.model));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let chunkIndex = 0;

    const onCallerAbort = () => {
      try {
        reader.cancel();
      } catch {}
    };
    if (options?.signal) {
      options.signal.addEventListener("abort", onCallerAbort, { once: true });
    }

    try {
      while (true) {
        if (options?.signal?.aborted) {
          yield fail(new ProviderTimeoutError("Stream cancelled by caller signal", this.providerType, 0, request.model));
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const dataStr = trimmed.slice(6).trim();
          if (dataStr === "[DONE]") {
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const choice = parsed.choices?.[0];
            const deltaText = choice?.delta?.content ?? "";
            const finishReason = choice?.finish_reason ? this.mapFinishReason(choice.finish_reason) : undefined;
            const usage = parsed.usage
              ? {
                  promptTokens: parsed.usage.prompt_tokens ?? 0,
                  completionTokens: parsed.usage.completion_tokens ?? 0,
                  totalTokens: parsed.usage.total_tokens ?? 0,
                  estimatedCostUsd: calculateEstimatedCostUsd(
                    request.model,
                    parsed.usage.prompt_tokens ?? 0,
                    parsed.usage.completion_tokens ?? 0
                  ),
                }
              : undefined;

            yield ok({
              index: chunkIndex++,
              deltaText,
              finishReason,
              usage,
              toolCalls: choice?.delta?.tool_calls,
            });
          } catch {
            // Ignore malformed intermediate SSE lines
          }
        }
      }
    } catch (err: any) {
      yield fail(this.mapCatchError(err, request.model));
    } finally {
      if (options?.signal) {
        options.signal.removeEventListener("abort", onCallerAbort);
      }
      reader.releaseLock();
    }
  }

  async checkHealth(): Promise<Result<ProviderHealthCheckResult, ProviderError>> {
    const start = Date.now();
    try {
      const headers = this.buildHeaders();
      const response = await this.fetchWithTimeout(`${this.baseUrl}/models`, {
        method: "GET",
        headers,
      });

      const latencyMs = Date.now() - start;
      if (response.ok) {
        return ok({
          isHealthy: true,
          latencyMs,
          message: "Provider endpoint is reachable and responsive.",
          timestamp: new Date().toISOString(),
        });
      }

      if (response.status === 401 || response.status === 403) {
        return ok({
          isHealthy: false,
          latencyMs,
          message: "Endpoint reachable but authentication failed. Check configured API key.",
          timestamp: new Date().toISOString(),
        });
      }

      return ok({
        isHealthy: false,
        latencyMs,
        message: `Endpoint returned HTTP status ${response.status}`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return ok({
        isHealthy: false,
        latencyMs: Date.now() - start,
        message: `Connection failed: ${err.message ?? "Network error"}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // --- Private Helpers ---

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    if (this.organizationId) {
      headers["OpenAI-Organization"] = this.organizationId;
    }

    return headers;
  }

  private buildChatPayload(
    request: ModelCompletionRequest,
    options?: ModelRequestOptions,
    isStream = false
  ): Record<string, unknown> {
    const opts = { ...(request.options ?? {}), ...(options ?? {}) };

    const messages = request.messages.map((m) => {
      const msgObj: Record<string, unknown> = {
        role: m.role,
        content: m.content,
      };
      if (m.name) msgObj.name = m.name;
      if (m.toolCallId) msgObj.tool_call_id = m.toolCallId;
      if (m.toolCalls) msgObj.tool_calls = m.toolCalls;
      return msgObj;
    });

    const payload: Record<string, unknown> = {
      model: request.model,
      messages,
      temperature: opts.temperature ?? 0.7,
    };

    if (opts.maxTokens) payload.max_tokens = opts.maxTokens;
    if (opts.topP) payload.top_p = opts.topP;
    if (opts.stopSequences) payload.stop = opts.stopSequences;
    if (opts.tools) payload.tools = opts.tools;

    if (isStream) {
      payload.stream = true;
      payload.stream_options = { include_usage: true };
    }

    return payload;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs = this.timeoutMs,
    callerSignal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const onCallerAbort = () => controller.abort();
    if (callerSignal) {
      callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }

    try {
      return await this.fetchFn(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
      if (callerSignal) {
        callerSignal.removeEventListener("abort", onCallerAbort);
      }
    }
  }

  private async normalizeHttpError(response: Response, model: string): Promise<ProviderError> {
    const status = response.status;
    let message = `Provider HTTP error ${status}`;

    try {
      const errJson = (await response.json()) as any;
      message = errJson.error?.message || errJson.message || message;
    } catch {
      // response body was not JSON
    }

    if (status === 401 || status === 403) {
      return new ProviderAuthenticationError(message, this.providerType, model);
    }

    if (status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      const retryAfterMs = !isNaN(retryAfterSeconds ?? NaN) ? retryAfterSeconds! * 1000 : 2000;
      return new ProviderRateLimitError(message, this.providerType, retryAfterMs, model);
    }

    if (status === 400) {
      return new ProviderInvalidRequestError(message, this.providerType, model);
    }

    if (status >= 500) {
      return new ProviderServerError(message, this.providerType, status, model);
    }

    return new ProviderServerError(message, this.providerType, status, model);
  }

  private mapCatchError(err: any, model: string): ProviderError {
    if (err?.name === "AbortError") {
      return new ProviderTimeoutError("Provider request timed out or was cancelled", this.providerType, this.timeoutMs, model);
    }

    if (err instanceof TypeError || err?.code === "ECONNREFUSED" || err?.message?.includes("fetch failed")) {
      return new ProviderNetworkError(
        `Failed to connect to ${this.baseUrl}: ${err.message ?? "Connection refused"}`,
        this.providerType,
        model
      );
    }

    return new ProviderServerError(err?.message ?? "Unknown provider communication failure", this.providerType, 500, model);
  }

  private mapFinishReason(raw?: string): any {
    switch (raw) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool_calls":
        return "tool_calls";
      case "content_filter":
        return "content_filter";
      default:
        return "stop";
    }
  }
}
