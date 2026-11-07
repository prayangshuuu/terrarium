/**
 * @terrarium/core
 *
 * Core multi-agent orchestration runtime, execution coordination, and engine abstractions.
 * Decoupled from OpenTUI and external provider SDKs.
 * Depends on @terrarium/contracts and @terrarium/config.
 */

import {
  type ExecutionStatus,
  type TerrariumPackageInfo,
  type Result,
  type AgentRegistry,
  ok,
  fail,
} from "@terrarium/contracts";
import {
  type TerrariumConfig,
  getDefaultConfig,
} from "@terrarium/config";
import { createSqliteDatabase, SqliteDatabase } from "./persistence/index.ts";
import { createAgentRegistry } from "./registry/index.ts";
import { createTaskIntakeService, TaskIntakeService } from "./intake/index.ts";
import { createBoundedCoordinator, BoundedCoordinator, MockAgentRuntime } from "./orchestrator/index.ts";
import { createProviderRegistry, type ProviderRegistry } from "./providers/index.ts";

export const CORE_PACKAGE_NAME = "@terrarium/core" as const;
export const CORE_VERSION = "0.1.0" as const;

export * from "./persistence/index.ts";
export * from "./registry/index.ts";
export * from "./intake/index.ts";
export * from "./orchestrator/index.ts";
export * from "./providers/index.ts";

export interface CoreEngineState {
  readonly status: ExecutionStatus;
  readonly activeExecutions: number;
  readonly initializedAt: string;
}

export interface CoreEngine {
  readonly config: TerrariumConfig;
  readonly db?: SqliteDatabase;
  readonly registry: AgentRegistry;
  readonly intake: TaskIntakeService;
  readonly coordinator: BoundedCoordinator;
  readonly providers: ProviderRegistry;
  getState(): CoreEngineState;
  getPackageInfo(): TerrariumPackageInfo;
  shutdown(): Promise<Result<void, string>>;
}

export interface CreateCoreEngineOptions {
  readonly config?: TerrariumConfig;
  readonly enableDatabase?: boolean;
  readonly runtime?: MockAgentRuntime;
  readonly providers?: ProviderRegistry;
}

/**
 * Creates and initializes the core orchestration engine.
 */
export function createCoreEngine(
  optionsOrConfig: TerrariumConfig | CreateCoreEngineOptions = getDefaultConfig()
): CoreEngine {
  const isDirectConfig = "appName" in optionsOrConfig && "paths" in optionsOrConfig;
  const config = isDirectConfig ? (optionsOrConfig as TerrariumConfig) : (optionsOrConfig.config ?? getDefaultConfig());
  const enableDb = isDirectConfig ? false : (optionsOrConfig.enableDatabase ?? false);

  let status: ExecutionStatus = "idle";
  const initializedAt = new Date().toISOString();
  let activeExecutions = 0;

  const db = enableDb ? createSqliteDatabase(config.paths.dbPath) : undefined;
  const registry = createAgentRegistry({
    repository: db ? db.agentProfiles : undefined,
  });
  const intake = createTaskIntakeService({
    registry,
    repositories: db,
  });
  const coordinator = createBoundedCoordinator({
    registry,
    repositories: db,
    runtime: !isDirectConfig ? (optionsOrConfig as CreateCoreEngineOptions).runtime : undefined,
  });
  const providers = !isDirectConfig && (optionsOrConfig as CreateCoreEngineOptions).providers
    ? (optionsOrConfig as CreateCoreEngineOptions).providers!
    : createProviderRegistry({ config });

  return {
    config,
    db,
    registry,
    intake,
    coordinator,
    providers,
    getState(): CoreEngineState {
      return {
        status,
        activeExecutions,
        initializedAt,
      };
    },
    getPackageInfo(): TerrariumPackageInfo {
      return {
        name: CORE_PACKAGE_NAME,
        version: CORE_VERSION,
        role: "orchestration_engine",
      };
    },
    async shutdown(): Promise<Result<void, string>> {
      if (status === "cancelled") {
        return fail("Engine is already shut down");
      }
      status = "cancelled";
      activeExecutions = 0;
      if (db) {
        db.close();
      }
      return ok(undefined);
    },
  };
}
