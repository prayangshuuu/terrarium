/**
 * @terrarium/core - coding-agents/coding-agent-registry.ts
 *
 * Registry and discovery service for Universal Coding Agent Adapters.
 * Discovers host tools, inspects versions, maintains compatibility matrices,
 * and provides runtime adapter resolution.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 */

import {
  type CodingAgentAdapter,
  type CodingAgentCompatibility,
  type CodingAgentMetadata,
  type CodingAgentType,
  type Result,
  ok,
  fail,
  NotFoundError,
} from "@terrarium/contracts";
import { ClaudeCodeAdapter } from "./claude-code-adapter.ts";
import { CodexCliAdapter } from "./codex-cli-adapter.ts";
import { OpenCodeAdapter } from "./opencode-adapter.ts";
import { GeminiCliAdapter } from "./gemini-cli-adapter.ts";
import { CursorAdapter } from "./cursor-adapter.ts";
import { AiderAdapter } from "./aider-adapter.ts";

export interface CodingAgentCompatibilityEntry {
  readonly id: CodingAgentType;
  readonly name: string;
  readonly category: string;
  readonly executableName: string;
  readonly isInstalled: boolean;
  readonly detectedVersion?: string;
  readonly compatibility: CodingAgentCompatibility;
  readonly supportedModes: readonly string[];
  readonly limitations: readonly string[];
}

export class CodingAgentRegistry {
  private readonly adapters = new Map<CodingAgentType, CodingAgentAdapter>();

  constructor() {
    // Register canonical adapters
    this.registerAdapter(new ClaudeCodeAdapter());
    this.registerAdapter(new CodexCliAdapter());
    this.registerAdapter(new OpenCodeAdapter());
    this.registerAdapter(new GeminiCliAdapter());
    this.registerAdapter(new CursorAdapter());
    this.registerAdapter(new AiderAdapter());
  }

  registerAdapter(adapter: CodingAgentAdapter): void {
    this.adapters.set(adapter.metadata.id, adapter);
  }

  getAdapter(id: CodingAgentType): CodingAgentAdapter | undefined {
    return this.adapters.get(id);
  }

  listAdapters(): readonly CodingAgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Asynchronously discovers installed executables and updates adapter metadata.
   */
  async discoverHostTools(): Promise<readonly CodingAgentMetadata[]> {
    const results: CodingAgentMetadata[] = [];

    for (const adapter of this.adapters.values()) {
      const isDetected = await adapter.detect();
      const updatedMeta: CodingAgentMetadata = {
        ...adapter.metadata,
        isInstalled: isDetected,
        compatibility: isDetected ? adapter.metadata.compatibility : "unavailable",
      };
      results.push(updatedMeta);
    }

    return results;
  }

  /**
   * Generates the honest coding-agent compatibility matrix.
   */
  getCompatibilityMatrix(): readonly CodingAgentCompatibilityEntry[] {
    return Array.from(this.adapters.values()).map((adapter) => {
      const meta = adapter.metadata;
      return {
        id: meta.id,
        name: meta.name,
        category: meta.category,
        executableName: meta.executableName,
        isInstalled: meta.isInstalled,
        detectedVersion: meta.detectedVersion,
        compatibility: meta.compatibility,
        supportedModes: meta.supportedModes,
        limitations: meta.limitations,
      };
    });
  }
}

export function createCodingAgentRegistry(): CodingAgentRegistry {
  return new CodingAgentRegistry();
}
