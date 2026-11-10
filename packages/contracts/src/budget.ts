/**
 * @terrarium/contracts - budget.ts
 *
 * Configurable budget limits, token caps, concurrency bounds, dollar thresholds,
 * reservations under concurrency, and cost estimation rates.
 * Aligns strictly with PLAN.md Section 13 (Token, Cost, & Performance Management).
 */

import { type Result, ok, fail } from "./base.ts";
import { BudgetExceededError, DomainValidationError, type ValidationIssue } from "./errors.ts";
import {
  isRecord,
  validateBoolean,
  validateEnum,
  validateIsoDateTime,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

export const BUDGET_SCOPES = [
  "task",
  "workflow",
  "session",
  "project",
  "provider",
  "agent",
] as const;

export type BudgetScope = (typeof BUDGET_SCOPES)[number];

export const LIMIT_EXCEEDED_ACTIONS = [
  "stop",
  "pause_and_request_approval",
  "warn_only",
] as const;

export type LimitExceededAction = (typeof LIMIT_EXCEEDED_ACTIONS)[number];

export const RESERVATION_STATUSES = [
  "active",
  "committed",
  "released",
  "expired",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/**
 * Detailed budget configuration governing tokens, spend, duration, concurrency, and recursive bounds.
 */
export interface BudgetConfig {
  readonly scope: BudgetScope;
  readonly targetId?: string;
  readonly maxTokens?: number;
  readonly maxSpendUsd?: number;
  readonly maxDurationMs?: number;
  readonly maxConcurrency?: number;
  readonly maxDelegationDepth?: number;
  readonly maxRetries?: number;
  readonly maxDebateRounds?: number;
  readonly warningThresholdPercent?: number; // e.g. 80 for 80% (defaults to 80)
  readonly isHardLimit?: boolean; // defaults to true
  readonly onLimitExceeded?: LimitExceededAction;
}

/**
 * Concurrency-safe budget reservation slice.
 */
export interface BudgetReservation {
  readonly id: string;
  readonly scope: BudgetScope;
  readonly targetId: string;
  readonly reservedTokens: number;
  readonly reservedSpendUsd: number;
  readonly status: ReservationStatus;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly settledAt?: string;
}

/**
 * Committed ledger entry for actual or estimated token and dollar expenditure.
 */
export interface BudgetLedgerEntry {
  readonly id: string;
  readonly scope: BudgetScope;
  readonly targetId: string;
  readonly tokens: number;
  readonly spendUsd: number;
  readonly isEstimate: boolean;
  readonly modelId?: string;
  readonly providerId?: string;
  readonly taskStepId?: string;
  readonly timestamp: string;
}

/**
 * Consolidated budget and usage summary for a target scope.
 */
export interface BudgetSummary {
  readonly scope: BudgetScope;
  readonly targetId: string;
  readonly allocatedTokens?: number;
  readonly allocatedSpendUsd?: number;
  readonly usedTokens: number;
  readonly usedSpendUsd: number;
  readonly reservedTokens: number;
  readonly reservedSpendUsd: number;
  readonly remainingTokens?: number;
  readonly remainingSpendUsd?: number;
  readonly isWarning: boolean;
  readonly isExceeded: boolean;
  readonly isEstimate: boolean;
  readonly activeConcurrency: number;
  readonly maxConcurrency?: number;
  readonly lastCheckedAt: string;
}

/**
 * Token pricing rates per 1,000 tokens in USD.
 */
export interface ModelCostRates {
  readonly promptTokensPer1kUsd: number;
  readonly completionTokensPer1kUsd: number;
}

/**
 * Canonical pricing rates per model identifier.
 */
export const CANONICAL_MODEL_RATES: Readonly<Record<string, ModelCostRates>> = {
  // Fast / Economical Tier
  "gpt-4o-mini": { promptTokensPer1kUsd: 0.00015, completionTokensPer1kUsd: 0.0006 },
  "claude-3-5-haiku": { promptTokensPer1kUsd: 0.0008, completionTokensPer1kUsd: 0.004 },
  "gemini-1.5-flash": { promptTokensPer1kUsd: 0.000075, completionTokensPer1kUsd: 0.0003 },
  "mock-fast": { promptTokensPer1kUsd: 0.0001, completionTokensPer1kUsd: 0.0002 },

  // Standard Tier
  "gpt-4o": { promptTokensPer1kUsd: 0.0025, completionTokensPer1kUsd: 0.01 },
  "claude-3-5-sonnet": { promptTokensPer1kUsd: 0.003, completionTokensPer1kUsd: 0.015 },
  "gemini-1.5-pro": { promptTokensPer1kUsd: 0.00125, completionTokensPer1kUsd: 0.005 },
  "mock-standard": { promptTokensPer1kUsd: 0.002, completionTokensPer1kUsd: 0.005 },

  // Advanced / High-Reasoning Tier
  "o1": { promptTokensPer1kUsd: 0.015, completionTokensPer1kUsd: 0.06 },
  "o1-preview": { promptTokensPer1kUsd: 0.015, completionTokensPer1kUsd: 0.06 },
  "claude-3-opus": { promptTokensPer1kUsd: 0.015, completionTokensPer1kUsd: 0.075 },
  "mock-advanced": { promptTokensPer1kUsd: 0.01, completionTokensPer1kUsd: 0.03 },
};

export const DEFAULT_TIER_RATES: Readonly<Record<"fast" | "standard" | "advanced", ModelCostRates>> = {
  fast: { promptTokensPer1kUsd: 0.0002, completionTokensPer1kUsd: 0.0008 },
  standard: { promptTokensPer1kUsd: 0.0025, completionTokensPer1kUsd: 0.01 },
  advanced: { promptTokensPer1kUsd: 0.015, completionTokensPer1kUsd: 0.06 },
};

export const ESTIMATE_DISCLAIMER =
  "Estimates are operational approximations, not exact provider invoices (PLAN.md Section 13.3)." as const;

/**
 * Calculates estimated USD spend from token counts using canonical rates.
 * Always tagged as an estimate per PLAN.md Section 13.3.
 */
export function calculateEstimatedCostUsd(
  modelIdOrTier: string,
  promptTokens: number,
  completionTokens: number
): { estimatedCostUsd: number; isEstimate: true } {
  let rates = CANONICAL_MODEL_RATES[modelIdOrTier];
  if (!rates) {
    if (modelIdOrTier in DEFAULT_TIER_RATES) {
      rates = DEFAULT_TIER_RATES[modelIdOrTier as "fast" | "standard" | "advanced"];
    } else {
      rates = DEFAULT_TIER_RATES.standard;
    }
  }

  const promptCost = (promptTokens / 1000) * rates.promptTokensPer1kUsd;
  const completionCost = (completionTokens / 1000) * rates.completionTokensPer1kUsd;
  const total = Number((promptCost + completionCost).toFixed(6));

  return { estimatedCostUsd: total, isEstimate: true };
}

export function validateBudgetConfig(
  value: unknown,
  path = "budgetConfig"
): Result<BudgetConfig, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const scope = collector.check(validateEnum(value.scope, `${path}.scope`, BUDGET_SCOPES));
  let targetId: string | undefined;
  if (value.targetId !== undefined) {
    targetId = collector.check(
      validateString(value.targetId, `${path}.targetId`, { minLength: 1, maxLength: 100 })
    );
  }

  let maxTokens: number | undefined;
  if (value.maxTokens !== undefined) {
    maxTokens = collector.check(
      validateNumber(value.maxTokens, `${path}.maxTokens`, { min: 1, integer: true })
    );
  }

  let maxSpendUsd: number | undefined;
  if (value.maxSpendUsd !== undefined) {
    maxSpendUsd = collector.check(
      validateNumber(value.maxSpendUsd, `${path}.maxSpendUsd`, { min: 0.01 })
    );
  }

  let maxDurationMs: number | undefined;
  if (value.maxDurationMs !== undefined) {
    maxDurationMs = collector.check(
      validateNumber(value.maxDurationMs, `${path}.maxDurationMs`, { min: 100, integer: true })
    );
  }

  let maxConcurrency: number | undefined;
  if (value.maxConcurrency !== undefined) {
    maxConcurrency = collector.check(
      validateNumber(value.maxConcurrency, `${path}.maxConcurrency`, { min: 1, max: 100, integer: true })
    );
  }

  let maxDelegationDepth: number | undefined;
  if (value.maxDelegationDepth !== undefined) {
    maxDelegationDepth = collector.check(
      validateNumber(value.maxDelegationDepth, `${path}.maxDelegationDepth`, { min: 0, max: 10, integer: true })
    );
  }

  let maxRetries: number | undefined;
  if (value.maxRetries !== undefined) {
    maxRetries = collector.check(
      validateNumber(value.maxRetries, `${path}.maxRetries`, { min: 0, max: 20, integer: true })
    );
  }

  let maxDebateRounds: number | undefined;
  if (value.maxDebateRounds !== undefined) {
    maxDebateRounds = collector.check(
      validateNumber(value.maxDebateRounds, `${path}.maxDebateRounds`, { min: 1, max: 10, integer: true })
    );
  }

  const warningThresholdPercent = collector.check(
    validateNumber(value.warningThresholdPercent ?? 80, `${path}.warningThresholdPercent`, {
      min: 1,
      max: 100,
    })
  );

  const isHardLimit = collector.check(
    validateBoolean(value.isHardLimit ?? true, `${path}.isHardLimit`)
  );

  let onLimitExceeded: LimitExceededAction | undefined = undefined;
  if (value.onLimitExceeded !== undefined) {
    onLimitExceeded = collector.check(
      validateEnum(value.onLimitExceeded, `${path}.onLimitExceeded`, LIMIT_EXCEEDED_ACTIONS)
    );
  }

  if (
    collector.hasIssues() ||
    scope === undefined ||
    warningThresholdPercent === undefined ||
    isHardLimit === undefined
  ) {
    return fail(collector.toError("BudgetConfig validation failed"));
  }

  return ok({
    scope,
    targetId,
    maxTokens,
    maxSpendUsd,
    maxDurationMs,
    maxConcurrency,
    maxDelegationDepth,
    maxRetries,
    maxDebateRounds,
    warningThresholdPercent,
    isHardLimit,
    onLimitExceeded: onLimitExceeded ?? "stop",
  });
}

/**
 * Checks whether current usage exceeds configured limits or triggers warning thresholds.
 */
export function evaluateBudget(
  config: BudgetConfig,
  currentTokens: number,
  currentSpendUsd: number
): {
  isWarning: boolean;
  isExceeded: boolean;
  exceededError?: BudgetExceededError;
} {
  let isWarning = false;
  let isExceeded = false;
  let exceededError: BudgetExceededError | undefined;

  const warnFactor = (config.warningThresholdPercent ?? 80) / 100;

  if (config.maxTokens !== undefined) {
    if (currentTokens >= config.maxTokens * warnFactor) {
      isWarning = true;
    }
    if (currentTokens >= config.maxTokens) {
      isExceeded = true;
      exceededError = new BudgetExceededError(
        config.scope,
        currentTokens,
        config.maxTokens,
        "tokens"
      );
    }
  }

  if (config.maxSpendUsd !== undefined) {
    if (currentSpendUsd >= config.maxSpendUsd * warnFactor) {
      isWarning = true;
    }
    if (currentSpendUsd >= config.maxSpendUsd) {
      isExceeded = true;
      if (!exceededError) {
        exceededError = new BudgetExceededError(
          config.scope,
          currentSpendUsd,
          config.maxSpendUsd,
          "usd"
        );
      }
    }
  }

  return { isWarning, isExceeded, exceededError };
}
