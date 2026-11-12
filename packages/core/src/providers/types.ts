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

export type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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

export const KNOWN_ANTHROPIC_PRICING: Readonly<Record<string, ModelPricing>> = {
  "claude-3-5-sonnet-20241022": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-3-5-sonnet-latest": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-3-5-haiku-20241022": { inputPer1M: 0.8, outputPer1M: 4.0 },
  "claude-3-5-haiku-latest": { inputPer1M: 0.8, outputPer1M: 4.0 },
  "claude-3-opus-20240229": { inputPer1M: 15.0, outputPer1M: 75.0 },
  "claude-3-opus-latest": { inputPer1M: 15.0, outputPer1M: 75.0 },
};

export const KNOWN_GEMINI_PRICING: Readonly<Record<string, ModelPricing>> = {
  "gemini-1.5-pro": { inputPer1M: 1.25, outputPer1M: 5.0 },
  "gemini-1.5-pro-latest": { inputPer1M: 1.25, outputPer1M: 5.0 },
  "gemini-1.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "gemini-1.5-flash-latest": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "gemini-2.0-flash": { inputPer1M: 0.1, outputPer1M: 0.4 },
};

export const KNOWN_OLLAMA_PRICING: Readonly<Record<string, ModelPricing>> = {
  "llama3.2": { inputPer1M: 0.0, outputPer1M: 0.0 },
  "llama3.2:latest": { inputPer1M: 0.0, outputPer1M: 0.0 },
  "qwen2.5-coder": { inputPer1M: 0.0, outputPer1M: 0.0 },
  "deepseek-r1": { inputPer1M: 0.0, outputPer1M: 0.0 },
  "codellama": { inputPer1M: 0.0, outputPer1M: 0.0 },
};

export const DEFAULT_ANTHROPIC_MODELS: readonly ModelInfo[] = [
  {
    id: "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet (State of the Art Intelligence)",
    tier: "advanced",
    contextWindow: 200000,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000015,
  },
  {
    id: "claude-3-5-haiku-20241022",
    displayName: "Claude 3.5 Haiku (Lightning Fast & Economical)",
    tier: "standard",
    contextWindow: 200000,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.0000008,
    costPerOutputToken: 0.000004,
  },
  {
    id: "claude-3-opus-20240229",
    displayName: "Claude 3 Opus (Deep Reasoning & Analysis)",
    tier: "advanced",
    contextWindow: 200000,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.000015,
    costPerOutputToken: 0.000075,
  },
];

export const DEFAULT_OLLAMA_MODELS: readonly ModelInfo[] = [
  {
    id: "llama3.2",
    displayName: "Llama 3.2 (Local 3B/1B Lightweight)",
    tier: "standard",
    contextWindow: 128000,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.0,
    costPerOutputToken: 0.0,
  },
  {
    id: "qwen2.5-coder",
    displayName: "Qwen 2.5 Coder (Local Code Specialist)",
    tier: "advanced",
    contextWindow: 32768,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.0,
    costPerOutputToken: 0.0,
  },
  {
    id: "deepseek-r1",
    displayName: "DeepSeek R1 (Local Distilled Reasoning)",
    tier: "advanced",
    contextWindow: 65536,
    supportsTools: false,
    supportsStreaming: true,
    costPerInputToken: 0.0,
    costPerOutputToken: 0.0,
  },
  {
    id: "codellama",
    displayName: "CodeLlama (Local Code Synthesis)",
    tier: "standard",
    contextWindow: 16384,
    supportsTools: false,
    supportsStreaming: true,
    costPerInputToken: 0.0,
    costPerOutputToken: 0.0,
  },
];

export const DEFAULT_GEMINI_MODELS: readonly ModelInfo[] = [
  {
    id: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro (2M Long-Context Reasoning)",
    tier: "advanced",
    contextWindow: 2000000,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.00000125,
    costPerOutputToken: 0.000005,
  },
  {
    id: "gemini-1.5-flash",
    displayName: "Gemini 1.5 Flash (High-Throughput Omnimodal)",
    tier: "standard",
    contextWindow: 1000000,
    supportsTools: true,
    supportsStreaming: true,
    costPerInputToken: 0.000000075,
    costPerOutputToken: 0.0000003,
  },
];

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
  const pricing =
    KNOWN_ANTHROPIC_PRICING[model] ??
    KNOWN_OPENAI_PRICING[model] ??
    KNOWN_GEMINI_PRICING[model] ??
    KNOWN_OLLAMA_PRICING[model] ??
    { inputPer1M: 1.0, outputPer1M: 3.0 };
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
