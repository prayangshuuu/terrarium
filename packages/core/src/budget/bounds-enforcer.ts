/**
 * @terrarium/core - budget/bounds-enforcer.ts
 *
 * Enforces operational bounds: concurrency limits, execution duration limits,
 * debate rounds, retries, and delegation depth.
 * Aligns strictly with PLAN.md Section 13 & PLAN_CONTEXT.md Section 5 & 8.
 */

import {
  type Result,
  ok,
  fail,
  ConcurrencyLimitExceededError,
  DurationLimitExceededError,
  DelegationDepthExceededError,
  TerrariumError,
} from "@terrarium/contracts";

export interface BoundsEnforcerOptions {
  readonly scope?: string;
  readonly targetId?: string;
  readonly maxConcurrency?: number;
  readonly maxDurationMs?: number;
  readonly maxDebateRounds?: number;
  readonly maxRetries?: number;
  readonly maxDelegationDepth?: number;
}

export class BoundsEnforcer {
  private readonly activeConcurrencyMap: Map<string, number> = new Map();
  private readonly defaultOptions?: BoundsEnforcerOptions;
  private currentDebateRounds = 0;
  private currentRetries = 0;
  private startTimeMs?: number;

  constructor(options?: BoundsEnforcerOptions) {
    this.defaultOptions = options;
  }

  private makeKey(scope: string, targetId = "default"): string {
    return `${scope}:${targetId}`;
  }

  /**
   * Acquires a concurrency slot for a target scope.
   */
  acquireConcurrency(
    scope: string,
    targetId = "default",
    maxConcurrency?: number
  ): Result<void, ConcurrencyLimitExceededError> {
    const limit = maxConcurrency ?? this.defaultOptions?.maxConcurrency;
    if (limit === undefined || limit <= 0) {
      return ok(undefined);
    }

    const key = this.makeKey(scope, targetId);
    const current = this.activeConcurrencyMap.get(key) ?? 0;

    if (current >= limit) {
      return fail(new ConcurrencyLimitExceededError(scope, current, limit));
    }

    this.activeConcurrencyMap.set(key, current + 1);
    return ok(undefined);
  }

  /**
   * Acquires a concurrency slot using instance default scope/targetId.
   */
  acquireConcurrencySlot(identifier?: string): Result<void, ConcurrencyLimitExceededError> {
    const scope = this.defaultOptions?.scope ?? "task";
    const targetId = this.defaultOptions?.targetId ?? "default";
    return this.acquireConcurrency(scope, targetId, this.defaultOptions?.maxConcurrency);
  }

  /**
   * Releases an acquired concurrency slot.
   */
  releaseConcurrency(scope?: string, targetId?: string): void {
    const s = scope ?? this.defaultOptions?.scope ?? "task";
    const t = targetId ?? this.defaultOptions?.targetId ?? "default";
    const key = this.makeKey(s, t);
    const current = this.activeConcurrencyMap.get(key) ?? 0;
    if (current > 1) {
      this.activeConcurrencyMap.set(key, current - 1);
    } else {
      this.activeConcurrencyMap.delete(key);
    }
  }

  /**
   * Releases a concurrency slot using instance default scope/targetId.
   */
  releaseConcurrencySlot(identifier?: string): void {
    this.releaseConcurrency();
  }

  /**
   * Returns current active concurrency count.
   */
  getActiveConcurrency(scope?: string, targetId?: string): number {
    const s = scope ?? this.defaultOptions?.scope ?? "task";
    const t = targetId ?? this.defaultOptions?.targetId ?? "default";
    const key = this.makeKey(s, t);
    return this.activeConcurrencyMap.get(key) ?? 0;
  }

  /**
   * Records execution start time.
   */
  recordStartTime(timeMs = Date.now()): void {
    this.startTimeMs = timeMs;
  }

  /**
   * Checks whether elapsed time exceeds maxDurationMs.
   */
  checkDuration(nowMs = Date.now()): Result<void, DurationLimitExceededError> {
    if (this.startTimeMs === undefined) return ok(undefined);
    const scope = this.defaultOptions?.scope ?? "task";
    return this.assertDuration(scope, this.startTimeMs, this.defaultOptions?.maxDurationMs, nowMs);
  }

  /**
   * Enforces duration bounds against a start time.
   */
  assertDuration(
    scope: string,
    startTimeMs: number,
    maxDurationMs?: number,
    nowMs = Date.now()
  ): Result<void, DurationLimitExceededError> {
    const limit = maxDurationMs ?? this.defaultOptions?.maxDurationMs;
    if (limit === undefined || limit <= 0) {
      return ok(undefined);
    }

    const elapsedMs = Math.max(0, nowMs - startTimeMs);
    if (elapsedMs > limit) {
      return fail(new DurationLimitExceededError(scope, elapsedMs, limit));
    }

    return ok(undefined);
  }

  /**
   * Asserts delegation depth is within bounds (prevents recursive delegation loops).
   */
  assertDelegationDepth(
    currentDepth: number,
    maxDepth = 3
  ): Result<void, DelegationDepthExceededError> {
    const limit = maxDepth ?? this.defaultOptions?.maxDelegationDepth ?? 3;
    if (currentDepth > limit) {
      return fail(new DelegationDepthExceededError(currentDepth, limit));
    }
    return ok(undefined);
  }

  /**
   * Asserts debate rounds are bounded.
   */
  assertDebateRound(
    currentRound: number,
    maxRounds = 3
  ): Result<void, TerrariumError> {
    const limit = maxRounds ?? this.defaultOptions?.maxDebateRounds ?? 3;
    if (currentRound > limit) {
      return fail(
        new TerrariumError(
          `Debate rounds exceeded: round ${currentRound} exceeds maximum of ${limit}. Bounded to prevent runaway token burn.`,
          "BUDGET_EXCEEDED",
          { currentRound, maxRounds: limit }
        )
      );
    }
    return ok(undefined);
  }

  /**
   * Increments and asserts debate round within configured bounds.
   */
  incrementDebateRound(): Result<number, TerrariumError> {
    this.currentDebateRounds += 1;
    const assertRes = this.assertDebateRound(
      this.currentDebateRounds,
      this.defaultOptions?.maxDebateRounds ?? 3
    );
    if (!assertRes.success) return fail(assertRes.error);
    return ok(this.currentDebateRounds);
  }

  /**
   * Asserts retry attempts are bounded.
   */
  assertRetries(
    currentAttempt: number,
    maxRetries = 3
  ): Result<void, TerrariumError> {
    const limit = maxRetries ?? this.defaultOptions?.maxRetries ?? 3;
    if (currentAttempt > limit) {
      return fail(
        new TerrariumError(
          `Retry limit exhausted: attempt ${currentAttempt} exceeds maximum allowed retries of ${limit}.`,
          "BUDGET_EXCEEDED",
          { currentAttempt, maxRetries: limit }
        )
      );
    }
    return ok(undefined);
  }

  /**
   * Increments and asserts retries within configured bounds.
   */
  incrementRetry(): Result<number, TerrariumError> {
    this.currentRetries += 1;
    const assertRes = this.assertRetries(
      this.currentRetries,
      this.defaultOptions?.maxRetries ?? 3
    );
    if (!assertRes.success) return fail(assertRes.error);
    return ok(this.currentRetries);
  }
}
