/**
 * @terrarium/core - tools/index.ts
 */

export * from "./security-enforcer.ts";
export * from "./tool-registry.ts";
export * from "./builtin/index.ts";

import { DefaultToolRegistry, type ToolRegistryOptions } from "./tool-registry.ts";
import { registerBuiltinTools } from "./builtin/index.ts";

export interface CreateToolRegistryOptions extends ToolRegistryOptions {
  readonly skipBuiltinRegistration?: boolean;
}

export function createToolRegistry(options: CreateToolRegistryOptions = {}): DefaultToolRegistry {
  const registry = new DefaultToolRegistry(options);
  if (!options.skipBuiltinRegistration) {
    registerBuiltinTools(registry);
  }
  return registry;
}
