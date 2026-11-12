/**
 * @terrarium/contracts - providers.ts
 *
 * Provider capabilities, model metadata, tier classification, and status contracts.
 * Decoupled from concrete provider SDKs (OpenAI, Anthropic, Gemini, Ollama).
 * Aligns with PLAN.md Section 12 (Model & Provider Ecosystem).
 */

import { type Result, ok, fail } from "./base.ts";
import { DomainValidationError, type ValidationIssue, type ProviderError } from "./errors.ts";
import { MODEL_TIERS, type ModelTier } from "./agent.ts";
import {
  isRecord,
  validateArray,
  validateBoolean,
  validateEnum,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

export const PROVIDER_TYPES = ["openai", "anthropic", "gemini", "ollama", "custom"] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const PROVIDER_STATUSES = ["healthy", "degraded", "unreachable", "unconfigured"] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

/**
 * Kind of provider integration.
 * PLAN.md Section 10.4 & Section 12 explicitly distinguish between:
 * - Direct Model API access (HTTP / SSE / REST chat completions and embeddings)
 * - Coding-Agent CLI integrations (subprocesses running in interactive PTY/workspace)
 */
export const PROVIDER_INTEGRATION_KINDS = ["model_api", "coding_agent_cli"] as const;
export type ProviderIntegrationKind = (typeof PROVIDER_INTEGRATION_KINDS)[number];

export interface CodingAgentCliOptions {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly autoApproveTools?: boolean;
  readonly maxSteps?: number;
}

export interface CodingAgentCliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly sessionToken?: string;
  readonly changedFiles?: readonly string[];
}

export interface CodingAgentCliCapabilities {
  readonly supportsInteractivePty: boolean;
  readonly supportedTools: readonly string[];
  readonly sessionPersistence: boolean;
  readonly defaultTimeoutMs: number;
}

export interface CodingAgentCliAdapter {
  readonly kind: "coding_agent_cli";
  readonly id: string;
  readonly name: string;
  getCapabilities(): Promise<Result<CodingAgentCliCapabilities, ProviderError>>;
  runAgentCommand(
    command: string,
    options: CodingAgentCliOptions
  ): Promise<Result<CodingAgentCliResult, ProviderError>>;
}

export const CHAT_MESSAGE_ROLES = ["system", "user", "assistant", "tool"] as const;
export type ChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];

export interface ModelToolCall {
  readonly id: string;
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
}

export interface ModelToolDefinition {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

export interface ModelMessage {
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly name?: string;
  readonly toolCallId?: string;
  readonly toolCalls?: readonly ModelToolCall[];
}

export const MODEL_FINISH_REASONS = [
  "stop",
  "length",
  "tool_calls",
  "content_filter",
  "cancelled",
  "error",
] as const;
export type ModelFinishReason = (typeof MODEL_FINISH_REASONS)[number];

export interface NormalizedUsageMetadata {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly cachedTokens?: number;
  readonly estimatedCostUsd?: number;
  readonly isEstimate?: boolean;
}

export type TokenUsage = NormalizedUsageMetadata;

export interface ModelRequestOptions {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
  readonly stopSequences?: readonly string[];
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly stream?: boolean;
  readonly tools?: readonly ModelToolDefinition[];
  readonly allowExternalCalls?: boolean;
}

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
  readonly rawResponse?: unknown;
}

export interface ModelStreamChunk {
  readonly index: number;
  readonly deltaText: string;
  readonly finishReason?: ModelFinishReason;
  readonly usage?: NormalizedUsageMetadata;
  readonly toolCalls?: readonly ModelToolCall[];
}

export interface ModelCapabilities {
  readonly contextWindow: number;
  readonly maxOutputTokens: number;
  readonly supportsStreaming: boolean;
  readonly supportsTools: boolean;
  readonly supportsVision: boolean;
  readonly supportsJsonMode: boolean;
  readonly costPerInputToken?: number;
  readonly costPerOutputToken?: number;
}

export interface ProviderHealthCheckResult {
  readonly isHealthy: boolean;
  readonly latencyMs: number;
  readonly message?: string;
  readonly timestamp: string;
}

export interface ModelProviderAdapter {
  readonly kind: "model_api";
  readonly providerType: ProviderType;
  readonly name: string;
  getCapabilities(modelId?: string): Promise<Result<ModelCapabilities, ProviderError>>;
  listModels(): Promise<Result<readonly ModelInfo[], ProviderError>>;
  complete(request: ModelCompletionRequest, options?: ModelRequestOptions): Promise<Result<ModelResponse, ProviderError>>;
  stream(request: ModelCompletionRequest, options?: ModelRequestOptions): AsyncIterable<Result<ModelStreamChunk, ProviderError>>;
  checkHealth(): Promise<Result<ProviderHealthCheckResult, ProviderError>>;
}

export interface ModelInfo {
  readonly id: string;
  readonly displayName: string;
  readonly tier: ModelTier;
  readonly contextWindow: number;
  readonly supportsTools: boolean;
  readonly supportsStreaming: boolean;
  readonly costPerInputToken?: number;
  readonly costPerOutputToken?: number;
}

export interface ProviderInfo {
  readonly id: string;
  readonly providerType: ProviderType;
  readonly name: string;
  readonly isEnabled: boolean;
  readonly models: readonly ModelInfo[];
  readonly status: ProviderStatus;
}

export function validateModelInfo(
  value: unknown,
  path = "model"
): Result<ModelInfo, ValidationIssue[]> {
  if (!isRecord(value)) {
    return fail([{ path, message: "Expected object for ModelInfo", received: value }]);
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const displayName = collector.check(
    validateString(value.displayName, `${path}.displayName`, { minLength: 1, maxLength: 100 })
  );
  const tier = collector.check(validateEnum(value.tier, `${path}.tier`, MODEL_TIERS));
  const contextWindow = collector.check(
    validateNumber(value.contextWindow, `${path}.contextWindow`, { min: 1000, integer: true })
  );
  const supportsTools = collector.check(validateBoolean(value.supportsTools, `${path}.supportsTools`));
  const supportsStreaming = collector.check(
    validateBoolean(value.supportsStreaming, `${path}.supportsStreaming`)
  );

  if (
    collector.hasIssues() ||
    id === undefined ||
    displayName === undefined ||
    tier === undefined ||
    contextWindow === undefined ||
    supportsTools === undefined ||
    supportsStreaming === undefined
  ) {
    return fail(collector.issues);
  }

  return ok({
    id,
    displayName,
    tier,
    contextWindow,
    supportsTools,
    supportsStreaming,
    costPerInputToken: typeof value.costPerInputToken === "number" ? value.costPerInputToken : undefined,
    costPerOutputToken: typeof value.costPerOutputToken === "number" ? value.costPerOutputToken : undefined,
  });
}

export function validateProviderInfo(
  value: unknown,
  path = "provider"
): Result<ProviderInfo, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const providerType = collector.check(
    validateEnum(value.providerType, `${path}.providerType`, PROVIDER_TYPES)
  );
  const name = collector.check(validateString(value.name, `${path}.name`, { minLength: 1, maxLength: 100 }));
  const isEnabled = collector.check(validateBoolean(value.isEnabled, `${path}.isEnabled`));
  const status = collector.check(validateEnum(value.status, `${path}.status`, PROVIDER_STATUSES));

  const models = collector.check(
    validateArray<ModelInfo>(value.models ?? [], `${path}.models`, (m, mPath) => {
      const mRes = validateModelInfo(m, mPath);
      if (!mRes.success) return fail(mRes.error[0] ?? { path: mPath, message: "Invalid model" });
      return ok(mRes.data);
    })
  );

  if (
    collector.hasIssues() ||
    id === undefined ||
    providerType === undefined ||
    name === undefined ||
    isEnabled === undefined ||
    status === undefined
  ) {
    return fail(collector.toError("ProviderInfo validation failed"));
  }

  return ok({
    id,
    providerType,
    name,
    isEnabled,
    models: models ?? [],
    status,
  });
}

export function validateNormalizedUsage(
  value: unknown,
  path = "usage"
): Result<NormalizedUsageMetadata, ValidationIssue[]> {
  if (!isRecord(value)) {
    return fail([{ path, message: "Expected object for NormalizedUsageMetadata", received: value }]);
  }

  const collector = new ValidationCollector();
  const promptTokens = collector.check(
    validateNumber(value.promptTokens, `${path}.promptTokens`, { min: 0, integer: true })
  );
  const completionTokens = collector.check(
    validateNumber(value.completionTokens, `${path}.completionTokens`, { min: 0, integer: true })
  );
  const totalTokens = collector.check(
    validateNumber(value.totalTokens, `${path}.totalTokens`, { min: 0, integer: true })
  );

  if (collector.hasIssues() || promptTokens === undefined || completionTokens === undefined || totalTokens === undefined) {
    return fail(collector.issues);
  }

  const estimatedCostUsd = typeof value.estimatedCostUsd === "number" ? value.estimatedCostUsd : undefined;
  const cachedTokens = typeof value.cachedTokens === "number" ? value.cachedTokens : undefined;
  const isEstimate = typeof value.isEstimate === "boolean" ? value.isEstimate : undefined;

  return ok({
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
    estimatedCostUsd,
    isEstimate,
  });
}

export function validateModelMessage(
  value: unknown,
  path = "message"
): Result<ModelMessage, ValidationIssue[]> {
  if (!isRecord(value)) {
    return fail([{ path, message: "Expected object for ModelMessage", received: value }]);
  }

  const collector = new ValidationCollector();
  const role = collector.check(validateEnum(value.role, `${path}.role`, CHAT_MESSAGE_ROLES));
  const content = collector.check(validateString(value.content, `${path}.content`, { minLength: 0 }));

  if (collector.hasIssues() || role === undefined || content === undefined) {
    return fail(collector.issues);
  }

  return ok({
    role,
    content,
    name: typeof value.name === "string" ? value.name : undefined,
    toolCallId: typeof value.toolCallId === "string" ? value.toolCallId : undefined,
    toolCalls: Array.isArray(value.toolCalls) ? (value.toolCalls as ModelToolCall[]) : undefined,
  });
}

export function validateModelCompletionRequest(
  value: unknown,
  path = "request"
): Result<ModelCompletionRequest, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const model = collector.check(validateString(value.model, `${path}.model`, { minLength: 1 }));

  const messages = collector.check(
    validateArray<ModelMessage>(value.messages, `${path}.messages`, (msg, mPath) => {
      const res = validateModelMessage(msg, mPath);
      if (!res.success) return fail(res.error[0] ?? { path: mPath, message: "Invalid message" });
      return ok(res.data);
    })
  );

  if (collector.hasIssues() || model === undefined || messages === undefined) {
    return fail(collector.toError("ModelCompletionRequest validation failed"));
  }

  return ok({
    model,
    messages,
    options: isRecord(value.options) ? (value.options as ModelRequestOptions) : undefined,
  });
}

export function validateModelResponse(
  value: unknown,
  path = "response"
): Result<ModelResponse, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1 }));
  const provider = collector.check(validateEnum(value.provider, `${path}.provider`, PROVIDER_TYPES));
  const model = collector.check(validateString(value.model, `${path}.model`, { minLength: 1 }));
  const text = collector.check(validateString(value.text, `${path}.text`, { minLength: 0 }));
  const finishReason = collector.check(
    validateEnum(value.finishReason, `${path}.finishReason`, MODEL_FINISH_REASONS)
  );
  const durationMs = collector.check(validateNumber(value.durationMs, `${path}.durationMs`, { min: 0 }));

  const usageRes = validateNormalizedUsage(value.usage, `${path}.usage`);
  let usage: NormalizedUsageMetadata | undefined;
  if (!usageRes.success) {
    for (const issue of usageRes.error) {
      collector.check(fail(issue));
    }
  } else {
    usage = usageRes.data;
  }

  if (
    collector.hasIssues() ||
    id === undefined ||
    provider === undefined ||
    model === undefined ||
    text === undefined ||
    finishReason === undefined ||
    durationMs === undefined ||
    usage === undefined
  ) {
    return fail(collector.toError("ModelResponse validation failed"));
  }

  return ok({
    id,
    provider,
    model,
    text,
    finishReason,
    usage,
    durationMs,
    toolCalls: Array.isArray(value.toolCalls) ? (value.toolCalls as ModelToolCall[]) : undefined,
    rawResponse: value.rawResponse,
  });
}

/**
 * Specialist integration ranking, scopes, and risk classification contracts.
 * Aligns with PLAN.md Section 10.4, Section 12, and PROMPT 19 requirements (A1 - Boundaries).
 */
export const INTEGRATION_VALUE_LEVELS = ["critical", "high", "medium", "low"] as const;
export type SpecialistIntegrationValue = (typeof INTEGRATION_VALUE_LEVELS)[number];

export const INTEGRATION_RISK_LEVELS = ["low", "medium", "high"] as const;
export type SpecialistIntegrationRisk = (typeof INTEGRATION_RISK_LEVELS)[number];

export const INTEGRATION_MAINTENANCE_LEVELS = ["low", "medium", "high"] as const;
export type SpecialistIntegrationMaintenance = (typeof INTEGRATION_MAINTENANCE_LEVELS)[number];

export const INTEGRATION_SUPPORT_LEVELS = ["tier1_official", "tier2_experimental", "community"] as const;
export type SpecialistIntegrationSupport = (typeof INTEGRATION_SUPPORT_LEVELS)[number];

export const INTEGRATION_CONNECTION_MODES = ["explicit_key", "local_daemon", "cli_subprocess"] as const;
export type SpecialistConnectionMode = (typeof INTEGRATION_CONNECTION_MODES)[number];

export interface SpecialistIntegration {
  readonly id: string;
  readonly name: string;
  readonly rank: number;
  readonly kind: ProviderIntegrationKind;
  readonly providerType: ProviderType;
  readonly userValue: SpecialistIntegrationValue;
  readonly risk: SpecialistIntegrationRisk;
  readonly maintenance: SpecialistIntegrationMaintenance;
  readonly supportStatus: SpecialistIntegrationSupport;
  readonly description: string;
  readonly connectionMode: SpecialistConnectionMode;
  readonly requiredScopes: readonly string[];
  readonly dataFlowSummary: string;
  readonly rateLimitsSummary: string;
  readonly sideEffects: readonly string[];
  readonly limitations: readonly string[];
  readonly isAvailable: boolean;
  readonly isEnabled: boolean;
  readonly isConnected: boolean;
  readonly diagnosticMessage?: string;
}

/**
 * Canonical evaluated rankings of specialist integrations by user value, risk, maintenance, and support.
 * Satisfies PROMPT 19: "Rank integrations by user value, risk, maintenance, and support."
 */
export const INTEGRATION_RANKINGS: readonly SpecialistIntegration[] = [
  {
    id: "anthropic",
    name: "Anthropic Claude Models",
    rank: 1,
    kind: "model_api",
    providerType: "anthropic",
    userValue: "critical",
    risk: "low",
    maintenance: "low",
    supportStatus: "tier1_official",
    description: "Default high-reasoning intelligence for architecture review, code analysis, and planning.",
    connectionMode: "explicit_key",
    requiredScopes: ["messages:write", "models:read"],
    dataFlowSummary: "Encrypted HTTPS REST to api.anthropic.com; zero customer data retention under commercial API terms.",
    rateLimitsSummary: "Automatic header backoff against standard Anthropic tier rate limits (RPM / TPM).",
    sideEffects: ["Incurs API token costs per model pricing tier (Sonnet, Haiku, Opus)"],
    limitations: [
      "Requires active external network access",
      "Requires explicit ANTHROPIC_API_KEY credential configuration",
      "Subject to provider cloud availability and upstream rate limits",
    ],
    isAvailable: true,
    isEnabled: true,
    isConnected: false,
  },
  {
    id: "ollama",
    name: "Ollama Local Offline Models",
    rank: 2,
    kind: "model_api",
    providerType: "ollama",
    userValue: "high",
    risk: "low",
    maintenance: "low",
    supportStatus: "tier1_official",
    description: "100% private, zero-cost offline local inference (Llama 3.2, Qwen2.5-Coder, DeepSeek).",
    connectionMode: "local_daemon",
    requiredScopes: ["local:inference", "models:read"],
    dataFlowSummary: "100% local loopback communication (http://localhost:11434); zero external data egress.",
    rateLimitsSummary: "Unthrottled by API keys; concurrency bounded by local CPU/GPU and system memory queue.",
    sideEffects: ["Utilizes local host CPU, RAM, and GPU/VRAM hardware resources"],
    limitations: [
      "Context window and generation latency constrained by local host hardware specs",
      "Requires local Ollama daemon to be running ('ollama serve')",
      "Smaller local models exhibit lower reasoning accuracy than large frontier cloud models",
    ],
    isAvailable: true,
    isEnabled: true,
    isConnected: false,
  },
  {
    id: "openai",
    name: "OpenAI & Compatible Models",
    rank: 3,
    kind: "model_api",
    providerType: "openai",
    userValue: "high",
    risk: "low",
    maintenance: "low",
    supportStatus: "tier1_official",
    description: "Omnimodal and specialized reasoning models (GPT-4o, o1-mini, GPT-4o-mini).",
    connectionMode: "explicit_key",
    requiredScopes: ["chat:write", "models:read"],
    dataFlowSummary: "Encrypted HTTPS REST to api.openai.com/v1; compliant with zero-retention enterprise terms.",
    rateLimitsSummary: "Dynamic token-bucket tracking against organization TPM / RPM headers.",
    sideEffects: ["Incurs API token usage costs per model pricing tier"],
    limitations: [
      "Requires active external network access",
      "Requires explicit OPENAI_API_KEY credential configuration",
      "Reasoning models (o1) do not support function tool calling or custom temperature",
    ],
    isAvailable: true,
    isEnabled: true,
    isConnected: false,
  },
  {
    id: "gemini",
    name: "Google Gemini Models",
    rank: 4,
    kind: "model_api",
    providerType: "gemini",
    userValue: "high",
    risk: "medium",
    maintenance: "medium",
    supportStatus: "tier2_experimental",
    description: "Massive context-window multimodal reasoning (Gemini 1.5 Pro with 2M tokens, Gemini 1.5 Flash).",
    connectionMode: "explicit_key",
    requiredScopes: ["content:generate", "models:read"],
    dataFlowSummary: "Encrypted HTTPS REST to generativelanguage.googleapis.com; Google AI Studio terms apply.",
    rateLimitsSummary: "Per-minute request limits based on Google Cloud project quota tier.",
    sideEffects: ["Incurs Google Cloud token usage fees or quota consumption"],
    limitations: [
      "Requires active external network access",
      "Requires explicit GEMINI_API_KEY or GOOGLE_API_KEY configuration",
      "Different tool calling JSON schema convention from OpenAI standard",
    ],
    isAvailable: true,
    isEnabled: false,
    isConnected: false,
  },
  {
    id: "claude-code-cli",
    name: "Claude Code CLI Subprocess Adapter",
    rank: 5,
    kind: "coding_agent_cli",
    providerType: "anthropic",
    userValue: "medium",
    risk: "high",
    maintenance: "medium",
    supportStatus: "tier2_experimental",
    description: "Subprocess coding-agent workflow runner executing inside sandboxed workspace directory.",
    connectionMode: "cli_subprocess",
    requiredScopes: ["subproc:sandbox_exec", "fs:workspace_write"],
    dataFlowSummary: "Spawns local CLI subprocess with working directory strictly bound to workspace root.",
    rateLimitsSummary: "Bounded by execution timeout (default 120s) and concurrency pool limit of 1.",
    sideEffects: [
      "Spawns local operating system child processes",
      "May modify workspace files within designated sandbox boundaries",
    ],
    limitations: [
      "Requires external CLI binary ('claude') installed and present in system PATH",
      "Higher risk profile: requires human approval gate for consequential file alterations",
      "Non-interactive mode only; interactive PTY terminals are disabled in automated orchestration",
    ],
    isAvailable: true,
    isEnabled: false,
    isConnected: false,
  },
];

export function validateSpecialistIntegration(
  value: unknown,
  path = "integration"
): Result<SpecialistIntegration, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();
  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1 }));
  const name = collector.check(validateString(value.name, `${path}.name`, { minLength: 1 }));
  const rank = collector.check(validateNumber(value.rank, `${path}.rank`, { min: 1, integer: true }));
  const kind = collector.check(
    validateEnum(value.kind, `${path}.kind`, PROVIDER_INTEGRATION_KINDS)
  );
  const providerType = collector.check(
    validateEnum(value.providerType, `${path}.providerType`, PROVIDER_TYPES)
  );
  const userValue = collector.check(
    validateEnum(value.userValue, `${path}.userValue`, INTEGRATION_VALUE_LEVELS)
  );
  const risk = collector.check(
    validateEnum(value.risk, `${path}.risk`, INTEGRATION_RISK_LEVELS)
  );
  const maintenance = collector.check(
    validateEnum(value.maintenance, `${path}.maintenance`, INTEGRATION_MAINTENANCE_LEVELS)
  );
  const supportStatus = collector.check(
    validateEnum(value.supportStatus, `${path}.supportStatus`, INTEGRATION_SUPPORT_LEVELS)
  );
  const description = collector.check(
    validateString(value.description, `${path}.description`, { minLength: 1 })
  );
  const connectionMode = collector.check(
    validateEnum(value.connectionMode, `${path}.connectionMode`, INTEGRATION_CONNECTION_MODES)
  );
  const isAvailable = collector.check(validateBoolean(value.isAvailable, `${path}.isAvailable`));
  const isEnabled = collector.check(validateBoolean(value.isEnabled, `${path}.isEnabled`));
  const isConnected = collector.check(validateBoolean(value.isConnected, `${path}.isConnected`));

  if (
    collector.hasIssues() ||
    id === undefined ||
    name === undefined ||
    rank === undefined ||
    kind === undefined ||
    providerType === undefined ||
    userValue === undefined ||
    risk === undefined ||
    maintenance === undefined ||
    supportStatus === undefined ||
    description === undefined ||
    connectionMode === undefined ||
    isAvailable === undefined ||
    isEnabled === undefined ||
    isConnected === undefined
  ) {
    return fail(collector.toError("SpecialistIntegration validation failed"));
  }

  return ok({
    id,
    name,
    rank,
    kind,
    providerType,
    userValue,
    risk,
    maintenance,
    supportStatus,
    description,
    connectionMode,
    requiredScopes: Array.isArray(value.requiredScopes)
      ? (value.requiredScopes.filter((s) => typeof s === "string") as string[])
      : [],
    dataFlowSummary: typeof value.dataFlowSummary === "string" ? value.dataFlowSummary : "",
    rateLimitsSummary: typeof value.rateLimitsSummary === "string" ? value.rateLimitsSummary : "",
    sideEffects: Array.isArray(value.sideEffects)
      ? (value.sideEffects.filter((s) => typeof s === "string") as string[])
      : [],
    limitations: Array.isArray(value.limitations)
      ? (value.limitations.filter((s) => typeof s === "string") as string[])
      : [],
    isAvailable,
    isEnabled,
    isConnected,
    diagnosticMessage: typeof value.diagnosticMessage === "string" ? value.diagnosticMessage : undefined,
  });
}
