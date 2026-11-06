/**
 * @terrarium/contracts - budget.ts
 *
 * Configurable budget limits, token caps, dollar thresholds, and usage tracking.
 * Aligns strictly with PLAN.md Section 13 (Token, Cost, & Performance Management).
 */

import { type Result, ok, fail } from "./base.ts";
import { BudgetExceededError, DomainValidationError, type ValidationIssue } from "./errors.ts";
import {
  isRecord,
  validateBoolean,
  validateEnum,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

export const BUDGET_SCOPES = ["task", "workflow", "session", "project", "provider"] as const;
export type BudgetScope = (typeof BUDGET_SCOPES)[number];

export interface BudgetConfig {
  readonly scope: BudgetScope;
  readonly targetId?: string;
  readonly maxTokens?: number;
  readonly maxSpendUsd?: number;
  readonly warningThresholdPercent: number; // e.g. 80 for 80%
  readonly isHardLimit: boolean;
}

export interface BudgetUsage {
  readonly currentTokens: number;
  readonly currentSpendUsd: number;
  readonly isWarningTriggered: boolean;
  readonly isExceeded: boolean;
  readonly lastCheckedAt: string;
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

  const warningThresholdPercent = collector.check(
    validateNumber(value.warningThresholdPercent ?? 80, `${path}.warningThresholdPercent`, {
      min: 1,
      max: 100,
    })
  );

  const isHardLimit = collector.check(
    validateBoolean(value.isHardLimit ?? true, `${path}.isHardLimit`)
  );

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
    warningThresholdPercent,
    isHardLimit,
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

  const warnFactor = config.warningThresholdPercent / 100;

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
