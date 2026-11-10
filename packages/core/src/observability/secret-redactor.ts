/**
 * @terrarium/core - observability/secret-redactor.ts
 *
 * Robust secret, API key, token, and credential redactor for telemetry and logs.
 * Guarantees sensitive data is scrubbed before writing to logs, events, or terminal outputs.
 * Aligns strictly with PLAN.md Section 18 and PLAN_CONTEXT.md Section 8.
 */

// Sensitive dictionary keys to redact unconditionally
const SENSITIVE_KEY_NAMES = new Set([
  "password",
  "passwd",
  "secret",
  "secretheader",
  "apikey",
  "api_key",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "authorization",
  "auth",
  "privatekey",
  "private_key",
  "cookie",
  "credentials",
]);

/**
 * Scans a string and redacts all recognized sensitive credentials.
 * Creates stateless regexes to avoid RegExp.lastIndex concurrency issues.
 */
export function redactString(input: string): string {
  if (!input || typeof input !== "string") return input;

  let redacted = input;

  // 1. Private Keys (RSA, EC, OpenSSH)
  redacted = redacted.replace(
    /-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----[\s\S]*?-----END[ A-Z0-9_-]+PRIVATE KEY-----/g,
    "[REDACTED:PRIVATE_KEY]"
  );

  // 2. Bearer tokens in headers or logs
  redacted = redacted.replace(
    /(bearer\s+)[a-zA-Z0-9_\-\.]{12,}/gi,
    "$1[REDACTED:BEARER_TOKEN]"
  );

  // 3. Known Provider API Keys (Anthropic before OpenAI so sk-ant is caught first)
  redacted = redacted.replace(/sk-ant-[a-zA-Z0-9\-_]{16,}/g, "[REDACTED:ANTHROPIC_KEY]");
  redacted = redacted.replace(/sk-[a-zA-Z0-9\-_]{16,}/g, "[REDACTED:OPENAI_KEY]");
  redacted = redacted.replace(/AIza[0-9A-Za-z\-_]{30,}/g, "[REDACTED:GEMINI_KEY]");
  redacted = redacted.replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED:AWS_KEY]");
  redacted = redacted.replace(/gh[pousr]_[0-9a-zA-Z]{30,}/g, "[REDACTED:GITHUB_TOKEN]");

  // 4. Key-value credential assignments in query strings or config strings
  redacted = redacted.replace(
    /(password|passwd|secret|token|api[_-]?key)\s*([:=])\s*['"]?[^\s'",;&]{4,}['"]?/gi,
    "$1$2[REDACTED]"
  );

  return redacted;
}

/**
 * Recursively scrubs objects, arrays, and primitive fields for telemetry safety.
 */
export function redactObject<T>(input: T, seen = new WeakSet()): T {
  if (input === null || input === undefined) return input;

  if (typeof input === "string") {
    return redactString(input) as unknown as T;
  }

  if (typeof input !== "object") {
    return input;
  }

  // Handle circular references safely
  if (seen.has(input as object)) {
    return "[CIRCULAR]" as unknown as T;
  }
  seen.add(input as object);

  if (Array.isArray(input)) {
    return input.map((item) => redactObject(item, seen)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z]/g, "");

    if (SENSITIVE_KEY_NAMES.has(lowerKey)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      result[key] = redactString(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactObject(value, seen);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
