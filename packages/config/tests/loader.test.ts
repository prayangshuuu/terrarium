import { describe, expect, it } from "bun:test";
import { isAbsolute } from "node:path";
import {
  loadConfig,
  parseDotEnv,
  type TerrariumConfig,
} from "../src/index.ts";

describe("Configuration Loader & Credential Precedence", () => {
  describe("parseDotEnv parser", () => {
    it("parses diverse .env formats cleanly without external dependencies", () => {
      const rawEnv = `
# Comment line
TERRARIUM_ENV=staging
export APP_PORT=8080
QUOTED_DOUBLE="Hello\\nWorld"
QUOTED_SINGLE='Single quoted text # not a comment'
INLINE_COMMENT=active_value # this is ignored
EMPTY_VAL=
# Another comment
NUMERIC_KEY=42
`;
      const parsed = parseDotEnv(rawEnv);
      expect(parsed["TERRARIUM_ENV"]).toBe("staging");
      expect(parsed["APP_PORT"]).toBe("8080");
      expect(parsed["QUOTED_DOUBLE"]).toBe("Hello\nWorld");
      expect(parsed["QUOTED_SINGLE"]).toBe("Single quoted text # not a comment");
      expect(parsed["INLINE_COMMENT"]).toBe("active_value");
      expect(parsed["EMPTY_VAL"]).toBe("");
      expect(parsed["NUMERIC_KEY"]).toBe("42");
    });
  });

  describe("loadConfig standard resolution", () => {
    it("loads default configuration when no env or overrides are passed", () => {
      const res = loadConfig({ env: {} });
      expect(res.success).toBe(true);
      if (res.success) {
        const config = res.data;
        expect(config.appName).toBe("TERRARIUM");
        expect(config.environment).toBe("development");
        expect(isAbsolute(config.paths.projectRoot)).toBe(true);
        expect(isAbsolute(config.paths.dataDir)).toBe(true);
        expect(isAbsolute(config.paths.logDir)).toBe(true);
        expect(isAbsolute(config.paths.reportsDir)).toBe(true);
        expect(isAbsolute(config.paths.dbPath)).toBe(true);
      }
    });

    it("resolves relative paths to absolute paths against projectRoot", () => {
      const res = loadConfig({
        env: {
          TERRARIUM_PROJECT_ROOT: "/custom/project/root",
          TERRARIUM_DATA_DIR: "local-data",
          TERRARIUM_LOG_DIR: "local-logs",
        },
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const config = res.data;
        expect(config.paths.projectRoot).toBe("/custom/project/root");
        expect(config.paths.dataDir).toBe("/custom/project/root/local-data");
        expect(config.paths.logDir).toBe("/custom/project/root/local-logs");
      }
    });

    it("parses custom environment variables properly", () => {
      const res = loadConfig({
        env: {
          TERRARIUM_ENV: "production",
          TERRARIUM_APP_NAME: "TerrariumProd",
          TERRARIUM_DEFAULT_PROVIDER: "openai",
          TERRARIUM_DEFAULT_MODEL_TIER: "advanced",
          TERRARIUM_APPROVAL_MODE: "always",
          TERRARIUM_MAX_TOKENS_PER_TURN: "16384",
          TERRARIUM_MAX_DELEGATION_DEPTH: "5",
          TERRARIUM_WARNING_THRESHOLD_PERCENT: "75",
          TERRARIUM_DEFAULT_TASK_BUDGET_USD: "2.50",
          OPENAI_API_KEY: "sk-proj-testOpenAiKey1234567890abcdef",
        },
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const config = res.data;
        expect(config.environment).toBe("production");
        expect(config.appName).toBe("TerrariumProd");
        expect(config.preferences.defaultProvider).toBe("openai");
        expect(config.preferences.defaultModelTier).toBe("advanced");
        expect(config.preferences.humanApprovalMode).toBe("always");
        expect(config.budget.maxTokensPerTurn).toBe(16384);
        expect(config.budget.maxDelegationDepth).toBe(5);
        expect(config.budget.warningThresholdPercent).toBe(75);
        expect(config.budget.defaultTaskBudgetUsd).toBe(2.5);

        // Provider credential checks
        const openaiCfg = config.getProviderConfig("openai");
        expect(openaiCfg.enabled).toBe(true);
        expect(openaiCfg.apiKey).toBe("sk-proj-testOpenAiKey1234567890abcdef");

        const credStatus = config.getCredentialStatus("openai");
        expect(credStatus.isConfigured).toBe(true);
        expect(credStatus.maskedKey).toContain("...");
      }
    });

    it("maintains credential lookup precedence: override > env", () => {
      const res = loadConfig({
        env: {
          ANTHROPIC_API_KEY: "sk-ant-from-env-1234567890",
        },
        overrides: {
          providers: {
            anthropic: {
              apiKey: "sk-ant-from-override-9876543210",
            },
          },
        },
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const cfg = res.data.getProviderConfig("anthropic");
        expect(cfg.apiKey).toBe("sk-ant-from-override-9876543210");
      }
    });

    it("handles unconfigured providers gracefully without throwing errors", () => {
      const res = loadConfig({ env: {} });
      expect(res.success).toBe(true);
      if (res.success) {
        const anthropicCfg = res.data.getProviderConfig("anthropic");
        expect(anthropicCfg.enabled).toBe(false);
        expect(anthropicCfg.apiKey).toBeUndefined();

        const status = res.data.getCredentialStatus("anthropic");
        expect(status.isConfigured).toBe(false);
        expect(status.maskedKey).toBeUndefined();
      }
    });

    it("redacts credentials when toJSON(true) is invoked", () => {
      const res = loadConfig({
        env: {
          ANTHROPIC_API_KEY: "sk-ant-api03-abcdef1234567890xyz",
        },
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const json = res.data.toJSON(true);
        const providers = json.providers as Record<string, any>;
        expect(providers.anthropic.apiKey).toContain("...");
        expect(providers.anthropic.apiKey).not.toBe("sk-ant-api03-abcdef1234567890xyz");
      }
    });
  });
});
