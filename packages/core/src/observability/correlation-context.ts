/**
 * @terrarium/core - observability/correlation-context.ts
 *
 * Distributed correlation and trace context propagation across asynchronous agent tasks.
 * Uses AsyncLocalStorage when available for automatic context flow across async boundaries.
 * Aligns with PLAN.md Section 18 (Observability & Auditability).
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { type CorrelationContext } from "@terrarium/contracts";

const asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

let fallbackGlobalContext: CorrelationContext | null = null;

/**
 * Creates a new root correlation context.
 */
export function createRootContext(initial?: Partial<CorrelationContext>): CorrelationContext {
  const correlationId = initial?.correlationId ?? `corr-${randomUUID()}`;
  const traceId = initial?.traceId ?? `trace-${randomUUID()}`;
  const spanId = initial?.spanId ?? `span-${randomUUID().slice(0, 8)}`;

  return {
    correlationId,
    traceId,
    spanId,
    parentSpanId: initial?.parentSpanId,
    taskId: initial?.taskId,
    stepId: initial?.stepId,
    agentSlug: initial?.agentSlug,
  };
}

/**
 * Creates a child span context under an existing correlation context.
 */
export function createChildSpan(
  parent: CorrelationContext,
  overrides?: Partial<CorrelationContext>
): CorrelationContext {
  return {
    ...parent,
    ...overrides,
    spanId: overrides?.spanId ?? `span-${randomUUID().slice(0, 8)}`,
    parentSpanId: parent.spanId,
  };
}

/**
 * Runs an asynchronous operation within the given correlation context.
 */
export function runWithContext<T>(
  context: CorrelationContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  fallbackGlobalContext = context;
  return asyncLocalStorage.run(context, fn);
}

/**
 * Retrieves the currently active correlation context, or creates a root context if none exists.
 */
export function getCurrentContext(): CorrelationContext {
  const active = asyncLocalStorage.getStore();
  if (active) return active;
  if (fallbackGlobalContext) return fallbackGlobalContext;

  const root = createRootContext();
  fallbackGlobalContext = root;
  return root;
}
