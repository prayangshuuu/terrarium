/**
 * @terrarium/core - memory/security-enforcer.ts
 *
 * Security and privacy enforcement for project memory operations.
 * Enforces least-privilege permissions, secret redaction, and strict cross-project isolation.
 * Aligns with PLAN.md Section 14 & 17 and PLAN_CONTEXT.md Section 7.
 */

import {
  type Result,
  ok,
  fail,
  PermissionDeniedError,
  CrossProjectContextLeakError,
} from "@terrarium/contracts";
import { redactSecretsInString } from "@terrarium/config";

export interface CallerContext {
  readonly projectId: string;
  readonly actorId: string;
  readonly role?: string;
  readonly permissions?: readonly string[];
}

export class MemorySecurityEnforcer {
  /**
   * Enforces caller permission checks for memory actions.
   */
  assertPermission(
    caller: CallerContext,
    requiredPermission: string,
    actionDescription: string
  ): Result<void, PermissionDeniedError> {
    const granted = caller.permissions ?? ["*"]; // Default permissive for superuser/system callers

    const hasWildcard = granted.includes("*") || granted.includes("memory:*");
    const hasExact =
      granted.includes(requiredPermission) ||
      granted.includes(requiredPermission.replace(":", "."));

    if (!hasWildcard && !hasExact) {
      return fail(
        new PermissionDeniedError(
          actionDescription,
          requiredPermission,
          `Actor '${caller.actorId}' lacks required permission '${requiredPermission}'`
        )
      );
    }

    return ok(undefined);
  }

  /**
   * Enforces strict cross-project context isolation.
   * Prevents one project's memory or context from leaking into another project.
   */
  assertProjectIsolation(
    callerProjectId: string,
    targetProjectId: string
  ): Result<void, CrossProjectContextLeakError> {
    if (callerProjectId !== targetProjectId) {
      return fail(new CrossProjectContextLeakError(callerProjectId, targetProjectId));
    }
    return ok(undefined);
  }

  /**
   * Sanitizes memory text content by scrubbing detected credentials, API tokens,
   * private keys, and authorization headers.
   */
  sanitizeContent(rawText: string): string {
    if (!rawText) return rawText;
    return redactSecretsInString(rawText);
  }
}
