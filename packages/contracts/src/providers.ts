/**
 * @terrarium/contracts - providers.ts
 *
 * Provider capabilities, model metadata, tier classification, and status contracts.
 * Decoupled from concrete provider SDKs (OpenAI, Anthropic, Gemini, Ollama).
 * Aligns with PLAN.md Section 12 (Model & Provider Ecosystem).
 */

import { type Result, ok, fail } from "./base.ts";
import { DomainValidationError, type ValidationIssue } from "./errors.ts";
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
