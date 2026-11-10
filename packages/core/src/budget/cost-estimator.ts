/**
 * @terrarium/core - budget/cost-estimator.ts
 *
 * Normalizes model usage, calculates dollar spend, and provides safe fallback estimation
 * when providers return missing or partial usage metadata.
 * Aligns strictly with PLAN.md Section 13 (Token, Cost, & Performance Management).
 */

import {
  type NormalizedUsageMetadata,
  calculateEstimatedCostUsd,
} from "@terrarium/contracts";

/**
 * Fallback token estimation heuristic (~4 characters per token) when provider usage is absent.
 * Accepts either character length number or raw text string.
 */
export function estimateTokensFromChars(textOrCharCount: string | number): number {
  const count = typeof textOrCharCount === "string" ? textOrCharCount.length : textOrCharCount;
  if (!count || count <= 0 || isNaN(count)) return 0;
  return Math.ceil(count / 4);
}

/**
 * Normalizes raw or partial token usage from any model provider into consistent NormalizedUsageMetadata.
 * Handles missing prompt/completion tokens gracefully via character estimation fallback.
 */
export function normalizeTokenUsage(
  rawUsage: Partial<NormalizedUsageMetadata> | undefined | null,
  modelIdOrProvider = "standard",
  modelIdOrPrompt?: string,
  fallbackPromptText?: string,
  fallbackCompletionText?: string
): NormalizedUsageMetadata {
  let modelId = modelIdOrProvider;
  let promptFallback = fallbackPromptText;
  let completionFallback = fallbackCompletionText;

  // Disambiguate if called as normalizeTokenUsage(raw, providerId, modelId, fallbackPrompt, fallbackCompletion)
  if (modelIdOrPrompt && !modelIdOrPrompt.includes(" ") && modelIdOrPrompt.length < 50) {
    modelId = modelIdOrPrompt;
  } else if (modelIdOrPrompt) {
    promptFallback = modelIdOrPrompt;
  }

  let promptTokens = rawUsage?.promptTokens;
  let completionTokens = rawUsage?.completionTokens;
  let cachedTokens = rawUsage?.cachedTokens ?? 0;

  // Fallback estimation if tokens are missing from provider response
  if (promptTokens === undefined || promptTokens === null) {
    promptTokens = promptFallback ? estimateTokensFromChars(promptFallback) : 0;
  }
  if (completionTokens === undefined || completionTokens === null) {
    completionTokens = completionFallback ? estimateTokensFromChars(completionFallback) : 0;
  }

  const totalTokens = rawUsage?.totalTokens ?? promptTokens + completionTokens;

  // Calculate estimated USD spend using canonical rates
  let estimatedCostUsd = rawUsage?.estimatedCostUsd;
  if (estimatedCostUsd === undefined || estimatedCostUsd === null) {
    const costCalc = calculateEstimatedCostUsd(modelId, promptTokens, completionTokens);
    estimatedCostUsd = costCalc.estimatedCostUsd;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    isEstimate: true,
  };
}
