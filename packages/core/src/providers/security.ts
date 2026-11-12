/**
 * @terrarium/core - providers/security.ts
 *
 * Security guards, credential redaction, prompt protection, and external call authorization.
 * Aligns with PLAN_CONTEXT.md Section 7, Section 8, and Prompt 9 requirements.
 * Ensures credentials and sensitive prompts are NEVER logged or sent externally without authorization.
 */

import {
  type ProviderType,
  type Result,
  ok,
  fail,
  ProviderUnauthorizedCallError,
} from "@terrarium/contracts";

/**
 * Checks whether an external/paid network call is permitted.
 * If the provider is a remote service (e.g. OpenAI cloud) and external calls are disabled
 * or credentials are missing/dummy, halts immediately before network I/O.
 */
export function assertExternalCallAuthorized(
  provider: ProviderType,
  apiKey?: string,
  allowExternalCalls = false,
  baseUrl?: string
): Result<void, ProviderUnauthorizedCallError> {
  const isLocalEndpoint =
    baseUrl?.includes("localhost") ||
    baseUrl?.includes("127.0.0.1") ||
    baseUrl?.includes("0.0.0.0");

  // Local endpoints (e.g. local Ollama / vLLM) do not incur paid API charges or leak data externally
  if (isLocalEndpoint) {
    return ok(undefined);
  }

  // Remote cloud provider requires both configured credentials and authorization
  if (!apiKey || apiKey.trim() === "" || apiKey.includes("mock") || apiKey.includes("dummy")) {
    return fail(
      new ProviderUnauthorizedCallError(
        provider,
        "No valid API key configured. Provide a valid credential to authorize external provider calls."
      )
    );
  }

  if (!allowExternalCalls) {
    return fail(
      new ProviderUnauthorizedCallError(
        provider,
        "External/paid calls are disabled in current environment settings. Set allowExternalCalls=true to proceed."
      )
    );
  }

  return ok(undefined);
}

/**
 * Strips or redacts sensitive authentication headers from headers objects before logging.
 */
export function sanitizeHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("authorization") ||
      lowerKey.includes("key") ||
      lowerKey.includes("token") ||
      lowerKey.includes("secret")
    ) {
      if (value.startsWith("Bearer ")) {
        sanitized[key] = "Bearer [REDACTED]";
      } else {
        sanitized[key] = "[REDACTED]";
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Creates a redacted, safe summary of a model request for auditing/diagnostics without leaking
 * sensitive user prompts, secret keys, or raw system prompts.
 */
export function sanitizeRequestForAudit(
  model: string,
  messageCount: number,
  options?: Record<string, unknown>
): Record<string, unknown> {
  return {
    model,
    messageCount,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    stream: options?.stream ?? false,
    timestamp: new Date().toISOString(),
  };
}

export interface RateLimitInfo {
  readonly requestsRemaining?: number;
  readonly requestsLimit?: number;
  readonly tokensRemaining?: number;
  readonly tokensLimit?: number;
  readonly retryAfterSeconds?: number;
  readonly resetTime?: string;
}

/**
 * Extracts normalized rate limit information from provider HTTP response headers.
 * Supports OpenAI, Anthropic, and generic standard rate limit header conventions.
 */
export function parseRateLimitHeaders(
  headers: Headers | Record<string, string>
): RateLimitInfo {
  const getHeader = (name: string): string | undefined => {
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name) ?? undefined;
    }
    const rec = headers as Record<string, string>;
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(rec)) {
      if (k.toLowerCase() === lower) return v;
    }
    return undefined;
  };

  const parseNum = (val: string | undefined): number | undefined => {
    if (!val) return undefined;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? undefined : parsed;
  };

  // Anthropic rate limit headers
  const anthropicReqRem = parseNum(getHeader("anthropic-ratelimit-requests-remaining"));
  const anthropicReqLim = parseNum(getHeader("anthropic-ratelimit-requests-limit"));
  const anthropicTokRem = parseNum(getHeader("anthropic-ratelimit-tokens-remaining"));
  const anthropicTokLim = parseNum(getHeader("anthropic-ratelimit-tokens-limit"));
  const anthropicReset = getHeader("anthropic-ratelimit-requests-reset");

  // OpenAI rate limit headers
  const openAiReqRem = parseNum(getHeader("x-ratelimit-remaining-requests"));
  const openAiReqLim = parseNum(getHeader("x-ratelimit-limit-requests"));
  const openAiTokRem = parseNum(getHeader("x-ratelimit-remaining-tokens"));
  const openAiTokLim = parseNum(getHeader("x-ratelimit-limit-tokens"));
  const openAiReset = getHeader("x-ratelimit-reset-requests");

  // Generic Retry-After
  const retryAfter = parseNum(getHeader("retry-after"));

  return {
    requestsRemaining: anthropicReqRem ?? openAiReqRem,
    requestsLimit: anthropicReqLim ?? openAiReqLim,
    tokensRemaining: anthropicTokRem ?? openAiTokRem,
    tokensLimit: anthropicTokLim ?? openAiTokLim,
    retryAfterSeconds: retryAfter,
    resetTime: anthropicReset ?? openAiReset,
  };
}
