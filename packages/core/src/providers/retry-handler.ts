/**
 * @terrarium/core - providers/retry-handler.ts
 *
 * Resilient retry handler with exponential backoff, jitter, rate-limit awareness,
 * and AbortSignal cancellation support.
 * Aligns with PLAN.md Section 19 (Failure & Edge-Case Behavior).
 */

import {
  type ProviderError,
  type Result,
  ProviderRateLimitError,
  fail,
} from "@terrarium/contracts";

export interface RetryOptions {
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly backoffFactor?: number;
  readonly signal?: AbortSignal;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, "signal">> = {
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 5000,
  backoffFactor: 2.0,
};

/**
 * Sleeps for the specified duration or until the AbortSignal triggers.
 */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error("Operation aborted"));
    }

    const timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Operation aborted"));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/**
 * Executes an asynchronous provider operation with retry logic for retryable errors.
 */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<Result<T, ProviderError>>,
  options: RetryOptions = {}
): Promise<Result<T, ProviderError>> {
  const maxRetries = options.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const backoffFactor = options.backoffFactor ?? DEFAULT_RETRY_OPTIONS.backoffFactor;
  const signal = options.signal;

  let attempt = 0;

  while (true) {
    if (signal?.aborted) {
      return fail(new ProviderRateLimitError("Operation cancelled via AbortSignal", "core"));
    }

    const res = await operation(attempt);

    if (res.success) {
      return res;
    }

    const error = res.error;
    attempt++;

    // Only retry if error is designated as retryable and we haven't reached maxRetries
    if (!error.isRetryable || attempt > maxRetries) {
      return fail(error);
    }

    // Determine backoff duration
    let delayMs: number;

    if (error instanceof ProviderRateLimitError && error.retryAfterMs) {
      delayMs = Math.min(error.retryAfterMs, maxDelayMs);
    } else {
      // Exponential backoff with 10% random jitter
      const exponentialDelay = baseDelayMs * Math.pow(backoffFactor, attempt - 1);
      const jitter = (Math.random() * 0.2 - 0.1) * exponentialDelay; // +/- 10%
      delayMs = Math.min(Math.max(0, exponentialDelay + jitter), maxDelayMs);
    }

    try {
      await abortableSleep(delayMs, signal);
    } catch {
      return fail(error);
    }
  }
}
