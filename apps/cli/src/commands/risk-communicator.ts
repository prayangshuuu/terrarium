/**
 * @terrarium/cli - commands/risk-communicator.ts
 *
 * Information architecture, visual severity indicators, consequence explanation,
 * and approval card renderers for CLI and Studio compatibility.
 * Aligns strictly with PLAN.md Section 16 & 17 (A5 - Risk Communication).
 */

import {
  type ApprovalRequest,
  type ToolDefinition,
  type ToolRiskLevel,
  TOOL_RISK_UI,
  APPROVAL_STATUS_UI,
} from "@terrarium/contracts";

export interface ConsequenceExplanation {
  readonly title: string;
  readonly severity: "info" | "warning" | "danger" | "critical";
  readonly summary: string;
  readonly details: readonly string[];
}

/**
 * Returns a styled terminal badge for the given ToolRiskLevel.
 */
export function formatRiskBadge(riskLevel: ToolRiskLevel, useColor = false): string {
  const meta = TOOL_RISK_UI[riskLevel];
  if (!useColor) {
    return meta.badge;
  }

  const colorCodes: Record<string, string> = {
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m\x1b[1m",
  };
  const color = colorCodes[meta.color] ?? "\x1b[0m";
  const reset = "\x1b[0m";
  return `${color}${meta.badge}${reset}`;
}

/**
 * Generates a human-understandable consequence analysis for an approval request or tool.
 */
export function explainConsequences(
  actionType: string,
  payload?: Record<string, unknown>
): ConsequenceExplanation {
  switch (actionType) {
    case "file_delete": {
      const path = String(payload?.path ?? "unknown file");
      return {
        title: "Permanent File Deletion",
        severity: "critical",
        summary: `This operation will permanently remove '${path}' from the filesystem.`,
        details: [
          `File path: ${path}`,
          "Data loss cannot be undone without external backups or git recovery.",
          "Ensure no active tasks or background processes depend on this file.",
        ],
      };
    }
    case "git_push": {
      const remote = String(payload?.remote ?? "origin");
      const branch = String(payload?.branch ?? "main");
      const force = Boolean(payload?.force);
      return {
        title: force ? "Destructive Force Push to Remote" : "Git Push to Remote Repository",
        severity: force ? "critical" : "danger",
        summary: `This operation will push local commits to remote '${remote}' on branch '${branch}'.`,
        details: [
          `Target Remote: ${remote}`,
          `Target Branch: ${branch}`,
          `Force Push: ${force ? "YES (WARNING: Can overwrite remote git history!)" : "No"}`,
          "Shared team repository state will be permanently modified.",
        ],
      };
    }
    case "production_deploy": {
      const env = String(payload?.environment ?? "production");
      const svc = String(payload?.serviceName ?? "unknown service");
      const tag = String(payload?.tag ?? "latest");
      return {
        title: "Live Production Deployment",
        severity: "critical",
        summary: `Deploying service '${svc}' (${tag}) directly into live environment '${env}'.`,
        details: [
          `Service: ${svc}`,
          `Release Tag: ${tag}`,
          `Environment: ${env}`,
          "Live user traffic and running production processes will be affected.",
        ],
      };
    }
    case "external_publish": {
      const pkg = String(payload?.packageName ?? "package");
      const ver = String(payload?.version ?? "0.0.0");
      const reg = String(payload?.registryUrl ?? "external registry");
      return {
        title: "External Artifact Publication",
        severity: "critical",
        summary: `Publishing release '${pkg}@${ver}' to public/external registry '${reg}'.`,
        details: [
          `Package: ${pkg}@${ver}`,
          `Registry: ${reg}`,
          "Published versions cannot be unpublished or mutated on public registries.",
        ],
      };
    }
    case "message_send": {
      const recipient = String(payload?.recipient ?? "unknown");
      const channel = String(payload?.channel ?? "external");
      return {
        title: "External Message Dispatch",
        severity: "warning",
        summary: `Sending an external notification/message to recipient '${recipient}' over '${channel}'.`,
        details: [
          `Recipient: ${recipient}`,
          `Channel: ${channel}`,
          "External stakeholders or users will receive notifications immediately.",
        ],
      };
    }
    case "destructive_operation":
    case "shell_execution": {
      const cmd = String(payload?.command ?? payload?.cmd ?? "");
      const isDestructive =
        cmd.includes("rm ") ||
        cmd.includes("drop") ||
        cmd.includes("reset --hard") ||
        cmd.includes("clean -fd");
      return {
        title: isDestructive ? "Destructive Shell Execution" : "Shell Command Execution",
        severity: isDestructive ? "critical" : "warning",
        summary: `Executing shell command: ${cmd}`,
        details: [
          `Command line: ${cmd}`,
          "Unsandboxed shell executions can modify filesystem state, processes, or network ports.",
        ],
      };
    }
    case "file_write": {
      const path = String(payload?.path ?? "file");
      const overwrite = Boolean(payload?.overwrite);
      return {
        title: overwrite ? "File Overwrite" : "File Write",
        severity: overwrite ? "warning" : "info",
        summary: `Writing content to '${path}'${overwrite ? " (will overwrite existing file)" : ""}.`,
        details: [`File path: ${path}`, `Overwrite enabled: ${overwrite}`],
      };
    }
    default:
      return {
        title: `Consequential Action (${actionType})`,
        severity: "warning",
        summary: `A consequential action of type '${actionType}' requires human review.`,
        details: payload ? Object.entries(payload).map(([k, v]) => `${k}: ${JSON.stringify(v)}`) : [],
      };
  }
}

/**
 * Formats a comprehensive inspectable Approval Card for terminal display.
 */
export function formatApprovalCard(approval: ApprovalRequest, useColor = false): string {
  const bold = useColor ? "\x1b[1m" : "";
  const reset = useColor ? "\x1b[0m" : "";
  const dim = useColor ? "\x1b[2m" : "";
  const red = useColor ? "\x1b[31m" : "";
  const green = useColor ? "\x1b[32m" : "";
  const yellow = useColor ? "\x1b[33m" : "";

  const statusMeta = APPROVAL_STATUS_UI[approval.status];
  const risk = (approval.riskLevel as ToolRiskLevel) ?? "high";
  const riskBadge = formatRiskBadge(risk, useColor);
  const consequence = explainConsequences(approval.actionType, approval.payload);

  const statusColor =
    approval.status === "approved"
      ? green
      : approval.status === "rejected"
      ? red
      : approval.status === "pending"
      ? yellow
      : dim;

  let card = `\n${bold}┌─────────────────────────────────────────────────────────────────────────────┐${reset}\n`;
  card += `${bold}│ APPROVAL REQUEST: ${approval.id.slice(0, 56).padEnd(56)} │${reset}\n`;
  card += `${bold}├─────────────────────────────────────────────────────────────────────────────┤${reset}\n`;
  card += `│ ${bold}Status:${reset}       ${statusColor}${statusMeta.glyph} ${statusMeta.label.padEnd(20)}${reset} ${bold}Risk:${reset} ${riskBadge.padEnd(useColor ? 28 : 20)} │\n`;
  card += `│ ${bold}Action:${reset}       ${approval.actionType.slice(0, 59).padEnd(59)} │\n`;
  card += `│ ${bold}Tool ID:${reset}      ${(approval.toolId ?? "N/A").slice(0, 59).padEnd(59)} │\n`;
  card += `│ ${bold}Task ID:${reset}      ${approval.taskId.slice(0, 59).padEnd(59)} │\n`;
  card += `│ ${bold}Requested By:${reset} ${approval.requestedByAgentId.slice(0, 59).padEnd(59)} │\n`;
  card += `│ ${bold}Requested At:${reset} ${approval.requestedAt.slice(0, 59).padEnd(59)} │\n`;
  if (approval.expiresAt) {
    card += `│ ${bold}Expires At:${reset}   ${approval.expiresAt.slice(0, 59).padEnd(59)} │\n`;
  }
  if (approval.reviewedByUserId) {
    card += `│ ${bold}Reviewed By:${reset}  ${approval.reviewedByUserId.slice(0, 59).padEnd(59)} │\n`;
  }
  if (approval.decisionReason) {
    card += `│ ${bold}Reason:${reset}       ${approval.decisionReason.slice(0, 59).padEnd(59)} │\n`;
  }

  card += `${bold}├─────────────────────────────────────────────────────────────────────────────┤${reset}\n`;
  card += `│ ${bold}${red}[CONSEQUENCE WARNING]:${reset}${" ".repeat(51)}│\n`;
  const titlePad = Math.max(0, 72 - consequence.title.length);
  card += `│   ${bold}${consequence.title}${reset}${" ".repeat(titlePad)} │\n`;
  const summaryPad = Math.max(0, 72 - consequence.summary.length);
  card += `│   ${dim}${consequence.summary}${reset}${" ".repeat(summaryPad)} │\n`;

  for (const detail of consequence.details) {
    const formatted = `• ${detail}`;
    card += `│   ${dim}${formatted.slice(0, 71).padEnd(71)}${reset} │\n`;
  }

  if (approval.payload && Object.keys(approval.payload).length > 0) {
    card += `${bold}├─────────────────────────────────────────────────────────────────────────────┤${reset}\n`;
    card += `│ ${bold}Proposed Execution Payload:${reset}${" ".repeat(48)}│\n`;
    for (const [key, val] of Object.entries(approval.payload)) {
      const line = `  ${key}: ${JSON.stringify(val)}`;
      const truncated = line.length > 71 ? line.substring(0, 68) + "..." : line;
      card += `│ ${dim}${truncated.padEnd(74)}${reset} │\n`;
    }
  }

  if (approval.payloadHash) {
    card += `${bold}├─────────────────────────────────────────────────────────────────────────────┤${reset}\n`;
    const hashLine = `Payload Hash: ${approval.payloadHash}`;
    card += `│ ${dim}${hashLine.slice(0, 73).padEnd(74)}${reset} │\n`;
  }

  card += `${bold}└─────────────────────────────────────────────────────────────────────────────┘${reset}\n`;
  return card;
}
