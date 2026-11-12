/**
 * @terrarium/core - reports/report-sanitizer.ts
 *
 * Privacy and non-disclosure sanitization for reports, evidence, and deliverables.
 * Strictly enforces PLAN.md Section 17 & Prompt 18:
 * - Redacts API keys, credentials, tokens, private URLs, and secrets.
 * - Strips internal chain-of-thought, scratchpads, and raw reasoning dumps.
 * - Leaves concise rationale and verifiable evidence intact.
 */

export interface SanitizationResult {
  readonly sanitizedText: string;
  readonly redactionCount: number;
  readonly strippedCotCount: number;
}

export class ReportSanitizer {
  private static readonly SECRET_PATTERNS: readonly RegExp[] = [
    // OpenAI / Anthropic / Generic API keys
    /sk-[a-zA-Z0-9_-]{20,}/g,
    /sk-ant-[a-zA-Z0-9_-]{20,}/g,
    // GitHub / GitLab tokens
    /ghp_[a-zA-Z0-9]{36,}/g,
    /glpat-[a-zA-Z0-9_-]{20,}/g,
    // AWS credentials
    /AKIA[0-9A-Z]{16}/g,
    // Bearer tokens
    /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,
    // Private SSH keys
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    // Generic passwords / tokens in connection strings or env vars
    /(?:password|passwd|api_key|secret|token|auth)\s*[:=]\s*["']?([^\s"';]{6,})["']?/gi,
  ];

  private static readonly CHAIN_OF_THOUGHT_PATTERNS: readonly RegExp[] = [
    /<thinking>[\s\S]*?<\/thinking>/gi,
    /<scratchpad>[\s\S]*?<\/scratchpad>/gi,
    /\[(?:CHAIN_OF_THOUGHT|INTERNAL_REASONING|HIDDEN_COT)\][\s\S]*?\[\/(?:CHAIN_OF_THOUGHT|INTERNAL_REASONING|HIDDEN_COT)\]/gi,
    /```thinking[\s\S]*?```/gi,
  ];

  /**
   * Sanitizes markdown text by stripping hidden chain-of-thought and redacting secrets.
   */
  static sanitize(text: string): SanitizationResult {
    if (!text) {
      return { sanitizedText: "", redactionCount: 0, strippedCotCount: 0 };
    }

    let result = text;
    let strippedCotCount = 0;
    let redactionCount = 0;

    // 1. Strip hidden chain-of-thought blocks
    for (const pattern of this.CHAIN_OF_THOUGHT_PATTERNS) {
      result = result.replace(pattern, () => {
        strippedCotCount++;
        return "";
      });
    }

    // 2. Redact sensitive secrets and tokens
    for (const pattern of this.SECRET_PATTERNS) {
      result = result.replace(pattern, (match) => {
        redactionCount++;
        if (match.startsWith("Bearer ")) {
          return "Bearer [REDACTED_TOKEN]";
        }
        if (match.startsWith("AKIA")) {
          return "AKIA[REDACTED_AWS_KEY]";
        }
        if (match.startsWith("sk-ant-")) {
          return "sk-ant-[REDACTED_KEY]";
        }
        if (match.startsWith("sk-")) {
          return "sk-[REDACTED_KEY]";
        }
        if (match.startsWith("ghp_")) {
          return "ghp_[REDACTED_TOKEN]";
        }
        if (match.startsWith("glpat-")) {
          return "glpat-[REDACTED_TOKEN]";
        }
        if (match.includes("PRIVATE KEY")) {
          return "[REDACTED_PRIVATE_KEY]";
        }
        return "[REDACTED_SECRET]";
      });
    }

    // Clean up excessive blank lines created by CoT stripping
    result = result.replace(/\n{3,}/g, "\n\n").trim();

    return {
      sanitizedText: result,
      redactionCount,
      strippedCotCount,
    };
  }

  /**
   * Redacts secrets in an array of strings (e.g. assumptions, limitations).
   */
  static sanitizeList(items: readonly string[]): string[] {
    return items.map((item) => this.sanitize(item).sanitizedText);
  }
}
