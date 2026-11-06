/**
 * @terrarium/config - defaults.ts
 *
 * Standard fallback values, baseline paths, and TerrariumConfig implementation.
 */

import { type ProviderType } from "@terrarium/contracts";
import {
  type AppEnvironment,
  type BudgetConfigSettings,
  CONFIG_VERSION,
  type PathsConfig,
  type PreferencesConfig,
  type ProviderConnectionConfig,
  type ResolvedCredentialInfo,
  type TerrariumConfig,
  type TerrariumConfigInput,
} from "./types.ts";
import { maskSecret, sanitizeObjectForLogging } from "./secrets.ts";

export const DEFAULT_PATHS: Readonly<PathsConfig> = {
  projectRoot: ".",
  dataDir: ".terrarium/data",
  logDir: ".terrarium/logs",
  reportsDir: "docs/reports",
  dbPath: ".terrarium/data/terrarium.sqlite3",
};

export const DEFAULT_PREFERENCES: Readonly<PreferencesConfig> = {
  defaultProvider: "anthropic",
  defaultModelTier: "standard",
  humanApprovalMode: "consequential_only",
};

export const DEFAULT_BUDGET: Readonly<BudgetConfigSettings> = {
  maxTokensPerTurn: 8192,
  maxDelegationDepth: 3,
  warningThresholdPercent: 80,
  defaultTaskBudgetUsd: 0.5,
};

export const DEFAULT_PROVIDERS: Readonly<Record<ProviderType, ProviderConnectionConfig>> = {
  anthropic: {
    provider: "anthropic",
    enabled: false,
    baseUrl: "https://api.anthropic.com",
  },
  openai: {
    provider: "openai",
    enabled: false,
    baseUrl: "https://api.openai.com/v1",
  },
  gemini: {
    provider: "gemini",
    enabled: false,
    baseUrl: "https://generativelanguage.googleapis.com",
  },
  ollama: {
    provider: "ollama",
    enabled: true, // local offline provider default
    baseUrl: "http://localhost:11434",
  },
  custom: {
    provider: "custom",
    enabled: false,
  },
};

/**
 * Concrete implementation of the TerrariumConfig interface.
 * Implements strict separation of sub-configs while providing backward-compatible top-level properties.
 */
export class TerrariumConfigImpl implements TerrariumConfig {
  readonly environment: AppEnvironment;
  readonly appName: string;
  readonly version: string;
  readonly debug: boolean;
  readonly paths: PathsConfig;
  readonly preferences: PreferencesConfig;
  readonly budget: BudgetConfigSettings;
  readonly providers: Readonly<Record<ProviderType, ProviderConnectionConfig>>;

  // Backward compatibility getters
  get dataDir(): string {
    return this.paths.dataDir;
  }

  get logDir(): string {
    return this.paths.logDir;
  }

  constructor(options: {
    environment: AppEnvironment;
    appName: string;
    version: string;
    debug: boolean;
    paths: PathsConfig;
    preferences: PreferencesConfig;
    budget: BudgetConfigSettings;
    providers: Readonly<Record<ProviderType, ProviderConnectionConfig>>;
  }) {
    this.environment = options.environment;
    this.appName = options.appName;
    this.version = options.version;
    this.debug = options.debug;
    this.paths = options.paths;
    this.preferences = options.preferences;
    this.budget = options.budget;
    this.providers = options.providers;
  }

  getProviderConfig(provider: ProviderType): ProviderConnectionConfig {
    return this.providers[provider] ?? { provider, enabled: false };
  }

  getCredentialStatus(provider: ProviderType): ResolvedCredentialInfo {
    const cfg = this.getProviderConfig(provider);
    const hasKey = Boolean(cfg.apiKey && cfg.apiKey.trim().length > 0);
    return {
      provider,
      source: hasKey ? "env" : "none",
      isConfigured: hasKey || provider === "ollama",
      maskedKey: hasKey ? maskSecret(cfg.apiKey) : undefined,
    };
  }

  toJSON(redact = true): Record<string, unknown> {
    const raw: Record<string, unknown> = {
      environment: this.environment,
      appName: this.appName,
      version: this.version,
      debug: this.debug,
      dataDir: this.dataDir,
      logDir: this.logDir,
      paths: this.paths,
      preferences: this.preferences,
      budget: this.budget,
      providers: this.providers,
    };

    if (redact) {
      return sanitizeObjectForLogging(raw);
    }
    return raw;
  }
}

/**
 * Generates standard default configuration with optional overrides.
 * Preserves 100% backward compatibility with @terrarium/core.
 */
export function getDefaultConfig(
  overrides: Partial<TerrariumConfigInput> = {}
): TerrariumConfig {
  const env: AppEnvironment =
    overrides.environment ??
    ((process.env["NODE_ENV"] as AppEnvironment) || "development");

  const projectRoot = overrides.paths?.projectRoot ?? overrides.projectRoot ?? DEFAULT_PATHS.projectRoot;
  const dataDir = overrides.paths?.dataDir ?? overrides.dataDir ?? DEFAULT_PATHS.dataDir;
  const logDir = overrides.paths?.logDir ?? overrides.logDir ?? DEFAULT_PATHS.logDir;
  const reportsDir = overrides.paths?.reportsDir ?? DEFAULT_PATHS.reportsDir;
  const dbPath = overrides.paths?.dbPath ?? `${dataDir}/terrarium.sqlite3`;

  const mergedProviders: Record<ProviderType, ProviderConnectionConfig> = {
    ...DEFAULT_PROVIDERS,
  };

  if (overrides.providers) {
    for (const [pKey, pVal] of Object.entries(overrides.providers)) {
      const p = pKey as ProviderType;
      if (pVal && mergedProviders[p]) {
        mergedProviders[p] = {
          ...mergedProviders[p],
          ...pVal,
        };
      }
    }
  }

  return new TerrariumConfigImpl({
    environment: env,
    appName: overrides.appName ?? "TERRARIUM",
    version: overrides.version ?? CONFIG_VERSION,
    debug: overrides.debug ?? false,
    paths: {
      projectRoot,
      dataDir,
      logDir,
      reportsDir,
      dbPath,
    },
    preferences: {
      defaultProvider: overrides.preferences?.defaultProvider ?? DEFAULT_PREFERENCES.defaultProvider,
      defaultModelTier: overrides.preferences?.defaultModelTier ?? DEFAULT_PREFERENCES.defaultModelTier,
      humanApprovalMode: overrides.preferences?.humanApprovalMode ?? DEFAULT_PREFERENCES.humanApprovalMode,
    },
    budget: {
      maxTokensPerTurn: overrides.budget?.maxTokensPerTurn ?? DEFAULT_BUDGET.maxTokensPerTurn,
      maxDelegationDepth: overrides.budget?.maxDelegationDepth ?? DEFAULT_BUDGET.maxDelegationDepth,
      warningThresholdPercent: overrides.budget?.warningThresholdPercent ?? DEFAULT_BUDGET.warningThresholdPercent,
      defaultTaskBudgetUsd: overrides.budget?.defaultTaskBudgetUsd ?? DEFAULT_BUDGET.defaultTaskBudgetUsd,
    },
    providers: mergedProviders,
  });
}
