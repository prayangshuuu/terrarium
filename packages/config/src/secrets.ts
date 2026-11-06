/**
 * @terrarium/config - secrets.ts
 *
 * Secret detection, masking, and redaction utilities for logs, traces, and diagnostics.
 * Prevents credentials and tokens from leaking into logs, terminal output, or reports.
 * Aligns strictly with PLAN_CONTEXT.md Section 7 & 8 and PLAN.md Section 17.
 */

export const SENSITIVE_KEY_PATTERNS = [
  /key/i,
  /secret/i,
  /token/i,
  /password/i,
  /credential/i,
  /auth/i,
  /bearer/i,
  /private/i,
  /cert/i,
  /passwd/i,
] as const;

/**
 * Known token count and budget metric names that are NOT sensitive credentials.
 */
const TOKEN_METRIC_PATTERNS = [
  /(?:max|count|used|limit|total|prompt|completion|budget)[_-]?tokens?/i,
  /tokens?[_-]?(?:count|limit|used|budget|usage|per)/i,
];

/**
 * Checks whether an environment or configuration key represents sensitive data.
 * Distinguishes AI language model token metrics (e.g. maxTokensPerTurn) from auth tokens.
 */
export function isSensitiveKey(key: string): boolean {
  if (TOKEN_METRIC_PATTERNS.some((pattern) => pattern.test(key))) {
    return false;
  }
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Regular expressions matching known external provider API key formats and tokens.
 * Bearer headers are processed first.
 */
export const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  // Bearer token headers (evaluated first to capture the full token)
  /\bBearer\s+[A-Za-z0-9_.\-~+/=]{10,}\b/gi,
  // OpenAI API keys (standard and project-scoped)
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  // Anthropic Claude API keys
  /\bsk-ant-(?:api\d\d-)?[A-Za-z0-9_-]{20,}\b/g,
  // Google Gemini / Cloud API keys
  /\bAIzaSy[A-Za-z0-9_-]{33}\b/g,
  // GitHub personal access tokens and OAuth tokens
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/g,
  // JWT tokens (three base64 segments)
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
];

/**
 * Masks a secret string showing a minimal safe prefix and suffix.
 * For example: "sk-ant-api03-abcdef1234567890" -> "sk-ant-...7890".
 * Short secrets (<= 8 chars) are completely masked as "[REDACTED]".
 */
export function maskSecret(secret?: string, visiblePrefix = 6, visibleSuffix = 4): string {
  if (!secret) return "[NOT_SET]";
  if (secret.length <= visiblePrefix + visibleSuffix + 2) {
    return "[REDACTED]";
  }
  const prefix = secret.slice(0, visiblePrefix);
  const suffix = secret.slice(-visibleSuffix);
  return `${prefix}...${suffix}`;
}

/**
 * Scans a raw string and redacts any detected secret patterns with a safe placeholder.
 */
export function redactSecretsInString(text: string): string {
  if (!text || typeof text !== "string") return text;

  let redacted = text;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      if (match.toLowerCase().startsWith("bearer ")) {
        return "Bearer [REDACTED]";
      }
      return maskSecret(match, 4, 3);
    });
  }

  return redacted;
}

/**
 * Recursively clones an object or array, redacting values of sensitive keys
 * and scrubbing known secret formats from all string values.
 * Safe for JSON serialization, logging, and diagnostics.
 */
export function sanitizeObjectForLogging<T>(input: T, maxDepth = 10): T {
  function sanitizeValue(value: unknown, depth: number): unknown {
    if (depth > maxDepth) return "[MAX_DEPTH_REACHED]";
    if (value === null || value === undefined) return value;

    if (typeof value === "string") {
      return redactSecretsInString(value);
    }

    if (typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item, depth + 1));
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        if (typeof val === "string") {
          // Passwords, client secrets, and credentials should always be fully redacted
          if (/password|passwd|secret/i.test(key)) {
            result[key] = "[REDACTED]";
          } else {
            result[key] = maskSecret(val);
          }
        } else if (val === null || val === undefined) {
          result[key] = val;
        } else {
          result[key] = "[REDACTED]";
        }
      } else {
        result[key] = sanitizeValue(val, depth + 1);
      }
    }
    return result;
  }

  return sanitizeValue(input, 0) as T;
}
