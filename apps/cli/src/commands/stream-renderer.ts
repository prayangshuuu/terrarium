/**
 * @terrarium/cli - commands/stream-renderer.ts
 *
 * Terminal streaming UX helper for real-time model token delivery and live status indicators.
 * Aligns with Prompt 9 (A4 - streaming UX) and OpenTUI design principles.
 */

import {
  type ModelStreamChunk,
  type ProviderError,
  type Result,
  ok,
  fail,
} from "@terrarium/contracts";

export interface TerminalStreamOptions {
  readonly useColor?: boolean;
  readonly showTokenCounter?: boolean;
  readonly showTimer?: boolean;
  readonly prefix?: string;
  readonly onChunk?: (chunk: string) => void;
  readonly writeFn?: (chunk: string) => void;
}

export interface StreamRenderResult {
  readonly text: string;
  readonly tokenCount: number;
  readonly durationMs: number;
  readonly formattedSummary: string;
}

/**
 * Consumes and renders a live model stream to the terminal with real-time feedback.
 */
export async function renderStreamToTerminal(
  stream: AsyncIterable<Result<ModelStreamChunk, ProviderError>>,
  options: TerminalStreamOptions = {}
): Promise<Result<StreamRenderResult, ProviderError>> {
  const start = Date.now();
  let fullText = "";
  let tokenCount = 0;
  const write = options.writeFn ?? ((c: string) => process.stdout.write(c));
  const useColor = options.useColor ?? false;

  const cyan = useColor ? "\x1b[36m" : "";
  const dim = useColor ? "\x1b[2m" : "";
  const reset = useColor ? "\x1b[0m" : "";

  if (options.prefix) {
    write(options.prefix);
  }

  for await (const chunkRes of stream) {
    if (!chunkRes.success) {
      write("\n");
      return fail(chunkRes.error);
    }

    const chunk = chunkRes.data;
    if (chunk.deltaText) {
      fullText += chunk.deltaText;
      tokenCount += Math.max(1, Math.round(chunk.deltaText.length / 4));
      write(chunk.deltaText);
      if (options.onChunk) {
        options.onChunk(chunk.deltaText);
      }
    }

    if (chunk.usage?.completionTokens) {
      tokenCount = chunk.usage.completionTokens;
    }
  }

  const durationMs = Date.now() - start;
  const elapsedSec = (durationMs / 1000).toFixed(2);
  const tps = durationMs > 0 ? ((tokenCount / durationMs) * 1000).toFixed(1) : "0.0";

  const summary = `\n${dim}[streamed ${tokenCount} tokens in ${elapsedSec}s • ${tps} tok/s]${reset}\n`;

  return ok({
    text: fullText,
    tokenCount,
    durationMs,
    formattedSummary: summary,
  });
}
