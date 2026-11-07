/**
 * @terrarium/core - tools/security-enforcer.ts
 *
 * Security and least-privilege enforcement engine for tool invocations.
 * Evaluates caller permissions, disallowed tools, and detects consequential actions
 * requiring human approval per PLAN.md Section 17 & PLAN_CONTEXT.md Section 7.
 */

import {
  type ApprovalActionType,
  type Result,
  type ToolDefinition,
  type ToolExecutionContext,
  ok,
  fail,
  PermissionDeniedError,
} from "@terrarium/contracts";

export class ToolSecurityEnforcer {
  /**
   * Verifies that the execution context satisfies least privilege requirements:
   * 1. Tool is not explicitly in the agent's disallowedTools list.
   * 2. Context has all required permissions granted.
   */
  checkPermission(
    tool: ToolDefinition<any, any>,
    context: ToolExecutionContext
  ): Result<void, PermissionDeniedError> {
    // 1. Check disallowed tools
    if (context.disallowedTools && context.disallowedTools.includes(tool.id)) {
      return fail(
        new PermissionDeniedError(
          "execute",
          tool.id,
          `Tool '${tool.id}' is explicitly listed in disallowedTools for agent '${context.agentId}'`
        )
      );
    }

    // 2. Check required permissions
    const granted = new Set(context.grantedPermissions);
    const hasSuperAdmin = granted.has("*");

    if (!hasSuperAdmin) {
      for (const reqPerm of tool.requiredPermissions) {
        if (granted.has(reqPerm)) {
          continue;
        }

        // Support namespace wildcard e.g. "file:*" matches "file:read", "file:write"
        const [namespace] = reqPerm.split(":");
        if (namespace && granted.has(`${namespace}:*`)) {
          continue;
        }

        return fail(
          new PermissionDeniedError(
            "execute",
            tool.id,
            `Agent '${context.agentId}' lacks required permission '${reqPerm}' for tool '${tool.id}'. Granted permissions: [${Array.from(
              granted
            ).join(", ")}]`
          )
        );
      }
    }

    return ok(undefined);
  }

  /**
   * Evaluates whether a tool invocation constitutes a consequential action
   * requiring human approval.
   */
  async isConsequentialAction(
    tool: ToolDefinition<any, any>,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<boolean> {
    // 1. Explicit tool isConsequential flag or predicate
    if (typeof tool.isConsequential === "function") {
      const predResult = await tool.isConsequential(input, context);
      if (predResult) return true;
    } else if (tool.isConsequential === true) {
      return true;
    }

    // 2. Explicit requiresApproval flag or predicate
    if (typeof tool.requiresApproval === "function") {
      const predResult = await tool.requiresApproval(input, context);
      if (predResult) return true;
    } else if (tool.requiresApproval === true) {
      return true;
    }

    // 3. Risk level and side-effect class defaults
    if (tool.riskLevel === "critical") {
      return true;
    }
    if (tool.sideEffectClass === "consequential") {
      return true;
    }

    // 4. Consequential action heuristics on input
    const toolId = tool.id.toLowerCase();

    // File deletions & destructive file modifications
    if (toolId.includes("delete") || toolId.includes("remove") || toolId.includes("unlink")) {
      return true;
    }

    // Git push / publishing / deployment
    if (toolId.includes("git.push") || toolId.includes("git_push")) {
      return true;
    }
    if (toolId.includes("publish") || toolId.includes("deploy")) {
      return true;
    }

    // External messages
    if (toolId.includes("message") || toolId.includes("notify") || toolId.includes("slack")) {
      return true;
    }

    // Shell destructive command detection
    if (toolId.includes("shell") || toolId.includes("command") || toolId.includes("exec")) {
      const cmd = String(input.command ?? input.cmd ?? "").toLowerCase();
      const destructivePatterns = [
        "rm -rf",
        "rm -r",
        "mkfs",
        "dd if=",
        "drop table",
        "drop database",
        "git reset --hard",
        "git clean -fd",
        "npm publish",
        "cargo publish",
        "terraform destroy",
      ];
      if (destructivePatterns.some((pattern) => cmd.includes(pattern))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Maps a tool and its input to a canonical ApprovalActionType.
   */
  mapToolToApprovalAction(
    tool: ToolDefinition<any, any>,
    input: Record<string, unknown>
  ): ApprovalActionType {
    const toolId = tool.id.toLowerCase();

    if (toolId.includes("delete") || toolId.includes("remove") || toolId.includes("unlink")) {
      return "file_delete";
    }
    if (toolId.includes("git.push") || toolId.includes("git_push")) {
      return "git_push";
    }
    if (toolId.includes("git.commit") || toolId.includes("git_commit")) {
      return "git_commit";
    }
    if (toolId.includes("deploy")) {
      return "production_deploy";
    }
    if (toolId.includes("publish")) {
      return "external_publish";
    }
    if (toolId.includes("message") || toolId.includes("notify")) {
      return "message_send";
    }
    if (toolId.includes("install") || toolId.includes("package")) {
      return "package_install";
    }
    if (toolId.includes("payment") || toolId.includes("paid")) {
      return "paid_api_call";
    }
    if (toolId.includes("shell") || toolId.includes("exec") || toolId.includes("command")) {
      const cmd = String(input.command ?? input.cmd ?? "").toLowerCase();
      if (cmd.includes("rm ") || cmd.includes("drop") || cmd.includes("reset --hard")) {
        return "destructive_operation";
      }
      return "shell_execution";
    }
    if (tool.sideEffectClass === "state_mutating" || toolId.includes("write")) {
      return "file_write";
    }

    return "destructive_operation";
  }
}
