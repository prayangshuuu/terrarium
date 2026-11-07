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
    return registry;
  }

  const openaiCfg = options.config?.getProviderConfig("openai");
  registry.registerAdapter(
    new OpenAIProviderAdapter({
      provider: "openai",
      apiKey: openaiCfg?.apiKey,
      baseUrl: openaiCfg?.baseUrl,
      organizationId: openaiCfg?.organizationId,
      allowExternalCalls: false, // Protected by default
    })
  );

  // Always register mock adapter for fallback or test execution
  registry.registerAdapter(new MockModelAdapter("custom", {}, "Default Mock Adapter"));

  return registry;
}
