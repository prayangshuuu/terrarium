/**
 * @terrarium/contracts - events.ts
 *
 * Domain event types and audit log schema for observability and auditability.
 * Aligns with PLAN.md Section 18 (Observability & Auditability).
 */

import { type Result, ok, fail } from "./base.ts";
import { DomainValidationError, type ValidationIssue } from "./errors.ts";
import {
  isRecord,
  validateEnum,
  validateIsoDateTime,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

export const EVENT_TYPES = [
  "task:created",
  "task:status_changed",
  "task:completed",
  "task:failed",
  "task:cancelled",
  "agent:activated",
  "agent:deactivated",
  "agent:delegated",
  "step:started",
  "step:completed",
  "step:failed",
  "approval:requested",
  "approval:resolved",
  "approval:approved",
  "approval:rejected",
  "approval:expired",
  "approval:cancelled",
  "tool:invoked",
  "tool:succeeded",
  "tool:failed",
  "tool:blocked",
  "budget:warning",
  "budget:exceeded",
  "memory:recorded",
  "memory:updated",
  "memory:deleted",
  "memory:archived",
  "memory:revalidated",
  "memory:conflict_detected",
  "memory:conflict_resolved",
  "context:assembled",
  "artifact:generated",
  "artifact:verified",
  "report:generated",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_SOURCES = ["orchestrator", "agent", "user", "system"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

export interface DomainEvent {
  readonly id: string;
  readonly eventType: EventType;
  readonly source: EventSource;
  readonly entityType: string;
  readonly entityId: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly timestamp: string;
}

export function validateDomainEvent(
  value: unknown,
  path = "event"
): Result<DomainEvent, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const eventType = collector.check(validateEnum(value.eventType, `${path}.eventType`, EVENT_TYPES));
  const source = collector.check(validateEnum(value.source, `${path}.source`, EVENT_SOURCES));
  const entityType = collector.check(
    validateString(value.entityType, `${path}.entityType`, { minLength: 1, maxLength: 100 })
  );
  const entityId = collector.check(
    validateString(value.entityId, `${path}.entityId`, { minLength: 1, maxLength: 100 })
  );
  const timestamp = collector.check(validateIsoDateTime(value.timestamp, `${path}.timestamp`));

  if (
    collector.hasIssues() ||
    id === undefined ||
    eventType === undefined ||
    source === undefined ||
    entityType === undefined ||
    entityId === undefined ||
    timestamp === undefined
  ) {
    return fail(collector.toError("DomainEvent validation failed"));
  }

  return ok({
    id,
    eventType,
    source,
    entityType,
    entityId,
    payload: value.payload as Record<string, unknown> | undefined,
    timestamp,
  });
}
