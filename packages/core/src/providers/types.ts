/**
 * @terrarium/core - providers/types.ts
 *
 * Internal provider types, cost tables, model capabilities catalog,
 * and adapter configuration options.
 * Aligns with PLAN.md Section 12 (Model and Provider Ecosystem).
 */

import {
  type ModelCapabilities,
  type ModelInfo,
  type ModelTier,
  type ProviderType,
} from "@terrarium/contracts";

export interface ProviderAdapterConfig {
  readonly provider: ProviderType;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly organizationId?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly allowExternalCalls?: boolean;
}

/**
 * Standard known pricing per 1M tokens (USD).
 * Used for cost estimation when the upstream API does not provide explicit spend.
 */
export interface ModelPricing {
  readonly inputPer1M: number;
  readonly outputPer1M: number;
}

export const KNOWN_OPENAI_PRICING: Readonly<Record<string, ModelPricing>> = {
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-2024-08-06": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o-mini-2024-07-18": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "o1": { inputPer1M: 15.0, outputPer1M: 60.0 },
  "o1-mini": { inputPer1M: 3.0, outputPer1M: 12.0 },
  "o1-preview": { inputPer1M: 15.0, outputPer1M: 60.0 },
  "gpt-4-turbo": { inputPer1M: 10.0, outputPer1M: 30.0 },
  "gpt-3.5-turbo": { inputPer1M: 0.5, outputPer1M: 1.5 },
};

export const DEFAULT_OPENAI_MODELS: readonly ModelInfo[] = [
  {
    id: "gpt-4o",
    displayName: "GPT-4o (Flagship Omnimodal)",
    tier: "advanced",
    contextWindow: 128000,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.0000025,
    costPerOutputToken: 0.00001,
  },
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o Mini (Fast & Economical)",
    tier: "standard",
    contextWindow: 128000,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.00000015,
    costPerOutputToken: 0.0000006,
  },
  {
    id: "o1-mini",
    displayName: "o1-mini (Specialized Reasoning)",
    tier: "advanced",
    contextWindow: 128000,
    supportsTools: false,
    supportsStreaming: true,
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000012,
  },
  {
    id: "gpt-3.5-turbo",
    displayName: "GPT-3.5 Turbo (Legacy Economy)",
    tier: "fast",
    contextWindow: 16385,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.0000005,
    costPerOutputToken: 0.0000015,
  },
];

/**
 * Calculates estimated USD cost from token counts and model identifier.
 */
export function calculateEstimatedCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = KNOWN_OPENAI_PRICING[model] ?? { inputPer1M: 1.0, outputPer1M: 3.0 };
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
