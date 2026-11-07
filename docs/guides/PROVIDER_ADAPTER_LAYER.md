# TERRARIUM — Provider Adapter Layer Architecture

> Architecture, design decisions, security model, and usage guide for the Terrarium Provider Adapter Layer.
> Implemented in **Prompt 9** according to `PLAN.md` Section 10.4, Section 12, Section 13, and `PLAN_CONTEXT.md` Section 7 & 8.

---

## 1. Overview and Core Purpose

TERRARIUM coordinates specialized AI agents across a diverse multi-provider ecosystem. The provider adapter layer decouples internal agent planning and orchestration from concrete external LLM SDKs, HTTP protocols, rate limits, and authentication idiosyncrasies.

Core design principles:
1. **Model API vs. Coding-Agent CLI Distinction:** Model APIs (HTTP/SSE completion calls) are fundamentally distinct from Coding-Agent CLIs (interactive subprocesses executing shell commands, managing Git repositories, and mounting local workspaces).
2. **Provider-Neutral Interface:** All model providers implement a normalized contract (`ModelProviderAdapter`) supporting capability discovery, non-streaming completion, SSE streaming, cancellation via `AbortSignal`, and standardized token/cost metadata.
3. **Strict Security and Credential Isolation:** Raw API keys, Bearer tokens, and sensitive prompt bodies are never stored in durable project memory or printed to logs.
4. **Authorization Guard Rails:** Remote/paid API calls are blocked by default unless explicit authorization (`allowExternalCalls=true`) and valid credentials are both configured. Local endpoints (e.g. local Ollama at `http://localhost:11434`) execute freely without incurring costs or leaking project content externally.
5. **Deterministic Offline Testing:** Full mock adapter (`MockModelAdapter`) and mock fetch test harness enable 100% offline contract verification without network I/O or paid usage.

---

## 2. Architecture & Domain Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│                        @terrarium/core Runtime                         │
│   (Bounded Coordinator / Profile Selector / Task Intake Engine)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         ProviderRegistry
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         │                                                     │
         ▼                                                     ▼
┌──────────────────────────────────┐         ┌─────────────────────────────────┐
│     ModelProviderAdapter         │         │     CodingAgentCliAdapter       │
│    (kind: "model_api")           │         │   (kind: "coding_agent_cli")    │
│  - complete(request, options)    │         │  - runAgentCommand(cmd, opts)   │
│  - stream(request, options)      │         │  - supportsInteractivePty       │
│  - getCapabilities(modelId)      │         │  - supportedTools (bash, git)   │
│  - listModels()                  │         │  - sessionPersistence           │
│  - checkHealth()                 │         │  - defaultTimeoutMs             │
└────────┬─────────────────────────┘         └─────────────────────────────────┘
         │
         ├──► OpenAIProviderAdapter (Cloud OpenAI, OpenRouter, local Ollama /v1)
         │       ├── Security Authorization Guard (blocks unapproved paid calls)
         │       ├── Resilient Retry Handler (exponential backoff + jitter)
         │       ├── SSE Stream Decoder & AbortSignal cancellation
         │       └── Usage Metadata Normalization & Cost Calculation
         │
         └──► MockModelAdapter (100% offline, zero-cost test double)
                 ├── Configurable error modes (transient, permanent, rate limits)
                 ├── Stream chunk generation
                 └── Deterministic token & cost simulation
```

---

## 3. Model API vs. Coding-Agent CLI Distinction

In accordance with `PLAN.md Section 10.4` ("Coding agent integration"), the platform explicitly distinguishes between two integration kinds:

| Feature / Dimension | Model API (`model_api`) | Coding-Agent CLI (`coding_agent_cli`) |
| :--- | :--- | :--- |
| **Communication Mode** | HTTP REST & Server-Sent Events (SSE) | Subprocess execution, stdio, interactive PTY |
| **Granularity** | Single prompt/message turn or token stream | Multi-step agent workflow or command session |
| **Workspace Access** | None (pure text/token generation) | Direct filesystem workspace mount & working dir (`cwd`) |
| **Tool Execution** | Declared JSON schemas returned to orchestrator | Native CLI execution of shell commands, git, editors |
| **Session Model** | Ephemeral or conversation message array | Stateful session token / persistent CLI context |
| **Cost & Latency** | Explicit per-token pricing and token counters | Process runtime duration, CLI exit codes, subprocess CPU |
| **Examples** | OpenAI Chat Completions, Anthropic Messages, Gemini GenerateContent | Claude Code CLI, Codex CLI, Agy CLI, aider |

---

## 4. Provider-Neutral Contracts (`@terrarium/contracts`)

### Normalized Request & Response

```typescript
export interface ModelCompletionRequest {
  readonly model: string;
  readonly messages: readonly ModelMessage[];
  readonly options?: ModelRequestOptions;
}

export interface ModelResponse {
  readonly id: string;
  readonly provider: ProviderType;
  readonly model: string;
  readonly text: string;
  readonly finishReason: ModelFinishReason;
  readonly usage: NormalizedUsageMetadata;
  readonly durationMs: number;
  readonly toolCalls?: readonly ModelToolCall[];
}

export interface ModelStreamChunk {
  readonly index: number;
  readonly deltaText: string;
  readonly finishReason?: ModelFinishReason;
  readonly usage?: NormalizedUsageMetadata;
  readonly toolCalls?: readonly ModelToolCall[];
}
```

### Specialized Error Hierarchy

All provider errors extend `ProviderError` and provide strong typing for retry behavior and status codes:

- `ProviderAuthenticationError` (401/403, non-retryable)
- `ProviderRateLimitError` (429, retryable, parses `retry-after` header)
- `ProviderTimeoutError` (408/timeout, retryable)
- `ProviderNetworkError` (connection refused, DNS failure, retryable)
- `ProviderInvalidRequestError` (400, bad model/payload, non-retryable)
- `ProviderServerError` (5xx upstream failure, retryable)
- `ProviderUnauthorizedCallError` (403, security guard blocking unauthorized external calls)

---

## 5. Security Model & Prompt Protection

1. **Authorization Gate:**
   `assertExternalCallAuthorized()` inspects the target endpoint and credential configuration. Remote endpoints are rejected with `ProviderUnauthorizedCallError` unless `allowExternalCalls=true` and a valid API key are supplied.
2. **Local Endpoint Exemption:**
   Endpoints on `localhost`, `127.0.0.1`, or `0.0.0.0` (such as local Ollama) are recognized as local and require no credentials or paid authorization.
3. **Credential Redaction:**
   `sanitizeHeaders()` replaces `Authorization: Bearer ...` and API key headers with `[REDACTED]`.
4. **Audit Sanitization:**
   `sanitizeRequestForAudit()` records model identifier, message count, temperature, and options without printing raw user prompt content or system instructions.

---

## 6. CLI Provider Commands

The CLI provides commands for provider inspection, testing, and setup:

```bash
# List all configured providers, status, and credential health
terrarium provider list

# Output structured JSON for automation or Studio UI
terrarium provider list --json

# Inspect detailed provider card and capabilities
terrarium provider info openai

# Test provider connectivity and latency
terrarium provider test openai

# Display setup guide and safe environment configuration instructions
terrarium provider setup openai
```
