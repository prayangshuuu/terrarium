/**
 * @terrarium/cli - tests/provider-cli.test.ts
 *
 * Tests for provider ecosystem CLI commands: list, info, test, and setup guide.
 * Aligns with Prompt 9 requirements (A5 - Provider setup UX).
 */

import { describe, expect, it } from "bun:test";
import { getDefaultConfig } from "@terrarium/config";
import {
  createCoreEngine,
  createProviderRegistry,
  MockModelAdapter,
} from "@terrarium/core";
import {
  handleProviderInfo,
  handleProviderList,
  handleProviderSetupGuide,
  handleProviderTest,
} from "../src/commands/provider-commands.ts";

describe("CLI Provider Commands Suite", () => {
  const config = getDefaultConfig();
  const registry = createProviderRegistry({ config });

  it("lists all supported providers in formatted table", async () => {
    const listRes = await handleProviderList(config, registry, { useColor: false });
    expect(listRes.success).toBe(true);
    if (listRes.success) {
      expect(listRes.data.output).toContain("Terrarium Model Provider Ecosystem");
      expect(listRes.data.output).toContain("openai");
      expect(listRes.data.output).toContain("anthropic");
      expect(listRes.data.output).toContain("ollama");
      expect(listRes.data.providers.length).toBe(5);
    }
  });

  it("outputs structured JSON when requested for list", async () => {
    const listRes = await handleProviderList(config, registry, { json: true });
    expect(listRes.success).toBe(true);
    if (listRes.success) {
      const parsed = JSON.parse(listRes.data.output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(5);
      expect(parsed[0].provider).toBeDefined();
    }
  });

  it("displays provider info card with models and capabilities", async () => {
    const infoRes = await handleProviderInfo("openai", config, registry, { useColor: false });
    expect(infoRes.success).toBe(true);
    if (infoRes.success) {
      expect(infoRes.data).toContain("Provider Card: OPENAI");
      expect(infoRes.data).toContain("Base URL:           https://api.openai.com/v1");
      expect(infoRes.data).toContain("Credential Status:");
      expect(infoRes.data).toContain("Adapter Capabilities:");
      expect(infoRes.data).toContain("gpt-4o");
    }
  });

  it("outputs structured JSON for provider info card", async () => {
    const infoRes = await handleProviderInfo("openai", config, registry, { json: true });
    expect(infoRes.success).toBe(true);
    if (infoRes.success) {
      const parsed = JSON.parse(infoRes.data);
      expect(parsed.provider).toBe("openai");
      expect(parsed.capabilities).toBeDefined();
      expect(parsed.models.length).toBeGreaterThan(0);
    }
  });

  it("runs provider health test via handleProviderTest", async () => {
    // Add custom mock adapter for reliable test reachability
    registry.registerAdapter(new MockModelAdapter("custom", {}, "Test Custom Adapter"));

    const testRes = await handleProviderTest("custom", config, registry);
    expect(testRes.success).toBe(true);
    if (testRes.success) {
      expect(testRes.data.isHealthy).toBe(true);
      expect(testRes.data.latencyMs).toBeGreaterThanOrEqual(0);
      expect(testRes.data.output).toContain("HEALTHY");
    }
  });

  it("renders setup guide instructions without leaking secrets", () => {
    const openaiGuide = handleProviderSetupGuide("openai");
    expect(openaiGuide).toContain("Configuring Provider: OPENAI");
    expect(openaiGuide).toContain("OPENAI_API_KEY");
    expect(openaiGuide).toContain("Security Reminder");

    const ollamaGuide = handleProviderSetupGuide("ollama");
    expect(ollamaGuide).toContain("Configuring Provider: OLLAMA");
    expect(ollamaGuide).toContain("http://localhost:11434");
  });
});
