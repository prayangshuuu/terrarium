/**
 * @terrarium/config - types.ts
 *
 * Strongly typed configuration contracts separating preferences, secrets, and machine paths.
 * Pure TypeScript, depends on @terrarium/contracts.
 */

import {
  type ModelTier,
  type ProviderType,
  type TerrariumPackageInfo,
} from "@terrarium/contracts";

export const CONFIG_PACKAGE_NAME = "@terrarium/config" as const;
export const CONFIG_VERSION = "0.1.0" as const;

export type AppEnvironment = "development" | "test" | "production" | "staging";
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export type HumanApprovalMode = "always" | "consequential_only" | "never";

/**
 * Machine filesystem path configuration.
 * All paths can be configured as relative and are normalized to absolute paths at runtime.
 */
export interface PathsConfig {
  readonly projectRoot: string;
  readonly dataDir: string;
  readonly logDir: string;
  readonly reportsDir: string;
  readonly dbPath: string;
}

/**
 * User and runtime behavioral preferences.
 */
export interface PreferencesConfig {
  readonly defaultProvider: ProviderType;
  readonly defaultModelTier: ModelTier;
  readonly humanApprovalMode: HumanApprovalMode;
}

/**
 * Orchestration execution and spend budget limits.
 */
export interface BudgetConfigSettings {
  readonly maxTokensPerTurn: number;
  readonly maxDelegationDepth: number;
  readonly warningThresholdPercent: number;
  readonly defaultTaskBudgetUsd: number;
}

/**
 * Model provider connection settings and credentials.
 */
export interface ProviderConnectionConfig {
  readonly provider: ProviderType;
  readonly enabled: boolean;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly organizationId?: string;
}

/**
 * Source from which a credential or configuration value was resolved.
 */
export type CredentialSource = "override" | "env" | "dotenv" | "default" | "none";

export interface ResolvedCredentialInfo {
  readonly provider: ProviderType;
  readonly source: CredentialSource;
  readonly isConfigured: boolean;
  readonly maskedKey?: string;
}

/**
 * Primary Terrarium configuration entity.
 * Provides structured separation of machine paths, preferences, and provider secrets,
 * while maintaining top-level accessors for backward compatibility.
 */
export interface TerrariumConfig {
  // Top-level / backward-compatible properties
  readonly environment: AppEnvironment;
  readonly appName: string;
  readonly version: string;
  readonly debug: boolean;
  readonly dataDir: string;
  readonly logDir: string;

  // Structured subsystem configuration
  readonly paths: PathsConfig;
  readonly preferences: PreferencesConfig;
  readonly budget: BudgetConfigSettings;
  readonly providers: Readonly<Record<ProviderType, ProviderConnectionConfig>>;

  // Helper methods
  getProviderConfig(provider: ProviderType): ProviderConnectionConfig;
  getCredentialStatus(provider: ProviderType): ResolvedCredentialInfo;
  toJSON(redact?: boolean): Record<string, unknown>;
}

/**
 * Input parameters for overriding or loading configuration.
 */
export interface TerrariumConfigInput {
  readonly environment?: AppEnvironment;
  readonly appName?: string;
  readonly version?: string;
  readonly debug?: boolean;
  readonly paths?: Partial<PathsConfig>;
  readonly preferences?: Partial<PreferencesConfig>;
  readonly budget?: Partial<BudgetConfigSettings>;
  readonly providers?: Partial<Record<ProviderType, Partial<ProviderConnectionConfig>>>;

  // Direct top-level path overrides for convenience
  readonly dataDir?: string;
  readonly logDir?: string;
  readonly projectRoot?: string;
}

/**
 * Options passed to the configuration loader.
 */
export interface ConfigLoadOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
  readonly dotEnvPath?: string;
  readonly overrides?: Partial<TerrariumConfigInput>;
}

export function getConfigPackageInfo(): TerrariumPackageInfo {
  return {
    name: CONFIG_PACKAGE_NAME,
    version: CONFIG_VERSION,
    role: "configuration_management",
  };
}
