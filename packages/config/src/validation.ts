/**
 * @terrarium/config - validation.ts
 *
 * Config validation schema and actionable error formatting.
 * Aligns with PLAN_CONTEXT.md Section 8 & 13.
 */

import {
  type Result,
  ok,
  fail,
  TerrariumError,
  type ValidationIssue,
} from "@terrarium/contracts";
import {
  type AppEnvironment,
  type HumanApprovalMode,
  type TerrariumConfig,
} from "./types.ts";

export class ConfigValidationError extends TerrariumError {
  readonly issues: readonly ValidationIssue[];
  readonly remediation: string;

  constructor(message: string, issues: readonly ValidationIssue[], remediation: string) {
    super(message, "VALIDATION_ERROR", { issues, remediation });
    this.name = "ConfigValidationError";
    this.issues = issues;
    this.remediation = remediation;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  formatActionableMessage(): string {
    const issueList = this.issues
      .map((i) => `  - [${i.path}]: ${i.message}`)
      .join("\n");
    return `${this.message}\n\nIssues detected:\n${issueList}\n\nTo remediate:\n  ${this.remediation}`;
  }
}

const VALID_ENVIRONMENTS: readonly AppEnvironment[] = [
  "development",
  "test",
  "production",
  "staging",
];

const VALID_APPROVAL_MODES: readonly HumanApprovalMode[] = [
  "always",
  "consequential_only",
  "never",
];

const VALID_PROVIDERS = ["openai", "anthropic", "gemini", "ollama", "custom"] as const;
const VALID_MODEL_TIERS = ["fast", "standard", "advanced"] as const;

/**
 * Validates a loaded or generated TerrariumConfig instance.
 */
export function validateConfig(config: unknown): Result<TerrariumConfig, ConfigValidationError> {
  if (!config || typeof config !== "object") {
    return fail(
      new ConfigValidationError(
        "Invalid configuration structure",
        [{ path: "config", message: "Configuration must be a non-null object", received: config }],
        "Ensure configuration provides valid application and path settings."
      )
    );
  }

  const c = config as Record<string, any>;
  const issues: ValidationIssue[] = [];
  const remediations: string[] = [];

  // 1. App metadata
  if (typeof c["appName"] !== "string" || c["appName"].trim().length === 0) {
    issues.push({
      path: "appName",
      message: "appName must be a non-empty string",
      received: c["appName"],
    });
    remediations.push("Set TERRARIUM_APP_NAME or provide appName in options.");
  }

  if (
    typeof c["environment"] !== "string" ||
    !VALID_ENVIRONMENTS.includes(c["environment"] as AppEnvironment)
  ) {
    issues.push({
      path: "environment",
      message: `environment must be one of [${VALID_ENVIRONMENTS.join(", ")}]`,
      received: c["environment"],
    });
    remediations.push("Set NODE_ENV or TERRARIUM_ENV to 'development', 'test', 'staging', or 'production'.");
  }

  // 2. Paths
  const paths = c["paths"];
  if (!paths || typeof paths !== "object") {
    issues.push({
      path: "paths",
      message: "paths configuration object is missing",
      received: paths,
    });
    remediations.push("Ensure paths configuration is defined.");
  } else {
    for (const pKey of ["projectRoot", "dataDir", "logDir", "reportsDir", "dbPath"]) {
      if (typeof paths[pKey] !== "string" || paths[pKey].trim().length === 0) {
        issues.push({
          path: `paths.${pKey}`,
          message: `${pKey} must be a non-empty filesystem path`,
          received: paths[pKey],
        });
      }
    }
  }

  // 3. Preferences
  const prefs = c["preferences"];
  if (!prefs || typeof prefs !== "object") {
    issues.push({
      path: "preferences",
      message: "preferences configuration object is missing",
      received: prefs,
    });
  } else {
    if (!VALID_PROVIDERS.includes(prefs.defaultProvider)) {
      issues.push({
        path: "preferences.defaultProvider",
        message: `defaultProvider must be one of [${VALID_PROVIDERS.join(", ")}]`,
        received: prefs.defaultProvider,
      });
      remediations.push("Set TERRARIUM_DEFAULT_PROVIDER to one of: anthropic, openai, gemini, ollama.");
    }

    if (!VALID_MODEL_TIERS.includes(prefs.defaultModelTier)) {
      issues.push({
        path: "preferences.defaultModelTier",
        message: `defaultModelTier must be one of [${VALID_MODEL_TIERS.join(", ")}]`,
        received: prefs.defaultModelTier,
      });
    }

    if (!VALID_APPROVAL_MODES.includes(prefs.humanApprovalMode)) {
      issues.push({
        path: "preferences.humanApprovalMode",
        message: `humanApprovalMode must be one of [${VALID_APPROVAL_MODES.join(", ")}]`,
        received: prefs.humanApprovalMode,
      });
      remediations.push("Set TERRARIUM_APPROVAL_MODE to 'always', 'consequential_only', or 'never'.");
    }
  }

  // 4. Budget
  const budget = c["budget"];
  if (!budget || typeof budget !== "object") {
    issues.push({
      path: "budget",
      message: "budget configuration object is missing",
      received: budget,
    });
  } else {
    if (typeof budget.maxTokensPerTurn !== "number" || budget.maxTokensPerTurn < 100) {
      issues.push({
        path: "budget.maxTokensPerTurn",
        message: "maxTokensPerTurn must be an integer >= 100",
        received: budget.maxTokensPerTurn,
      });
    }

    if (
      typeof budget.maxDelegationDepth !== "number" ||
      budget.maxDelegationDepth < 0 ||
      budget.maxDelegationDepth > 10
    ) {
      issues.push({
        path: "budget.maxDelegationDepth",
        message: "maxDelegationDepth must be between 0 and 10",
        received: budget.maxDelegationDepth,
      });
    }

    if (
      typeof budget.warningThresholdPercent !== "number" ||
      budget.warningThresholdPercent < 1 ||
      budget.warningThresholdPercent > 100
    ) {
      issues.push({
        path: "budget.warningThresholdPercent",
        message: "warningThresholdPercent must be between 1 and 100",
        received: budget.warningThresholdPercent,
      });
    }

    if (typeof budget.defaultTaskBudgetUsd !== "number" || budget.defaultTaskBudgetUsd < 0) {
      issues.push({
        path: "budget.defaultTaskBudgetUsd",
        message: "defaultTaskBudgetUsd must be a non-negative number",
        received: budget.defaultTaskBudgetUsd,
      });
    }
  }

  if (issues.length > 0) {
    const remediationText =
      remediations.length > 0
        ? remediations.join(" ")
        : "Check your .env file or configuration overrides and fix the invalid fields.";
    return fail(
      new ConfigValidationError(
        `Terrarium configuration validation failed (${issues.length} issue(s))`,
        issues,
        remediationText
      )
    );
  }

  return ok(config as TerrariumConfig);
}
