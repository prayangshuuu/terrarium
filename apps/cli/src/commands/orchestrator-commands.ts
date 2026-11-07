/**
 * @terrarium/cli - commands/orchestrator-commands.ts
 *
 * Command line handlers for bounded orchestration, demand-based selection,
 * live execution status display, and explainability auditing.
 * Aligns with PLAN.md Section 5.2, 5.3 & 14 and Prompt 8 requirements (A4 - CLI/TUI UX).
 */

import {
  type AgentDepartment,
  type OrchestrationEvent,
  type OrchestrationLimits,
  type OrchestrationResult,
  type Result,
  type TerrariumError,
  ok,
  fail,
} from "@terrarium/contracts";
import {
  type CoreEngine,
  formatExecutionSummary,
  formatSelectionExplainability,
} from "@terrarium/core";

export interface TaskExecuteCommandOptions {
  readonly department?: AgentDepartment;
  readonly budgetCapUsd?: number;
  readonly maxConcurrency?: number;
  readonly maxRetries?: number;
  readonly totalTimeoutMs?: number;
  readonly autoApproveGates?: boolean;
  readonly explainOnly?: boolean;
  readonly json?: boolean;
  readonly useColor?: boolean;
  readonly idempotencyKey?: string;
  readonly onEvent?: (event: OrchestrationEvent) => void;
}

/**
 * Executes a task from intake through bounded orchestration with live terminal reporting.
 */
export async function handleTaskExecute(
  engine: CoreEngine,
  prompt: string,
  options: TaskExecuteCommandOptions = {}
): Promise<Result<{ output: string; result: OrchestrationResult }, TerrariumError>> {
  // 1. Process Intake and generate inspectable plan
  const intakeRes = await engine.intake.processIntake({
    prompt,
    explicitDepartment: options.department,
    budgetCapUsd: options.budgetCapUsd,
  });

  if (!intakeRes.success) {
    return fail(intakeRes.error);
  }

  const { plan } = intakeRes.data;

  // 2. Prepare orchestration limits
  const limits: Partial<OrchestrationLimits> = {
    ...(options.budgetCapUsd !== undefined ? { budgetCapUsd: options.budgetCapUsd } : {}),
    ...(options.maxConcurrency !== undefined ? { maxConcurrency: options.maxConcurrency } : {}),
    ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
    ...(options.totalTimeoutMs !== undefined ? { totalTimeoutMs: options.totalTimeoutMs } : {}),
  };

  const liveEvents: OrchestrationEvent[] = [];
  const handleEvent = (event: OrchestrationEvent) => {
    liveEvents.push(event);
    if (options.onEvent) {
      options.onEvent(event);
    }
  };

  // 3. Execute approved plan under bounded coordinator
  const execRes = await engine.coordinator.executePlan({
    plan,
    limits,
    autoApproveGates: options.autoApproveGates ?? true,
    idempotencyKey: options.idempotencyKey,
    onEvent: handleEvent,
  });

  if (!execRes.success) {
    return fail(execRes.error);
  }

  const orchResult = execRes.data;

  // 4. Format output based on requested mode
  if (options.json) {
    return ok({
      output: JSON.stringify(orchResult, null, 2),
      result: orchResult,
    });
  }

  if (options.explainOnly) {
    const explainOutput = formatSelectionExplainability(orchResult, options.useColor ?? false);
    return ok({
      output: explainOutput,
      result: orchResult,
    });
  }

  const summary = formatExecutionSummary(orchResult, options.useColor ?? false);
  const audit = formatSelectionExplainability(orchResult, options.useColor ?? false);

  const fullOutput = `${summary}\n\n${"─".repeat(80)}\n\n${audit}`;
  return ok({
    output: fullOutput,
    result: orchResult,
  });
}
