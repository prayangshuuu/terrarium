/**
 * @terrarium/cli - commands/approval-commands.ts
 *
 * Command line handlers for inspecting, approving, rejecting, and cancelling
 * consequential action authorization requests.
 * Aligns strictly with PLAN.md Section 16 & 17 and Prompt 10 instructions (A4 & A5).
 */

import {
  type ApprovalQueryOptions,
  type ApprovalRequest,
  type ApprovalStatus,
  type Result,
  type TerrariumError,
  type ToolRiskLevel,
  APPROVAL_STATUS_UI,
  ok,
  fail,
  NotFoundError,
} from "@terrarium/contracts";
import type { ApprovalManager } from "@terrarium/core";
import { formatApprovalCard, formatRiskBadge } from "./risk-communicator.ts";

export interface ApprovalCommandOptions {
  readonly json?: boolean;
  readonly useColor?: boolean;
  readonly status?: ApprovalStatus;
  readonly taskId?: string;
  readonly reason?: string;
  readonly userId?: string;
}

/**
 * Lists approval requests with status indicators, risk severity, and action types.
 */
export async function handleApprovalList(
  approvalManager: ApprovalManager,
  options: ApprovalCommandOptions = {}
): Promise<Result<{ output: string; approvals: readonly ApprovalRequest[] }, TerrariumError>> {
  const query: {
    status?: ApprovalStatus;
    taskId?: string;
  } = {};
  if (options.status) query.status = options.status;
  if (options.taskId) query.taskId = options.taskId;

  const res = await approvalManager.list(query);
  if (!res.success) return fail(res.error);

  const approvals = res.data;

  if (options.json) {
    return ok({
      output: JSON.stringify(approvals, null, 2),
      approvals,
    });
  }

  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const reset = useColor ? "\x1b[0m" : "";
  const dim = useColor ? "\x1b[2m" : "";
  const yellow = useColor ? "\x1b[33m" : "";
  const green = useColor ? "\x1b[32m" : "";
  const red = useColor ? "\x1b[31m" : "";

  let table = `${bold}Terrarium Consequential Action Approvals (${approvals.length})${reset}\n`;
  table += `${dim}Approval ID             Status       Risk         Action Type          Requester      Requested At${reset}\n`;
  table += `${dim}───────────────────────────────────────────────────────────────────────────────────────────────────${reset}\n`;

  if (approvals.length === 0) {
    table += `${dim}No matching approvals found.${reset}\n`;
    return ok({ output: table, approvals });
  }

  for (const a of approvals) {
    const idPad = a.id.padEnd(23);
    const statusMeta = APPROVAL_STATUS_UI[a.status];
    const statusColor =
      a.status === "approved"
        ? green
        : a.status === "rejected"
        ? red
        : a.status === "pending"
        ? yellow
        : dim;
    const statText = `${statusColor}${statusMeta.glyph} ${statusMeta.label}${reset}`;
    const statPad = statText.padEnd(useColor ? 23 : 12);
    const riskBadge = formatRiskBadge((a.riskLevel as ToolRiskLevel) ?? "high", useColor);
    const riskPad = riskBadge.padEnd(useColor ? 21 : 12);
    const actPad = a.actionType.padEnd(20);
    const reqPad = a.requestedByAgentId.padEnd(14);
    const time = a.requestedAt.substring(0, 19).replace("T", " ");

    table += `${idPad} ${statPad} ${riskPad} ${actPad} ${reqPad} ${time}\n`;
  }

  return ok({
    output: table,
    approvals,
  });
}

/**
 * Displays full inspectable details and consequence analysis for a specific approval.
 */
export async function handleApprovalShow(
  approvalId: string,
  approvalManager: ApprovalManager,
  options: ApprovalCommandOptions = {}
): Promise<Result<string, TerrariumError>> {
  const res = await approvalManager.get(approvalId);
  if (!res.success) return fail(res.error);
  if (!res.data) return fail(new NotFoundError("ApprovalRequest", approvalId));

  const approval = res.data;

  if (options.json) {
    return ok(JSON.stringify(approval, null, 2));
  }

  const card = formatApprovalCard(approval, options.useColor ?? false);
  return ok(card);
}

/**
 * Executes a human decision (approve, reject, or cancel) on a pending approval.
 */
export async function handleApprovalDecision(
  approvalId: string,
  decision: "approve" | "reject" | "cancel",
  approvalManager: ApprovalManager,
  options: ApprovalCommandOptions = {}
): Promise<Result<{ output: string; approval: ApprovalRequest }, TerrariumError>> {
  const userId = options.userId ?? "cli-user";
  const reason = options.reason;

  let res: Result<ApprovalRequest, TerrariumError>;

  if (decision === "approve") {
    res = await approvalManager.approve(approvalId, userId, reason);
  } else if (decision === "reject") {
    res = await approvalManager.reject(approvalId, userId, reason);
  } else {
    res = await approvalManager.cancel(approvalId, userId, reason);
  }

  if (!res.success) return fail(res.error);

  const approval = res.data;

  if (options.json) {
    return ok({
      output: JSON.stringify(approval, null, 2),
      approval,
    });
  }

  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const reset = useColor ? "\x1b[0m" : "";
  const green = useColor ? "\x1b[32m" : "";
  const red = useColor ? "\x1b[31m" : "";

  const verb = decision === "approve" ? `${green}APPROVED${reset}` : decision === "reject" ? `${red}REJECTED${reset}` : "CANCELLED";
  let output = `${bold}Approval Decision Recorded:${reset} ${approval.id} is now ${verb}\n`;
  output += `Reviewed By: ${approval.reviewedByUserId ?? userId}\n`;
  if (approval.decisionReason) {
    output += `Reason:      ${approval.decisionReason}\n`;
  }
  output += `Decided At:  ${approval.decidedAt ?? new Date().toISOString()}\n`;

  return ok({
    output,
    approval,
  });
}
