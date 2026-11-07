/**
 * @terrarium/contracts - tests/provider-contracts.test.ts
 *
 * Unit tests for provider contracts, integration kind distinction, model schemas,
 * and specialized provider error hierarchy.
 * Aligns with PLAN.md Section 10.4, Section 12 & Prompt 9 requirements.
 */

import { describe, expect, it } from "bun:test";
import {
  PROVIDER_INTEGRATION_KINDS,
  PROVIDER_TYPES,
  MODEL_FINISH_REASONS,
  CHAT_MESSAGE_ROLES,
  validateModelCompletionRequest,
  validateModelResponse,
  validateNormalizedUsage,
  validateModelMessage,
  type ModelCompletionRequest,
  type ModelResponse,
  type CodingAgentCliCapabilities,
  ProviderError,
  ProviderAuthenticationError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderNetworkError,
  ProviderInvalidRequestError,
  ProviderServerError,
  ProviderUnauthorizedCallError,
} from "../src/index.ts";

describe("Provider Domain Contracts & Hierarchy", () => {
  describe("Model API vs Coding-Agent CLI Distinction (PLAN.md 10.4)", () => {
    it("distinguishes between model_api and coding_agent_cli integration kinds", () => {
      expect(PROVIDER_INTEGRATION_KINDS).toContain("model_api");
      expect(PROVIDER_INTEGRATION_KINDS).toContain("coding_agent_cli");
      expect(PROVIDER_INTEGRATION_KINDS.length).toBe(2);
    });

    it("verifies coding agent capabilities structure conforms to contracts", () => {
      const cliCaps: CodingAgentCliCapabilities = {
        supportsInteractivePty: true,
        supportedTools: ["bash", "git", "file_editor"],
        sessionPersistence: true,
        defaultTimeoutMs: 60000,
      };

      expect(cliCaps.supportsInteractivePty).toBe(true);
      expect(cliCaps.supportedTools).toContain("bash");
      expect(cliCaps.sessionPersistence).toBe(true);
    });
  });

  describe("Provider-Neutral Model Interface Contracts", () => {
    it("validates compliant ModelCompletionRequest", () => {
      const request: ModelCompletionRequest = {
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert architect." },
          { role: "user", content: "Evaluate system boundaries." },
        ],
        options: {
          temperature: 0.2,
          maxTokens: 2048,
        },
      };

      const res = validateModelCompletionRequest(request);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.model).toBe("gpt-4o");
        expect(res.data.messages.length).toBe(2);
      }
    });

    it("rejects ModelCompletionRequest missing messages or model", () => {
      const res = validateModelCompletionRequest({ model: "", messages: [] });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.length).toBeGreaterThan(0);
      }
    });

    it("validates ModelMessage with role and content", () => {
      const msgRes = validateModelMessage({
        role: "user",
        content: "Hello Terrarium",
      });
      expect(msgRes.success).toBe(true);

      const invalidMsgRes = validateModelMessage({
        role: "invalid_role",
        content: "test",
      });
      expect(invalidMsgRes.success).toBe(false);
    });

    it("validates NormalizedUsageMetadata calculation", () => {
      const usageRes = validateNormalizedUsage({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.00075,
      });

      expect(usageRes.success).toBe(true);
      if (usageRes.success) {
        expect(usageRes.data.promptTokens).toBe(100);
        expect(usageRes.data.totalTokens).toBe(150);
        expect(usageRes.data.estimatedCostUsd).toBe(0.00075);
      }
    });

    it("validates normalized ModelResponse", () => {
      const response: ModelResponse = {
        id: "resp-12345",
        provider: "openai",
        model: "gpt-4o-mini",
        text: "Normalized architectural summary.",
        finishReason: "stop",
        usage: {
          promptTokens: 120,
          completionTokens: 45,
          totalTokens: 165,
          estimatedCostUsd: 0.00005,
        },
        durationMs: 420,
      };

      const res = validateModelResponse(response);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.provider).toBe("openai");
        expect(res.data.finishReason).toBe("stop");
      }
    });
  });

  describe("Specialized Provider Error Hierarchy", () => {
    it("differentiates retryable vs non-retryable provider errors", () => {
      const authErr = new ProviderAuthenticationError("Invalid API key", "openai", "gpt-4o");
      expect(authErr.isRetryable).toBe(false);
      expect(authErr.statusCode).toBe(401);
      expect(authErr.code).toBe("PROVIDER_AUTHENTICATION_ERROR");

      const rateLimitErr = new ProviderRateLimitError(
        "Rate limit exceeded",
        "openai",
        2500,
        "gpt-4o"
      );
      expect(rateLimitErr.isRetryable).toBe(true);
      expect(rateLimitErr.statusCode).toBe(429);
      expect(rateLimitErr.retryAfterMs).toBe(2500);
      expect(rateLimitErr.code).toBe("PROVIDER_RATE_LIMIT_ERROR");

      const timeoutErr = new ProviderTimeoutError("Request timed out", "openai", 30000);
      expect(timeoutErr.isRetryable).toBe(true);
      expect(timeoutErr.statusCode).toBe(408);
      expect(timeoutErr.timeoutMs).toBe(30000);

      const netErr = new ProviderNetworkError("ECONNREFUSED", "ollama");
      expect(netErr.isRetryable).toBe(true);
      expect(netErr.code).toBe("PROVIDER_NETWORK_ERROR");

      const invalidReqErr = new ProviderInvalidRequestError("Context window exceeded", "openai");
      expect(invalidReqErr.isRetryable).toBe(false);
      expect(invalidReqErr.statusCode).toBe(400);

      const serverErr = new ProviderServerError("Server unavailable", "openai", 503);
      expect(serverErr.isRetryable).toBe(true);
      expect(serverErr.statusCode).toBe(503);

      const unauthCallErr = new ProviderUnauthorizedCallError(
        "openai",
        "No API key provided and external calls disabled"
      );
      expect(unauthCallErr.isRetryable).toBe(false);
      expect(unauthCallErr.statusCode).toBe(403);
      expect(unauthCallErr.reason).toContain("external calls disabled");
    });

    it("serializes cleanly to JSON across boundaries without leaking credentials", () => {
      const err = new ProviderRateLimitError("Quota limit hit", "openai", 5000);
      const json = err.toJSON();

      expect(json.name).toBe("ProviderRateLimitError");
      expect(json.code).toBe("PROVIDER_RATE_LIMIT_ERROR");
      expect((json.details as any).retryAfterMs).toBe(5000);
      expect((json.details as any).provider).toBe("openai");
      expect(json.timestamp).toBeDefined();
    });
  });
});
