/**
 * @terrarium/config - loader.ts
 *
 * Typed configuration loading, environment variable extraction, path resolution,
 * and credential lookup precedence.
 * Aligns strictly with PLAN_CONTEXT.md Section 7 & 8 and PLAN.md Section 12 & 13.
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { type Result, ok, fail, type ProviderType } from "@terrarium/contracts";
import {
  type AppEnvironment,
  type ConfigLoadOptions,
  type HumanApprovalMode,
  type PathsConfig,
  type PreferencesConfig,
  type ProviderConnectionConfig,
  type TerrariumConfig,
  type TerrariumConfigInput,
} from "./types.ts";
import {
  DEFAULT_BUDGET,
  DEFAULT_PATHS,
  DEFAULT_PREFERENCES,
  DEFAULT_PROVIDERS,
  TerrariumConfigImpl,
} from "./defaults.ts";
import { parseDotEnv } from "./env-parser.ts";
import { validateConfig, type ConfigValidationError } from "./validation.ts";

/**
 * Resolves a path against a base directory if it is not already absolute.
 */
function toAbsolutePath(baseDir: string, targetPath: string): string {
  if (isAbsolute(targetPath)) {
    return targetPath;
  }
  return resolve(baseDir, targetPath);
}

/**
 * Loads Terrarium configuration with strict precedence:
 * 1. Explicit programmatic overrides
 * 2. Environment variables (process.env or options.env)
 * 3. Local .env file
 * 4. Safe defaults
 */
export function loadConfig(
  options: ConfigLoadOptions = {}
): Result<TerrariumConfig, ConfigValidationError> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const envSource = options.env ?? process.env;

  // 1. Read .env file if present
  const dotEnvFile = options.dotEnvPath ? resolve(cwd, options.dotEnvPath) : resolve(cwd, ".env");
  let dotEnvVars: Record<string, string> = {};
  if (existsSync(dotEnvFile)) {
    try {
      const content = readFileSync(dotEnvFile, "utf-8");
      dotEnvVars = parseDotEnv(content);
    } catch {
      // Ignored: failure to read unreadable .env falls back to env vars
    }
  }

  // Precedence helper: override -> process.env -> dotEnv -> fallback
  function getVar(key: string): string | undefined {
    if (envSource[key] !== undefined && envSource[key] !== "") {
      return envSource[key];
    }
    if (dotEnvVars[key] !== undefined && dotEnvVars[key] !== "") {
      return dotEnvVars[key];
    }
    return undefined;
  }

  const overrides = options.overrides ?? {};

  // Environment resolution
  const environment: AppEnvironment =
    overrides.environment ??
    (getVar("TERRARIUM_ENV") as AppEnvironment) ??
    (getVar("NODE_ENV") as AppEnvironment) ??
    "development";

  const appName = overrides.appName ?? getVar("TERRARIUM_APP_NAME") ?? "TERRARIUM";
  const version = overrides.version ?? "0.1.0";
  const debug =
    overrides.debug ??
    (getVar("TERRARIUM_DEBUG") === "true" || getVar("DEBUG") === "1" || environment === "development");

  // Paths resolution
  const projectRoot = resolve(
    overrides.paths?.projectRoot ?? overrides.projectRoot ?? getVar("TERRARIUM_PROJECT_ROOT") ?? cwd
  );

  const rawDataDir =
    overrides.paths?.dataDir ?? overrides.dataDir ?? getVar("TERRARIUM_DATA_DIR") ?? DEFAULT_PATHS.dataDir;
  const dataDir = toAbsolutePath(projectRoot, rawDataDir);

  const rawLogDir =
    overrides.paths?.logDir ?? overrides.logDir ?? getVar("TERRARIUM_LOG_DIR") ?? DEFAULT_PATHS.logDir;
  const logDir = toAbsolutePath(projectRoot, rawLogDir);

  const rawReportsDir =
    overrides.paths?.reportsDir ?? getVar("TERRARIUM_REPORTS_DIR") ?? DEFAULT_PATHS.reportsDir;
  const reportsDir = toAbsolutePath(projectRoot, rawReportsDir);

  const rawDbPath =
    overrides.paths?.dbPath ?? getVar("TERRARIUM_DB_PATH") ?? `${dataDir}/terrarium.sqlite3`;
  const dbPath = toAbsolutePath(projectRoot, rawDbPath);

  const paths: PathsConfig = {
    projectRoot,
    dataDir,
    logDir,
    reportsDir,
    dbPath,
  };

  // Preferences resolution
  const defaultProvider: ProviderType =
    overrides.preferences?.defaultProvider ??
    (getVar("TERRARIUM_DEFAULT_PROVIDER") as ProviderType) ??
    DEFAULT_PREFERENCES.defaultProvider;

  const defaultModelTier =
    overrides.preferences?.defaultModelTier ??
    (getVar("TERRARIUM_DEFAULT_MODEL_TIER") as any) ??
    DEFAULT_PREFERENCES.defaultModelTier;

  const humanApprovalMode: HumanApprovalMode =
    overrides.preferences?.humanApprovalMode ??
    (getVar("TERRARIUM_APPROVAL_MODE") as HumanApprovalMode) ??
    DEFAULT_PREFERENCES.humanApprovalMode;

  const preferences: PreferencesConfig = {
    defaultProvider,
    defaultModelTier,
    humanApprovalMode,
  };

  // Budget resolution
  const maxTokensPerTurn =
    overrides.budget?.maxTokensPerTurn ??
    (getVar("TERRARIUM_MAX_TOKENS_PER_TURN") ? parseInt(getVar("TERRARIUM_MAX_TOKENS_PER_TURN")!, 10) : undefined) ??
    DEFAULT_BUDGET.maxTokensPerTurn;

  const maxDelegationDepth =
    overrides.budget?.maxDelegationDepth ??
    (getVar("TERRARIUM_MAX_DELEGATION_DEPTH") ? parseInt(getVar("TERRARIUM_MAX_DELEGATION_DEPTH")!, 10) : undefined) ??
    DEFAULT_BUDGET.maxDelegationDepth;

  const warningThresholdPercent =
    overrides.budget?.warningThresholdPercent ??
    (getVar("TERRARIUM_WARNING_THRESHOLD_PERCENT")
      ? parseFloat(getVar("TERRARIUM_WARNING_THRESHOLD_PERCENT")!)
      : undefined) ??
    DEFAULT_BUDGET.warningThresholdPercent;

  const defaultTaskBudgetUsd =
    overrides.budget?.defaultTaskBudgetUsd ??
    (getVar("TERRARIUM_DEFAULT_TASK_BUDGET_USD")
      ? parseFloat(getVar("TERRARIUM_DEFAULT_TASK_BUDGET_USD")!)
      : undefined) ??
    DEFAULT_BUDGET.defaultTaskBudgetUsd;

  const budget = {
    maxTokensPerTurn,
    maxDelegationDepth,
    warningThresholdPercent,
    defaultTaskBudgetUsd,
  };

  // Provider credentials resolution
  const providers: Record<ProviderType, ProviderConnectionConfig> = {
    anthropic: {
      ...DEFAULT_PROVIDERS.anthropic,
      apiKey:
        overrides.providers?.anthropic?.apiKey ??
        getVar("ANTHROPIC_API_KEY"),
      baseUrl:
        overrides.providers?.anthropic?.baseUrl ??
        getVar("ANTHROPIC_BASE_URL") ??
        DEFAULT_PROVIDERS.anthropic.baseUrl,
      enabled:
        overrides.providers?.anthropic?.enabled ??
        Boolean(overrides.providers?.anthropic?.apiKey || getVar("ANTHROPIC_API_KEY")),
    },
    openai: {
      ...DEFAULT_PROVIDERS.openai,
      apiKey:
        overrides.providers?.openai?.apiKey ??
        getVar("OPENAI_API_KEY"),
      baseUrl:
        overrides.providers?.openai?.baseUrl ??
        getVar("OPENAI_BASE_URL") ??
        DEFAULT_PROVIDERS.openai.baseUrl,
      organizationId:
        overrides.providers?.openai?.organizationId ??
        getVar("OPENAI_ORG_ID"),
      enabled:
        overrides.providers?.openai?.enabled ??
        Boolean(overrides.providers?.openai?.apiKey || getVar("OPENAI_API_KEY")),
    },
    gemini: {
      ...DEFAULT_PROVIDERS.gemini,
      apiKey:
        overrides.providers?.gemini?.apiKey ??
        getVar("GEMINI_API_KEY") ??
        getVar("GOOGLE_API_KEY"),
      baseUrl:
        overrides.providers?.gemini?.baseUrl ??
        getVar("GEMINI_BASE_URL") ??
        DEFAULT_PROVIDERS.gemini.baseUrl,
      enabled:
        overrides.providers?.gemini?.enabled ??
        Boolean(
          overrides.providers?.gemini?.apiKey ||
          getVar("GEMINI_API_KEY") ||
          getVar("GOOGLE_API_KEY")
        ),
    },
    ollama: {
      ...DEFAULT_PROVIDERS.ollama,
      baseUrl:
        overrides.providers?.ollama?.baseUrl ??
        getVar("OLLAMA_HOST") ??
        getVar("OLLAMA_BASE_URL") ??
        DEFAULT_PROVIDERS.ollama.baseUrl,
      enabled: overrides.providers?.ollama?.enabled ?? true,
    },
    custom: {
      ...DEFAULT_PROVIDERS.custom,
      apiKey: overrides.providers?.custom?.apiKey ?? getVar("CUSTOM_PROVIDER_API_KEY"),
      baseUrl: overrides.providers?.custom?.baseUrl ?? getVar("CUSTOM_PROVIDER_BASE_URL"),
      enabled: overrides.providers?.custom?.enabled ?? false,
    },
  };

  const configInstance = new TerrariumConfigImpl({
    environment,
    appName,
    version,
    debug,
    paths,
    preferences,
    budget,
    providers,
  });

  return validateConfig(configInstance);
}
