/**
 * @terrarium/core - tests/provider-security-retries.test.ts
 *
 * Tests for provider security guards, credential redaction, audit logging,
 * and retry backoff mechanics.
 * Aligns with PLAN_CONTEXT.md Section 7, Section 8, and Prompt 9 requirements (A3).
 */

import { describe, expect, it } from "bun:test";
import {
  ProviderAuthenticationError,
  ProviderInvalidRequestError,
  ProviderRateLimitError,
  ProviderServerError,
  ok,
  fail,
} from "@terrarium/contracts";
import {
  assertExternalCallAuthorized,
  executeWithRetry,
  sanitizeHeaders,
  sanitizeRequestForAudit,
} from "../src/providers/index.ts";

describe("Provider Security & Credential Protection", () => {
  it("allows local endpoint calls (e.g. Ollama localhost) without credentials or external authorization", () => {
    const res = assertExternalCallAuthorized("ollama", undefined, false, "http://localhost:11434");
    expect(res.success).toBe(true);

    const ipRes = assertExternalCallAuthorized("custom", undefined, false, "http://127.0.0.1:8080/v1");
    expect(ipRes.success).toBe(true);
  });

  it("blocks remote provider calls when API key is missing or placeholder", () => {
    const noKeyRes = assertExternalCallAuthorized("openai", undefined, true, "https://api.openai.com/v1");
    expect(noKeyRes.success).toBe(false);
    if (!noKeyRes.success) {
      expect(noKeyRes.error.name).toBe("ProviderUnauthorizedCallError");
      expect(noKeyRes.error.reason).toContain("No valid API key");
    }

    const dummyKeyRes = assertExternalCallAuthorized("openai", "mock-dummy-key", true, "https://api.openai.com/v1");
    expect(dummyKeyRes.success).toBe(false);
  });

  it("blocks remote provider calls when allowExternalCalls is false even if key is present", () => {
    const blockedRes = assertExternalCallAuthorized(
      "openai",
      "sk-proj-actual-key-12345",
      false,
      "https://api.openai.com/v1"
    );
    expect(blockedRes.success).toBe(false);
    if (!blockedRes.success) {
      expect(blockedRes.error.reason).toContain("External/paid calls are disabled");
    }
  });

  it("allows remote calls only when valid key and explicit authorization are both present", () => {
    const allowedRes = assertExternalCallAuthorized(
      "openai",
      "sk-proj-valid-configured-key",
      true,
      "https://api.openai.com/v1"
    );
    expect(allowedRes.success).toBe(true);
  });

  it("sanitizes authorization and secret headers for logging", () => {
    const rawHeaders = {
      "Content-Type": "application/json",
      Authorization: "Bearer sk-proj-super-secret-key-9999",
      "x-api-key": "secret-provider-token",
      "User-Agent": "Terrarium/0.1.0",
    };

    const sanitized = sanitizeHeaders(rawHeaders);
    expect(sanitized["Content-Type"]).toBe("application/json");
    expect(sanitized["User-Agent"]).toBe("Terrarium/0.1.0");
    expect(sanitized["Authorization"]).toBe("Bearer [REDACTED]");
    expect(sanitized["x-api-key"]).toBe("[REDACTED]");
  });

  it("generates redacted audit summary without sensitive prompt text", () => {
    const summary = sanitizeRequestForAudit("gpt-4o", 3, {
      temperature: 0.2,
      maxTokens: 1000,
      stream: true,
    });

    expect(summary.model).toBe("gpt-4o");
    expect(summary.messageCount).toBe(3);
    expect(summary.temperature).toBe(0.2);
    expect(summary.stream).toBe(true);
    expect(summary.timestamp).toBeDefined();
    // Verify no prompt text is included
    expect((summary as any).prompt).toBeUndefined();
    expect((summary as any).messages).toBeUndefined();
  });
});

describe("Resilient Retry Handler (Exponential Backoff & Rate Limits)", () => {
  it("succeeds on first attempt when operation is healthy", async () => {
    let attempts = 0;
    const res = await executeWithRetry(async (attempt) => {
      attempts++;
      return ok("success-value");
    });

    expect(res.success).toBe(true);
    expect(attempts).toBe(1);
    if (res.success) {
      expect(res.data).toBe("success-value");
    }
  });

  it("retries transient server errors and succeeds once recovered", async () => {
    let attempts = 0;
    const res = await executeWithRetry(
      async (attempt) => {
        attempts++;
        if (attempt < 2) {
          return fail(new ProviderServerError("Overloaded", "openai", 503));
        }
        return ok("recovered-data");
      },
      { baseDelayMs: 10, maxRetries: 3 }
    );

    expect(res.success).toBe(true);
    expect(attempts).toBe(3); // attempt 0, 1, 2
    if (res.success) {
      expect(res.data).toBe("recovered-data");
    }
  });

  it("does not retry non-retryable errors like authentication or validation errors", async () => {
    let attempts = 0;
    const res = await executeWithRetry(
      async () => {
        attempts++;
        return fail(new ProviderAuthenticationError("Bad Key", "openai"));
      },
      { baseDelayMs: 10, maxRetries: 3 }
    );

    expect(res.success).toBe(false);
    expect(attempts).toBe(1); // Fails immediately without burning retries
    if (!res.success) {
      expect(res.error.name).toBe("ProviderAuthenticationError");
    }
  });

  it("respects retryAfterMs on ProviderRateLimitError", async () => {
    let attempts = 0;
    const startTime = Date.now();
    const res = await executeWithRetry(
      async (attempt) => {
        attempts++;
        if (attempt === 0) {
          return fail(new ProviderRateLimitError("Rate limit", "openai", 50));
        }
        return ok("rate-limit-cleared");
      },
      { baseDelayMs: 10, maxRetries: 2 }
    );

    const elapsed = Date.now() - startTime;
    expect(res.success).toBe(true);
    expect(attempts).toBe(2);
    expect(elapsed).toBeGreaterThanOrEqual(40); // Respected ~50ms retryAfterMs
  });

  it("aborts retry sleep immediately when signal is cancelled", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 25);

    const res = await executeWithRetry(
      async () => {
        return fail(new ProviderServerError("Server 500", "openai", 500));
      },
      { baseDelayMs: 200, maxRetries: 3, signal: controller.signal }
    );

    expect(res.success).toBe(false);
  });
});
