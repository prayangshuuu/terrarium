/**
 * @terrarium/core - providers/registry.ts
 *
 * Provider adapter registry managing active Model API adapters and Coding-Agent CLI integrations.
 * Aligns with PLAN.md Section 10.4 & Section 12.
 */

import {
  type CodingAgentCliAdapter,
  type ModelProviderAdapter,
  type ProviderType,
} from "@terrarium/contracts";
import type { TerrariumConfig } from "@terrarium/config";
import { MockModelAdapter } from "./mock-adapter.ts";
import { OpenAIProviderAdapter } from "./openai-adapter.ts";
import { AnthropicProviderAdapter } from "./anthropic-adapter.ts";
import { OllamaProviderAdapter } from "./ollama-adapter.ts";
import { GeminiProviderAdapter } from "./gemini-adapter.ts";
import { ClaudeCodeCliAdapter } from "./claude-code-cli-adapter.ts";

export interface ProviderRegistry {
  registerAdapter(adapter: ModelProviderAdapter): void;
  getAdapter(provider: ProviderType): ModelProviderAdapter | undefined;
  listAdapters(): readonly ModelProviderAdapter[];
  hasAdapter(provider: ProviderType): boolean;

  registerCliAdapter(adapter: CodingAgentCliAdapter): void;
  getCliAdapter(id: string): CodingAgentCliAdapter | undefined;
  listCliAdapters(): readonly CodingAgentCliAdapter[];
}

export class DefaultProviderRegistry implements ProviderRegistry {
  private readonly adapters = new Map<ProviderType, ModelProviderAdapter>();
  private readonly cliAdapters = new Map<string, CodingAgentCliAdapter>();

  registerAdapter(adapter: ModelProviderAdapter): void {
    this.adapters.set(adapter.providerType, adapter);
  }

  getAdapter(provider: ProviderType): ModelProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  listAdapters(): readonly ModelProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  hasAdapter(provider: ProviderType): boolean {
    return this.adapters.has(provider);
  }

  registerCliAdapter(adapter: CodingAgentCliAdapter): void {
    this.cliAdapters.set(adapter.id, adapter);
  }

  getCliAdapter(id: string): CodingAgentCliAdapter | undefined {
    return this.cliAdapters.get(id);
  }

  listCliAdapters(): readonly CodingAgentCliAdapter[] {
    return Array.from(this.cliAdapters.values());
  }
}

export interface CreateProviderRegistryOptions {
  readonly config?: TerrariumConfig;
  readonly defaultMock?: boolean;
}

/**
 * Creates and initializes the provider adapter registry.
 */
export function createProviderRegistry(
  options: CreateProviderRegistryOptions = {}
): ProviderRegistry {
  const registry = new DefaultProviderRegistry();

  if (options.defaultMock) {
    registry.registerAdapter(new MockModelAdapter("custom", {}, "Default Mock Model Adapter"));
    registry.registerAdapter(new MockModelAdapter("openai", {}, "Mock OpenAI Adapter"));
    registry.registerAdapter(new MockModelAdapter("anthropic", {}, "Mock Anthropic Adapter"));
    registry.registerAdapter(new MockModelAdapter("ollama", {}, "Mock Ollama Adapter"));
    registry.registerAdapter(new MockModelAdapter("gemini", {}, "Mock Gemini Adapter"));
    registry.registerCliAdapter(new ClaudeCodeCliAdapter());
    return registry;
  }

  const getCfg = (provider: any) => {
    if (typeof options.config?.getProviderConfig === "function") {
      return options.config.getProviderConfig(provider);
    }
    return (options.config as any)?.providers?.[provider];
  };

  // 1. Anthropic Provider Adapter (Rank 1)
  const anthropicCfg = getCfg("anthropic");
  registry.registerAdapter(
    new AnthropicProviderAdapter({
      provider: "anthropic",
      apiKey: anthropicCfg?.apiKey,
      baseUrl: anthropicCfg?.baseUrl,
      allowExternalCalls: false, // Explicit opt-in required
    })
  );

  // 2. Ollama Local Offline Provider Adapter (Rank 2)
  const ollamaCfg = getCfg("ollama");
  registry.registerAdapter(
    new OllamaProviderAdapter({
      provider: "ollama",
      baseUrl: ollamaCfg?.baseUrl ?? "http://localhost:11434",
    })
  );

  // 3. OpenAI Provider Adapter (Rank 3)
  const openaiCfg = getCfg("openai");
  registry.registerAdapter(
    new OpenAIProviderAdapter({
      provider: "openai",
      apiKey: openaiCfg?.apiKey,
      baseUrl: openaiCfg?.baseUrl,
      organizationId: openaiCfg?.organizationId,
      allowExternalCalls: false, // Explicit opt-in required
    })
  );

  // 4. Google Gemini Provider Adapter (Rank 4)
  const geminiCfg = getCfg("gemini");
  registry.registerAdapter(
    new GeminiProviderAdapter({
      provider: "gemini",
      apiKey: geminiCfg?.apiKey,
      baseUrl: geminiCfg?.baseUrl,
      allowExternalCalls: false, // Explicit opt-in required
    })
  );

  // 5. Claude Code CLI Adapter (Rank 5)
  registry.registerCliAdapter(new ClaudeCodeCliAdapter());

  // Always register mock adapter for fallback or test execution
  registry.registerAdapter(new MockModelAdapter("custom", {}, "Default Mock Adapter"));

  return registry;
}
