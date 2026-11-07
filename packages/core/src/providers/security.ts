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
