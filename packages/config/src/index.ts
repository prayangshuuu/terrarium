/**
 * @terrarium/config
 *
 * Configuration boundaries, defaults, environment resolution, and secret protection utilities.
 * Depends on @terrarium/contracts.
 */

import {
  type TerrariumPackageInfo,
  type Result,
  ok,
  fail,
} from "@terrarium/contracts";

export const CONFIG_PACKAGE_NAME = "@terrarium/config" as const;
export const CONFIG_VERSION = "0.1.0" as const;

export type AppEnvironment = "development" | "test" | "production" | "staging";

export interface TerrariumConfig {
  readonly environment: AppEnvironment;
  readonly appName: string;
  readonly version: string;
  readonly debug: boolean;
  readonly dataDir: string;
  readonly logDir: string;
}

const SENSITIVE_KEY_PATTERNS = [
  /key/i,
  /secret/i,
  /token/i,
  /password/i,
  /credential/i,
  /auth/i,
  /bearer/i,
];

/**
 * Checks whether an environment or configuration key represents sensitive data.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Returns default configuration options with optional overrides.
 */
export function getDefaultConfig(
  overrides: Partial<TerrariumConfig> = {}
): TerrariumConfig {
  const env: AppEnvironment =
    (process.env["NODE_ENV"] as AppEnvironment) || "development";

  return {
    environment: overrides.environment ?? env,
    appName: overrides.appName ?? "TERRARIUM",
    version: overrides.version ?? CONFIG_VERSION,
    debug: overrides.debug ?? false,
    dataDir: overrides.dataDir ?? ".terrarium/data",
    logDir: overrides.logDir ?? ".terrarium/logs",
  };
}

/**
 * Validates a basic configuration object.
 */
export function validateConfig(
  config: unknown
): Result<TerrariumConfig, string> {
  if (!config || typeof config !== "object") {
    return fail("Configuration must be a non-null object");
  }

  const c = config as Record<string, unknown>;
  if (typeof c["appName"] !== "string" || !c["appName"]) {
    return fail("Invalid configuration: missing or empty appName");
  }

  const validEnvs: AppEnvironment[] = [
    "development",
    "test",
    "production",
    "staging",
  ];
  if (
    typeof c["environment"] !== "string" ||
    !validEnvs.includes(c["environment"] as AppEnvironment)
  ) {
    return fail(`Invalid environment: ${String(c["environment"])}`);
  }

  return ok(config as TerrariumConfig);
}

export function getConfigPackageInfo(): TerrariumPackageInfo {
  return {
    name: CONFIG_PACKAGE_NAME,
    version: CONFIG_VERSION,
    role: "configuration_management",
  };
}
