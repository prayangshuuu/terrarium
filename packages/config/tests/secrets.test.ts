import { describe, expect, it } from "bun:test";
import {
  isSensitiveKey,
  maskSecret,
  redactSecretsInString,
  sanitizeObjectForLogging,
} from "../src/index.ts";

describe("Secret Masking, Redaction, and Diagnostic Sanitization", () => {
  describe("isSensitiveKey", () => {
    it("detects sensitive field names regardless of case", () => {
      expect(isSensitiveKey("apiKey")).toBe(true);
      expect(isSensitiveKey("API_KEY")).toBe(true);
      expect(isSensitiveKey("clientSecret")).toBe(true);
      expect(isSensitiveKey("accessToken")).toBe(true);
      expect(isSensitiveKey("user_password")).toBe(true);
      expect(isSensitiveKey("credentials")).toBe(true);
      expect(isSensitiveKey("authorizationHeader")).toBe(true);
      expect(isSensitiveKey("bearerToken")).toBe(true);
      expect(isSensitiveKey("privateKeyPath")).toBe(true);
    });

    it("does not flag non-sensitive configuration keys", () => {
      expect(isSensitiveKey("appName")).toBe(false);
      expect(isSensitiveKey("environment")).toBe(false);
      expect(isSensitiveKey("debug")).toBe(false);
      expect(isSensitiveKey("projectRoot")).toBe(false);
      expect(isSensitiveKey("dataDir")).toBe(false);
      expect(isSensitiveKey("defaultProvider")).toBe(false);
      expect(isSensitiveKey("maxTokensPerTurn")).toBe(false);
    });
  });

  describe("maskSecret", () => {
    it("masks long secrets with safe prefix and suffix", () => {
      const anthropicKey = "sk-ant-api03-abcdef1234567890xyz";
      const masked = maskSecret(anthropicKey);
      expect(masked.startsWith("sk-ant")).toBe(true);
      expect(masked.endsWith("0xyz")).toBe(true);
      expect(masked).toContain("...");
      expect(masked).not.toBe(anthropicKey);
    });

    it("redacts short secrets completely to prevent character guessing", () => {
      expect(maskSecret("short")).toBe("[REDACTED]");
      expect(maskSecret("12345678")).toBe("[REDACTED]");
    });

    it("returns [NOT_SET] for empty or undefined secrets", () => {
      expect(maskSecret(undefined)).toBe("[NOT_SET]");
      expect(maskSecret("")).toBe("[NOT_SET]");
    });
  });

  describe("redactSecretsInString", () => {
    it("redacts OpenAI keys found in raw log strings", () => {
      const raw = "Error calling OpenAI API with key sk-proj-abcdef1234567890abcdef1234567890";
      const redacted = redactSecretsInString(raw);
      expect(redacted).not.toContain("sk-proj-abcdef1234567890abcdef1234567890");
      expect(redacted).toContain("sk-p...890");
    });

    it("redacts Anthropic Claude keys found in raw log strings", () => {
      const raw = "Anthropic request failed, using sk-ant-api03-abcdef1234567890xyz1234567890";
      const redacted = redactSecretsInString(raw);
      expect(redacted).not.toContain("sk-ant-api03-abcdef1234567890xyz1234567890");
      expect(redacted).toContain("sk-a...890");
    });

    it("redacts Google AI / Gemini keys found in raw log strings", () => {
      const raw = "Gemini endpoint query failed: key=AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q";
      const redacted = redactSecretsInString(raw);
      expect(redacted).not.toContain("AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q");
    });

    it("redacts Bearer tokens from authorization headers", () => {
      const raw = "Headers: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature";
      const redacted = redactSecretsInString(raw);
      expect(redacted).toContain("Bearer [REDACTED]");
      expect(redacted).not.toContain("doNotLeakThisSignature");
    });
  });

  describe("sanitizeObjectForLogging", () => {
    it("recursively redacts sensitive keys and scrubs token values in objects", () => {
      const sensitivePayload = {
        appName: "TERRARIUM",
        environment: "production",
        apiKey: "sk-ant-api03-superSecretKey1234567890",
        nested: {
          clientSecret: "verySecretPassword123",
          rawLog: "Connecting with sk-proj-openAiSecretToken1234567890",
          safeValue: 42,
        },
        tokens: ["ghp_123456789012345678901234567890123456", "safe_token_string"],
      };

      const sanitized = sanitizeObjectForLogging(sensitivePayload);

      expect(sanitized.appName).toBe("TERRARIUM");
      expect(sanitized.apiKey).not.toBe("sk-ant-api03-superSecretKey1234567890");
      expect(sanitized.apiKey).toContain("...");
      expect(sanitized.nested.clientSecret).toBe("[REDACTED]");
      expect(sanitized.nested.rawLog).not.toContain("sk-proj-openAiSecretToken1234567890");
      expect(sanitized.nested.safeValue).toBe(42);
      expect(sanitized.tokens[0]).not.toContain("ghp_123456789012345678901234567890123456");
    });
  });
});
