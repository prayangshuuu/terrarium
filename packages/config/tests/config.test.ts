import { describe, expect, it } from "bun:test";
import {
  CONFIG_PACKAGE_NAME,
  CONFIG_VERSION,
  ConfigValidationError,
  getConfigPackageInfo,
  getDefaultConfig,
  isSensitiveKey,
  validateConfig,
} from "../src/index.ts";

describe("@terrarium/config package boundaries & defaults", () => {
  it("exports package metadata constants and info", () => {
    expect(CONFIG_PACKAGE_NAME).toBe("@terrarium/config");
    expect(CONFIG_VERSION).toBe("0.1.0");

    const info = getConfigPackageInfo();
    expect(info.name).toBe("@terrarium/config");
    expect(info.role).toBe("configuration_management");
  });

  it("produces standard default configuration with separated subsystems", () => {
    const config = getDefaultConfig();
    expect(config.appName).toBe("TERRARIUM");
    expect(config.version).toBe(CONFIG_VERSION);
    expect(typeof config.environment).toBe("string");
    expect(config.debug).toBe(false);

    // Verify subsystem separation
    expect(config.paths).toBeDefined();
    expect(config.paths.dataDir).toBe(".terrarium/data");
    expect(config.paths.logDir).toBe(".terrarium/logs");
    expect(config.paths.reportsDir).toBe("docs/reports");
    expect(config.paths.dbPath).toBe(".terrarium/data/terrarium.sqlite3");

    expect(config.preferences).toBeDefined();
    expect(config.preferences.defaultProvider).toBe("anthropic");
    expect(config.preferences.defaultModelTier).toBe("standard");
    expect(config.preferences.humanApprovalMode).toBe("consequential_only");

    expect(config.budget).toBeDefined();
    expect(config.budget.maxTokensPerTurn).toBe(8192);
    expect(config.budget.maxDelegationDepth).toBe(3);
    expect(config.budget.warningThresholdPercent).toBe(80);
    expect(config.budget.defaultTaskBudgetUsd).toBe(0.5);

    expect(config.providers).toBeDefined();
    expect(config.providers.ollama.enabled).toBe(true);
    expect(config.providers.ollama.baseUrl).toBe("http://localhost:11434");
  });

  it("applies configuration overrides properly", () => {
    const config = getDefaultConfig({
      environment: "test",
      debug: true,
      appName: "TerrariumTest",
      preferences: {
        defaultProvider: "ollama",
        defaultModelTier: "fast",
        humanApprovalMode: "always",
      },
      budget: {
        maxTokensPerTurn: 4096,
        maxDelegationDepth: 1,
        warningThresholdPercent: 90,
        defaultTaskBudgetUsd: 1.0,
      },
    });

    expect(config.environment).toBe("test");
    expect(config.debug).toBe(true);
    expect(config.appName).toBe("TerrariumTest");
    expect(config.preferences.defaultProvider).toBe("ollama");
    expect(config.preferences.defaultModelTier).toBe("fast");
    expect(config.preferences.humanApprovalMode).toBe("always");
    expect(config.budget.maxTokensPerTurn).toBe(4096);
  });

  it("validates configuration objects and returns actionable errors", () => {
    const validConfig = getDefaultConfig();
    const validRes = validateConfig(validConfig);
    expect(validRes.success).toBe(true);

    const invalidRes = validateConfig({
      appName: "",
      environment: "invalid_env",
      paths: {
        projectRoot: "",
        dataDir: "",
        logDir: "",
        reportsDir: "",
        dbPath: "",
      },
      preferences: {
        defaultProvider: "unsupported_provider",
        defaultModelTier: "super_fast",
        humanApprovalMode: "sometimes",
      },
      budget: {
        maxTokensPerTurn: -10,
        maxDelegationDepth: 50,
        warningThresholdPercent: 200,
        defaultTaskBudgetUsd: -5,
      },
    });

    expect(invalidRes.success).toBe(false);
    if (!invalidRes.success) {
      expect(invalidRes.error instanceof ConfigValidationError).toBe(true);
      expect(invalidRes.error.issues.length).toBeGreaterThan(5);
      const formatted = invalidRes.error.formatActionableMessage();
      expect(formatted).toContain("Issues detected:");
      expect(formatted).toContain("To remediate:");
    }
  });

  it("identifies sensitive keys accurately", () => {
    expect(isSensitiveKey("OPENAI_API_KEY")).toBe(true);
    expect(isSensitiveKey("GITHUB_TOKEN")).toBe(true);
    expect(isSensitiveKey("DB_PASSWORD")).toBe(true);
    expect(isSensitiveKey("AUTH_SECRET")).toBe(true);
    expect(isSensitiveKey("BEARER_AUTH")).toBe(true);
    expect(isSensitiveKey("APP_NAME")).toBe(false);
    expect(isSensitiveKey("LOG_LEVEL")).toBe(false);
  });
});
