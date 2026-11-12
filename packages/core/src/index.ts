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
import { ApprovalManager } from "./approvals/index.ts";
import { createToolRegistry, DefaultToolRegistry } from "./tools/index.ts";
import { MemoryManager } from "./memory/index.ts";
import { ContextAssembler } from "./context/index.ts";
import { BudgetManager } from "./budget/index.ts";
import { ModelRouter } from "./routing/index.ts";
import { TelemetryManager } from "./observability/index.ts";
import { createEngineeringStudioService, EngineeringStudioService } from "./studio/index.ts";
import { createReportService, ReportService } from "./reports/index.ts";

export const CORE_PACKAGE_NAME = "@terrarium/core" as const;
export const CORE_VERSION = "0.1.0" as const;

export * from "./persistence/index.ts";
export * from "./registry/index.ts";
export * from "./intake/index.ts";
export * from "./orchestrator/index.ts";
export * from "./providers/index.ts";
export * from "./approvals/index.ts";
export * from "./tools/index.ts";
export * from "./memory/index.ts";
export * from "./context/index.ts";
export * from "./budget/index.ts";
export * from "./routing/index.ts";
export * from "./observability/index.ts";
export * from "./studio/index.ts";
export * from "./reports/index.ts";

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
  readonly tools: DefaultToolRegistry;
  readonly approvals: ApprovalManager;
  readonly memory: MemoryManager;
  readonly context: ContextAssembler;
  readonly budget: BudgetManager;
  readonly router: ModelRouter;
  readonly telemetry: TelemetryManager;
  readonly studio: EngineeringStudioService;
  readonly reports: ReportService;
  getState(): CoreEngineState;
  getPackageInfo(): TerrariumPackageInfo;
  shutdown(): Promise<Result<void, string>>;
}

export interface CreateCoreEngineOptions {
  readonly config?: TerrariumConfig;
  readonly enableDatabase?: boolean;
  readonly runtime?: MockAgentRuntime;
  readonly providers?: ProviderRegistry;
  readonly tools?: DefaultToolRegistry;
  readonly approvals?: ApprovalManager;
  readonly memory?: MemoryManager;
  readonly context?: ContextAssembler;
  readonly budget?: BudgetManager;
  readonly router?: ModelRouter;
  readonly telemetry?: TelemetryManager;
  readonly studio?: EngineeringStudioService;
  readonly reports?: ReportService;
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

  const approvals = !isDirectConfig && (optionsOrConfig as CreateCoreEngineOptions).approvals
    ? (optionsOrConfig as CreateCoreEngineOptions).approvals!
    : new ApprovalManager({
        repository: db?.approvals,
        eventRepository: db?.events,
      });

  const tools = !isDirectConfig && (optionsOrConfig as CreateCoreEngineOptions).tools
    ? (optionsOrConfig as CreateCoreEngineOptions).tools!
    : createToolRegistry({
        approvalManager: approvals,
        eventRepository: db?.events,
      });

  const memory = !isDirectConfig && (optionsOrConfig as CreateCoreEngineOptions).memory
    ? (optionsOrConfig as CreateCoreEngineOptions).memory!
    : new MemoryManager({
        repository: db?.memory,
      });

  const context = !isDirectConfig && (optionsOrConfig as CreateCoreEngineOptions).context
    ? (optionsOrConfig as CreateCoreEngineOptions).context!
    : new ContextAssembler(memory);

  const budget = !isDirectConfig && (optionsOrConfig as CreateCoreEngineOptions).budget
    ? (optionsOrConfig as CreateCoreEngineOptions).budget!
    : new BudgetManager({
        repository: db?.budgets,
        approvals,
      });

  const router = !isDirectConfig && (optionsOrConfig as CreateCoreEngineOptions).router
    ? (optionsOrConfig as CreateCoreEngineOptions).router!
    : new ModelRouter();

  const telemetry = !isDirectConfig && (optionsOrConfig as CreateCoreEngineOptions).telemetry
    ? (optionsOrConfig as CreateCoreEngineOptions).telemetry!
    : new TelemetryManager({
        eventRepository: db?.events,
        logRepository: db?.logs,
      });

  const studio = !isDirectConfig && (optionsOrConfig as CreateCoreEngineOptions).studio
    ? (optionsOrConfig as CreateCoreEngineOptions).studio!
    : createEngineeringStudioService({
        workspaceRoot: process.cwd(),
        approvalManager: approvals,
        repositories: db,
      });

  const reports = !isDirectConfig && (optionsOrConfig as CreateCoreEngineOptions).reports
    ? (optionsOrConfig as CreateCoreEngineOptions).reports!
    : createReportService({
        repository: db?.reports,
        taskRepository: db?.tasks,
        workspaceRoot: process.cwd(),
      });

  return {
    config,
    db,
    registry,
    intake,
    coordinator,
    providers,
    tools,
    approvals,
    memory,
    context,
    budget,
    router,
    telemetry,
    studio,
    reports,
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
