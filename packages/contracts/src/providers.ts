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
  readonly estimatedCostUsd?: number;
}

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

  return ok({
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd,
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
