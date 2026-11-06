import { describe, expect, it } from "bun:test";
import {
  CONFIG_PACKAGE_NAME,
  CONFIG_VERSION,
  getConfigPackageInfo,
  getDefaultConfig,
  isSensitiveKey,
  validateConfig,
} from "../src/index.ts";

describe("@terrarium/config package boundaries", () => {
  it("exports package metadata constants and info", () => {
    expect(CONFIG_PACKAGE_NAME).toBe("@terrarium/config");
    expect(CONFIG_VERSION).toBe("0.1.0");

    const info = getConfigPackageInfo();
    expect(info.name).toBe("@terrarium/config");
    expect(info.role).toBe("configuration_management");
  });

  it("produces standard default configuration", () => {
    const config = getDefaultConfig();
    expect(config.appName).toBe("TERRARIUM");
    expect(config.version).toBe(CONFIG_VERSION);
    expect(typeof config.environment).toBe("string");
    expect(config.debug).toBe(false);
  });

  it("applies configuration overrides properly", () => {
    const config = getDefaultConfig({
      environment: "test",
      debug: true,
      appName: "TerrariumTest",
    });
    expect(config.environment).toBe("test");
    expect(config.debug).toBe(true);
    expect(config.appName).toBe("TerrariumTest");
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

  it("validates configuration objects", () => {
    const valid = validateConfig({
      appName: "TERRARIUM",
      environment: "production",
      version: "0.1.0",
      debug: false,
      dataDir: "/tmp/data",
      logDir: "/tmp/logs",
    });
    expect(valid.success).toBe(true);

    const invalid = validateConfig({
      appName: "",
      environment: "invalid_env",
    });
    expect(invalid.success).toBe(false);
  });
});
