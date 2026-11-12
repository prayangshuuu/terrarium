/**
 * @terrarium/core - providers/gemini-adapter.ts
 *
 * Production-ready Google Gemini provider adapter implementing ModelProviderAdapter.
 * Supports massive context window models (Gemini 1.5 Pro with 2M tokens, Gemini 1.5 Flash).
 * Handles Google Generative AI REST endpoints (:generateContent, :streamGenerateContent).
 * Aligns with PLAN.md Section 12 & PROMPT 19 requirements (A2 - Adapter Runtime).
 */

import {
  type ModelCapabilities,
  type ModelCompletionRequest,
  type ModelFinishReason,
  type ModelInfo,
  type ModelMessage,
  type ModelProviderAdapter,
  type ModelRequestOptions,
  type ModelResponse,
  type ModelStreamChunk,
  type ModelToolCall,
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
  DEFAULT_GEMINI_MODELS,
  KNOWN_GEMINI_PRICING,
  type FetchFunction,
  type ProviderAdapterConfig,
} from "./types.ts";
import { assertExternalCallAuthorized, sanitizeHeaders } from "./security.ts";

export interface GeminiAdapterOptions extends ProviderAdapterConfig {
  readonly fetchFn?: FetchFunction;
}

export class GeminiProviderAdapter implements ModelProviderAdapter {
  readonly kind = "model_api" as const;
  readonly providerType = "gemini" as const;
  readonly name = "Google Gemini Provider Adapter";

  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly allowExternalCalls: boolean;
  private readonly fetchFn: FetchFunction;

  constructor(options: Partial<GeminiAdapterOptions> = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.allowExternalCalls = options.allowExternalCalls ?? false;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  async getCapabilities(modelId = "gemini-1.5-pro"): Promise<Result<ModelCapabilities, ProviderError>> {
    const isFlash = modelId.includes("flash");
    const pricing = KNOWN_GEMINI_PRICING[modelId] ?? { inputPer1M: 1.25, outputPer1M: 5.0 };

    return ok({
      contextWindow: isFlash ? 1000000 : 2000000,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
      supportsJsonMode: true,
      costPerInputToken: pricing.inputPer1M / 1_000_000,
      costPerOutputToken: pricing.outputPer1M / 1_000_000,
    });
  }

  async listModels(): Promise<Result<readonly ModelInfo[], ProviderError>> {
    return ok(DEFAULT_GEMINI_MODELS);
  }

  async complete(
    request: ModelCompletionRequest,
    options?: ModelRequestOptions
  ): Promise<Result<ModelResponse, ProviderError>> {
    const startTime = Date.now();
    const allowExternal = options?.allowExternalCalls ?? this.allowExternalCalls;

    const authCheck = assertExternalCallAuthorized("gemini", this.apiKey, allowExternal, this.baseUrl);
    if (!authCheck.success) {
      return fail(authCheck.error);
    }

    try {
      const payload = this.buildRequestBody(request, options);
      const headers = this.buildHeaders();
      const modelName = request.model.startsWith("models/") ? request.model : `models/${request.model}`;
      const url = `${this.baseUrl}/v1beta/${modelName}:generateContent`;

      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: options?.signal,
      });

      if (!response.ok) {
        return fail(await this.mapErrorResponse(response));
      }

      const data = (await response.json()) as any;
      const durationMs = Date.now() - startTime;

      const candidate = data.candidates?.[0];
      let text = "";
      const toolCalls: ModelToolCall[] = [];

      if (Array.isArray(candidate?.content?.parts)) {
        for (const part of candidate.content.parts) {
          if (typeof part.text === "string") {
            text += part.text;
          } else if (part.functionCall) {
            toolCalls.push({
              id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: "function",
              function: {
                name: part.functionCall.name,
                arguments: typeof part.functionCall.args === "string"
                  ? part.functionCall.args
                  : JSON.stringify(part.functionCall.args ?? {}),
              },
            });
          }
        }
      }

      const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
      const totalTokens = data.usageMetadata?.totalTokenCount ?? (inputTokens + outputTokens);
      const estimatedCostUsd = calculateEstimatedCostUsd(request.model, inputTokens, outputTokens);

      const finishReason = this.mapFinishReason(candidate?.finishReason);

      return ok({
        id: `gemini_${Date.now()}`,
        provider: "gemini",
        model: request.model,
        text,
        finishReason,
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens,
          estimatedCostUsd,
          isEstimate: false,
        },
        durationMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        rawResponse: data,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return fail(new ProviderTimeoutError(`Request timed out after ${this.timeoutMs}ms`, "gemini", this.timeoutMs, request.model));
      }
      return fail(new ProviderNetworkError(`Network error: ${err instanceof Error ? err.message : String(err)}`, "gemini", request.model));
    }
  }

  async *stream(
    request: ModelCompletionRequest,
    options?: ModelRequestOptions
  ): AsyncIterable<Result<ModelStreamChunk, ProviderError>> {
    const allowExternal = options?.allowExternalCalls ?? this.allowExternalCalls;

    const authCheck = assertExternalCallAuthorized("gemini", this.apiKey, allowExternal, this.baseUrl);
    if (!authCheck.success) {
      yield fail(authCheck.error);
      return;
    }

    try {
      const payload = this.buildRequestBody(request, options);
      const headers = this.buildHeaders();
      const modelName = request.model.startsWith("models/") ? request.model : `models/${request.model}`;
      const url = `${this.baseUrl}/v1beta/${modelName}:streamGenerateContent?alt=sse`;

      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: options?.signal,
      });

      if (!response.ok) {
        yield fail(await this.mapErrorResponse(response, request.model));
        return;
      }

      if (!response.body) {
        yield fail(new ProviderNetworkError("No response body returned from Gemini stream", "gemini", request.model));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let chunkIndex = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);
            const candidate = data.candidates?.[0];
            const partText = candidate?.content?.parts?.[0]?.text ?? "";

            if (partText) {
              yield ok({
                index: chunkIndex++,
                deltaText: partText,
              });
            }

            if (candidate?.finishReason) {
              const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
              const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
              yield ok({
                index: chunkIndex++,
                deltaText: "",
                finishReason: this.mapFinishReason(candidate.finishReason),
                usage: {
                  promptTokens,
                  completionTokens,
                  totalTokens: promptTokens + completionTokens,
                  estimatedCostUsd: calculateEstimatedCostUsd(request.model, promptTokens, completionTokens),
                },
              });
            }
          } catch {
            // Ignore parse errors on partial frames
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        yield fail(new ProviderTimeoutError(`Stream timed out after ${this.timeoutMs}ms`, "gemini", this.timeoutMs, request.model));
        return;
      }
      yield fail(new ProviderNetworkError(`Stream error: ${err instanceof Error ? err.message : String(err)}`, "gemini", request.model));
    }
  }

  async checkHealth(): Promise<Result<ProviderHealthCheckResult, ProviderError>> {
    const start = Date.now();
    if (!this.apiKey || this.apiKey.trim() === "") {
      return ok({
        isHealthy: false,
        latencyMs: 0,
        message: "Google Gemini API key is not configured. Set GEMINI_API_KEY in environment or .env.",
        timestamp: new Date().toISOString(),
      });
    }

    if (!this.allowExternalCalls) {
      return ok({
        isHealthy: true,
        latencyMs: 0,
        message: "Gemini credentials configured. External calls disabled by environment policy.",
        timestamp: new Date().toISOString(),
      });
    }

    return ok({
      isHealthy: true,
      latencyMs: Date.now() - start,
      message: "Google Gemini API ready and accessible",
      timestamp: new Date().toISOString(),
    });
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["x-goog-api-key"] = this.apiKey;
    }
    return headers;
  }

  private buildRequestBody(
    request: ModelCompletionRequest,
    options?: ModelRequestOptions
  ): Record<string, unknown> {
    let systemInstructionText: string | undefined;
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    for (const msg of request.messages) {
      if (msg.role === "system") {
        systemInstructionText = systemInstructionText
          ? `${systemInstructionText}\n\n${msg.content}`
          : msg.content;
      } else {
        const role = msg.role === "assistant" ? "model" : "user";
        contents.push({
          role,
          parts: [{ text: msg.content }],
        });
      }
    }

    const payload: Record<string, unknown> = {
      contents,
    };

    if (systemInstructionText) {
      payload.systemInstruction = {
        parts: [{ text: systemInstructionText }],
      };
    }

    const generationConfig: Record<string, unknown> = {};
    if (options?.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options?.topP !== undefined) generationConfig.topP = options.topP;
    if (options?.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
    if (options?.stopSequences && options.stopSequences.length > 0) {
      generationConfig.stopSequences = options.stopSequences;
    }

    if (Object.keys(generationConfig).length > 0) {
      payload.generationConfig = generationConfig;
    }

    return payload;
  }

  private mapFinishReason(finishReason?: string): ModelFinishReason {
    switch (finishReason) {
      case "STOP":
        return "stop";
      case "MAX_TOKENS":
        return "length";
      case "SAFETY":
        return "content_filter";
      default:
        return "stop";
    }
  }

  private async mapErrorResponse(response: Response, model?: string): Promise<ProviderError> {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as any;
      if (body?.error?.message) {
        errorDetail = body.error.message;
      }
    } catch {
      // Keep status text
    }

    switch (response.status) {
      case 400:
        if (errorDetail.toLowerCase().includes("api key")) {
          return new ProviderAuthenticationError(`Invalid Google API key: ${errorDetail}`, "gemini", model);
        }
        return new ProviderInvalidRequestError(`Invalid request: ${errorDetail}`, "gemini", model);
      case 403:
        return new ProviderAuthenticationError(`Authentication/permission denied: ${errorDetail}`, "gemini", model);
      case 429:
        return new ProviderRateLimitError(`Quota/Rate limit exceeded: ${errorDetail}`, "gemini", 2000, model);
      case 500:
      case 503:
        return new ProviderServerError(`Gemini server error (${response.status}): ${errorDetail}`, "gemini", response.status, model);
      default:
        return new ProviderNetworkError(`Request failed (${response.status}): ${errorDetail}`, "gemini", model);
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const mergedSignal = init.signal
      ? (init.signal as any).race
        ? (init.signal as any).race([controller.signal])
        : controller.signal
      : controller.signal;

    try {
      return await this.fetchFn(url, { ...init, signal: mergedSignal });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
