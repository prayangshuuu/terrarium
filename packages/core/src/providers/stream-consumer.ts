/**
 * @terrarium/core - providers/stream-consumer.ts
 *
 * Stream consumer utilities and terminal rendering helpers for model responses.
 * Provides chunk accumulation, token tracking, and structured callbacks for OpenTUI and CLI.
 * Aligns with Prompt 9 (A4 - streaming UX) and PLAN.md Section 16.
 */

import {
  type ModelFinishReason,
  type ModelResponse,
  type ModelStreamChunk,
  type NormalizedUsageMetadata,
  type ProviderError,
  type ProviderType,
  type Result,
  ok,
  fail,
} from "@terrarium/contracts";

export interface StreamUxCallbacks {
  readonly onChunk?: (deltaText: string, chunk: ModelStreamChunk) => void;
  readonly onTokenEstimate?: (tokenCount: number) => void;
  readonly onFinish?: (finishReason: ModelFinishReason) => void;
}

/**
 * Consumes an async stream of chunks, invoking callbacks for real-time UX updates,
 * and compiles the entire stream into a final ModelResponse.
 */
export async function consumeStream(
  stream: AsyncIterable<Result<ModelStreamChunk, ProviderError>>,
  metadata: {
    readonly id: string;
    readonly provider: ProviderType;
    readonly model: string;
  },
  callbacks: StreamUxCallbacks = {}
): Promise<Result<ModelResponse, ProviderError>> {
  const start = Date.now();
  let fullText = "";
  let finalFinishReason: ModelFinishReason = "stop";
  let finalUsage: NormalizedUsageMetadata | undefined;
  let estimatedTokens = 0;

  for await (const chunkRes of stream) {
    if (!chunkRes.success) {
      return fail(chunkRes.error);
    }

    const chunk = chunkRes.data;
    if (chunk.deltaText) {
      fullText += chunk.deltaText;
      estimatedTokens += Math.max(1, Math.round(chunk.deltaText.length / 4));
      if (callbacks.onChunk) {
        callbacks.onChunk(chunk.deltaText, chunk);
      }
      if (callbacks.onTokenEstimate) {
        callbacks.onTokenEstimate(estimatedTokens);
      }
    }

    if (chunk.finishReason) {
      finalFinishReason = chunk.finishReason;
      if (callbacks.onFinish) {
        callbacks.onFinish(chunk.finishReason);
      }
    }

    if (chunk.usage) {
      finalUsage = chunk.usage;
    }
  }

  const durationMs = Date.now() - start;
  const usage: NormalizedUsageMetadata = finalUsage ?? {
    promptTokens: 0,
    completionTokens: estimatedTokens,
    totalTokens: estimatedTokens,
  };

  return ok({
    id: metadata.id,
    provider: metadata.provider,
    model: metadata.model,
    text: fullText,
    finishReason: finalFinishReason,
    usage,
    durationMs,
  });
}
