/**
 * @terrarium/cli - commands/task-commands.ts
 *
 * Command line handlers for task intake, classification, and inspectable plan generation.
 * Aligns with PLAN.md Section 5.1 & 14 and Prompt 7 requirements (A4 - task creation UX).
 */

import {
  type AgentDepartment,
  type Result,
  type TerrariumError,
  ok,
  fail,
} from "@terrarium/contracts";
import {
  type CoreEngine,
  formatPlanMarkdown,
  formatPlanTerminal,
} from "@terrarium/core";

export interface TaskPlanCommandOptions {
  readonly department?: AgentDepartment;
  readonly budgetCapUsd?: number;
  readonly json?: boolean;
  readonly markdown?: boolean;
  readonly useColor?: boolean;
  readonly answers?: Readonly<Record<string, string>>;
  readonly saveDraft?: boolean;
}

/**
 * Handles task intake and plan inspection for terminal output.
 */
export async function handleTaskPlan(
  engine: CoreEngine,
  prompt: string,
  options: TaskPlanCommandOptions = {}
): Promise<Result<string, TerrariumError>> {
  const intakeRes = await engine.intake.processIntake(
    {
      prompt,
      explicitDepartment: options.department,
      budgetCapUsd: options.budgetCapUsd,
      clarificationAnswers: options.answers,
    },
    {
      persistDraftTask: options.saveDraft,
      persistPlan: options.saveDraft,
    }
  );

  if (!intakeRes.success) {
    return fail(intakeRes.error);
  }

  const { plan, draftTask } = intakeRes.data;

  // JSON output format
  if (options.json) {
    return ok(JSON.stringify(plan, null, 2));
  }

  // Markdown output format
  if (options.markdown) {
    return ok(formatPlanMarkdown(plan));
  }

  // Terminal formatted display
  let output = formatPlanTerminal(plan, { useColor: options.useColor ?? true });

  if (draftTask) {
    output += `\nDraft Task persisted to database with ID: ${draftTask.id} (Status: ${draftTask.status})`;
  }

  return ok(output);
}

/**
 * Handles quick task intake with high-level summary and next-action guidance.
 */
export async function handleTaskIntake(
  engine: CoreEngine,
  prompt: string,
  options: TaskPlanCommandOptions = {}
): Promise<Result<string, TerrariumError>> {
  const planRes = await handleTaskPlan(engine, prompt, options);
  if (!planRes.success) {
    return fail(planRes.error);
  }

  return ok(planRes.data);
}
