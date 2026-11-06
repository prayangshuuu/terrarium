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
  ok,
  fail,
} from "@terrarium/contracts";
import {
  type TerrariumConfig,
  getDefaultConfig,
} from "@terrarium/config";

export const CORE_PACKAGE_NAME = "@terrarium/core" as const;
export const CORE_VERSION = "0.1.0" as const;

export interface CoreEngineState {
  readonly status: ExecutionStatus;
  readonly activeExecutions: number;
  readonly initializedAt: string;
}

export interface CoreEngine {
  readonly config: TerrariumConfig;
  getState(): CoreEngineState;
  getPackageInfo(): TerrariumPackageInfo;
  shutdown(): Promise<Result<void, string>>;
}

/**
 * Creates and initializes the core orchestration engine.
 */
export function createCoreEngine(
  config: TerrariumConfig = getDefaultConfig()
): CoreEngine {
  let status: ExecutionStatus = "idle";
  const initializedAt = new Date().toISOString();
  let activeExecutions = 0;

  return {
    config,
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
      return ok(undefined);
    },
  };
}
