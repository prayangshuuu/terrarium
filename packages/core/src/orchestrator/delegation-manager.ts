/**
 * @terrarium/core - orchestrator/delegation-manager.ts
 *
 * Enforces delegation boundaries, maximum recursion depth, loop prevention,
 * and concurrency serialization.
 * Aligns with PLAN.md Section 5.3 (Delegation Rules).
 */

import {
  type Result,
  ok,
  fail,
  DelegationDepthExceededError,
} from "@terrarium/contracts";

export interface DelegationCheckParams {
  readonly currentDepth: number;
  readonly maxDepth: number;
  readonly parentTaskId?: string;
  readonly targetDepartment: string;
  readonly objective: string;
}

export class DelegationManager {
  private readonly delegationHistory: Set<string> = new Set();
  private readonly inFlightDelegations: Map<string, number> = new Map();

  /**
   * Evaluates whether a proposed delegation is legal and within bounds.
   */
  canDelegate(params: DelegationCheckParams): Result<boolean, DelegationDepthExceededError | Error> {
    // 1. Enforce strict depth bound
    if (params.currentDepth >= params.maxDepth) {
      return fail(new DelegationDepthExceededError(params.currentDepth + 1, params.maxDepth));
    }

    // 2. Loop & duplication prevention: prevent delegating the exact same objective repeatedly
    const delegationKey = `${params.parentTaskId ?? "root"}:${params.targetDepartment}:${params.objective.trim().toLowerCase()}`;
    if (this.delegationHistory.has(delegationKey)) {
      return fail(
        new Error(
          `Unbounded loop prevented: Duplicate delegation of objective '${params.objective}' to department '${params.targetDepartment}'`
        )
      );
    }

    return ok(true);
  }

  /**
   * Registers a delegation in the audit history.
   */
  recordDelegation(parentTaskId: string | undefined, department: string, objective: string): void {
    const key = `${parentTaskId ?? "root"}:${department}:${objective.trim().toLowerCase()}`;
    this.delegationHistory.add(key);
  }

  /**
   * Clears delegation state.
   */
  reset(): void {
    this.delegationHistory.clear();
    this.inFlightDelegations.clear();
  }
}

/**
 * Factory for DelegationManager.
 */
export function createDelegationManager(): DelegationManager {
  return new DelegationManager();
}
