/**
 * @terrarium/core - providers/ollama-adapter.ts
 *
 * Production-ready Ollama local provider adapter implementing ModelProviderAdapter.
 * Enables 100% private, zero-cost, offline execution with zero external data egress.
 * Connects via local loopback REST endpoints (/api/chat, /api/tags, /api/version).
 * Aligns with PLAN.md Section 12 & PROMPT 19 requirements (A2 - Adapter Runtime).
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
  type ModelToolCall,
  type ProviderError,
  type ProviderHealthCheckResult,
  type Result,
  ok,
  fail,
  ProviderNetworkError,
  ProviderTimeoutError,
  ProviderInvalidRequestError,
  ProviderServerError,
} from "@terrarium/contracts";
import {
  DEFAULT_OLLAMA_MODELS,
  KNOWN_OLLAMA_PRICING,
  type FetchFunction,
  type ProviderAdapterConfig,
} from "./types.ts";

export interface OllamaAdapterOptions extends Partial<ProviderAdapterConfig> {
  readonly fetchFn?: FetchFunction;
}

export class OllamaProviderAdapter implements ModelProviderAdapter {
  readonly kind = "model_api" as const;
  readonly providerType = "ollama" as const;
  readonly name = "Ollama Local Provider Adapter";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchFunction;

  constructor(options: OllamaAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:11434").replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 60000;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  async getCapabilities(modelId = "llama3.2"): Promise<Result<ModelCapabilities, ProviderError>> {
    const isCode = modelId.includes("coder") || modelId.includes("codellama");
    const supportsTools = !modelId.includes("deepseek") && !modelId.includes("codellama");

    return ok({
      contextWindow: isCode ? 32768 : 128000,
      maxOutputTokens: 4096,
      supportsStreaming: true,
      supportsTools,
      supportsVision: modelId.includes("vision") || modelId.includes("llava"),
      supportsJsonMode: true,
      costPerInputToken: 0.0,
      costPerOutputToken: 0.0,
    });
  }

  async listModels(): Promise<Result<readonly ModelInfo[], ProviderError>> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/tags`, {
        method: "GET",
      });

      if (!response.ok) {
        return ok(DEFAULT_OLLAMA_MODELS);
      }

      const data = (await response.json()) as any;
      if (!Array.isArray(data?.models) || data.models.length === 0) {
        return ok(DEFAULT_OLLAMA_MODELS);
      }

      const discovered: ModelInfo[] = data.models.map((m: any) => {
        const id = m.name ?? m.model ?? "unknown";
        const isAdvanced = id.includes("coder") || id.includes("r1") || id.includes("70b");
        return {
          id,
          displayName: `${id} (${m.details?.parameter_size ?? "Local Model"})`,
          tier: isAdvanced ? "advanced" : "standard",
          contextWindow: id.includes("coder") ? 32768 : 128000,
          supportsTools: !id.includes("deepseek") && !id.includes("codellama"),
          supportsStreaming: true,
          costPerInputToken: 0.0,
          costPerOutputToken: 0.0,
        };
      });

      return ok(discovered);
    } catch {
      // Disconnected or offline local daemon falls back to default catalogue without crashing
      return ok(DEFAULT_OLLAMA_MODELS);
    }
  }

  async complete(
    request: ModelCompletionRequest,
    options?: ModelRequestOptions
  ): Promise<Result<ModelResponse, ProviderError>> {
    const startTime = Date.now();

    try {
      const payload = this.buildRequestBody(request, options, false);

      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: options?.signal,
      });

      if (!response.ok) {
        return fail(await this.mapErrorResponse(response));
      }

      const data = (await response.json()) as any;
      const durationMs = Date.now() - startTime;

      const text = data.message?.content ?? "";
      const toolCalls: ModelToolCall[] = [];

      if (Array.isArray(data.message?.tool_calls)) {
        for (const tc of data.message.tool_calls) {
          toolCalls.push({
            id: tc.id ?? `tool_${Date.now()}`,
            type: "function",
            function: {
              name: tc.function?.name ?? "unknown",
              arguments: typeof tc.function?.arguments === "string"
                ? tc.function.arguments
                : JSON.stringify(tc.function?.arguments ?? {}),
            },
          });
        }
      }

      const promptTokens = data.prompt_eval_count ?? 0;
      const completionTokens = data.eval_count ?? 0;
      const totalTokens = promptTokens + completionTokens;

      return ok({
        id: `ollama_${Date.now()}`,
        provider: "ollama",
        model: data.model ?? request.model,
        text,
        finishReason: data.done ? "stop" : "length",
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd: 0.0,
          isEstimate: false,
        },
        durationMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        rawResponse: data,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return fail(new ProviderTimeoutError(`Request timed out after ${this.timeoutMs}ms`, "ollama", this.timeoutMs, request.model));
      }
      return fail(new ProviderNetworkError(`Ollama offline or connection failed: ${err instanceof Error ? err.message : String(err)}`, "ollama", request.model));
    }
  }

  async *stream(
    request: ModelCompletionRequest,
    options?: ModelRequestOptions
  ): AsyncIterable<Result<ModelStreamChunk, ProviderError>> {
    try {
      const payload = this.buildRequestBody(request, options, true);

      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: options?.signal,
      });

      if (!response.ok) {
        yield fail(await this.mapErrorResponse(response, request.model));
        return;
      }

      if (!response.body) {
        yield fail(new ProviderNetworkError("No response body returned from Ollama stream", "ollama", request.model));
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
          if (!trimmed) continue;

          try {
            const data = JSON.parse(trimmed);
            const deltaText = data.message?.content ?? "";

            if (data.done) {
              const promptTokens = data.prompt_eval_count ?? 0;
              const completionTokens = data.eval_count ?? 0;
              yield ok({
                index: chunkIndex++,
                deltaText,
                finishReason: "stop",
                usage: {
                  promptTokens,
                  completionTokens,
                  totalTokens: promptTokens + completionTokens,
                  estimatedCostUsd: 0.0,
                },
              });
            } else if (deltaText) {
              yield ok({
                index: chunkIndex++,
                deltaText,
              });
            }
          } catch {
            // Ignore parse errors on partial chunks
          }
        }
      }

      // Process any remaining content in buffer after stream ends
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim());
          const deltaText = data.message?.content ?? "";
          if (data.done) {
            const promptTokens = data.prompt_eval_count ?? 0;
            const completionTokens = data.eval_count ?? 0;
            yield ok({
              index: chunkIndex++,
              deltaText,
              finishReason: "stop",
              usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                estimatedCostUsd: 0.0,
              },
            });
          } else if (deltaText) {
            yield ok({
              index: chunkIndex++,
              deltaText,
            });
          }
        } catch {
          // Ignore parse errors
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        yield fail(new ProviderTimeoutError(`Ollama stream timed out after ${this.timeoutMs}ms`, "ollama", this.timeoutMs, request.model));
        return;
      }
      yield fail(new ProviderNetworkError(`Ollama stream error: ${err instanceof Error ? err.message : String(err)}`, "ollama", request.model));
    }
  }

  async checkHealth(): Promise<Result<ProviderHealthCheckResult, ProviderError>> {
    const start = Date.now();
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/version`, {
        method: "GET",
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        return ok({
          isHealthy: true,
          latencyMs: Date.now() - start,
          message: `Ollama daemon active (version: ${data.version ?? "unknown"}) at ${this.baseUrl}`,
          timestamp: new Date().toISOString(),
        });
      }

      return ok({
        isHealthy: false,
        latencyMs: Date.now() - start,
        message: `Ollama returned HTTP ${response.status} at ${this.baseUrl}`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      return ok({
        isHealthy: false,
        latencyMs: Date.now() - start,
        message: `Ollama daemon not reachable at ${this.baseUrl}. Start Ollama with 'ollama serve' or check connection.`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private buildRequestBody(
    request: ModelCompletionRequest,
    options?: ModelRequestOptions,
    stream = false
  ): Record<string, unknown> {
    const messages = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const payload: Record<string, unknown> = {
      model: request.model,
      messages,
      stream,
    };

    const optObj: Record<string, unknown> = {};
    if (options?.temperature !== undefined) optObj.temperature = options.temperature;
    if (options?.topP !== undefined) optObj.top_p = options.topP;
    if (options?.maxTokens !== undefined) optObj.num_predict = options.maxTokens;
    if (options?.stopSequences && options.stopSequences.length > 0) optObj.stop = options.stopSequences;

    if (Object.keys(optObj).length > 0) {
      payload.options = optObj;
    }

    if (options?.tools && options.tools.length > 0) {
      payload.tools = options.tools;
    }

    return payload;
  }

  private async mapErrorResponse(response: Response, model?: string): Promise<ProviderError> {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as any;
      if (body?.error) {
        errorDetail = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
      }
    } catch {
      // Keep status text
    }

    if (response.status === 404) {
      return new ProviderInvalidRequestError(`Model not found on Ollama server: ${errorDetail}. Pull it via 'ollama pull <model>'.`, "ollama", model);
    }
    if (response.status >= 500) {
      return new ProviderServerError(`Ollama internal error (${response.status}): ${errorDetail}`, "ollama", response.status, model);
    }
    return new ProviderNetworkError(`Ollama request failed (${response.status}): ${errorDetail}`, "ollama", model);
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
