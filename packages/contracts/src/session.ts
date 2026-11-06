/**
 * @terrarium/contracts - session.ts
 *
 * Interactive session modes, message contracts, transitions, and validation.
 * Aligns with PLAN.md Section 5.2 (Activation Modes) and Section 11 (Interactive Communication).
 */

import { type BaseEntity, type Result, ok, fail } from "./base.ts";
import { DomainValidationError, InvalidStateTransitionError, type ValidationIssue } from "./errors.ts";
import {
  isRecord,
  validateArray,
  validateEnum,
  validateIsoDateTime,
  validateNumber,
  validateString,
  ValidationCollector,
} from "./validation-helpers.ts";

export const SESSION_MODES = [
  "interactive",
  "focused",
  "department",
  "cross_functional",
  "organization_wide",
  "background",
] as const;

export type SessionMode = (typeof SESSION_MODES)[number];

export const SESSION_STATUSES = ["active", "idle", "paused", "closed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_STATE_TRANSITIONS: Readonly<Record<SessionStatus, readonly SessionStatus[]>> = {
  active: ["idle", "paused", "closed"],
  idle: ["active", "paused", "closed"],
  paused: ["active", "closed"],
  closed: [],
};

export const MESSAGE_SENDER_TYPES = ["user", "agent", "system", "orchestrator"] as const;
export type MessageSenderType = (typeof MESSAGE_SENDER_TYPES)[number];

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export interface MessageCitation {
  readonly title: string;
  readonly pathOrUri: string;
  readonly excerpt?: string;
}

export interface Message extends BaseEntity {
  readonly sessionId: string;
  readonly senderId: string;
  readonly senderType: MessageSenderType;
  readonly role: MessageRole;
  readonly content: string;
  readonly citations?: readonly MessageCitation[];
  readonly toolCallIds?: readonly string[];
  readonly tokenCount?: number;
}

export interface Session extends BaseEntity {
  readonly title: string;
  readonly mode: SessionMode;
  readonly status: SessionStatus;
  readonly participantAgentIds: readonly string[];
  readonly activeTaskId?: string;
  readonly closedAt?: string;
}

export function isValidSessionTransition(from: SessionStatus, to: SessionStatus): boolean {
  if (from === to) return true;
  const allowed = SESSION_STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertSessionTransition(
  from: SessionStatus,
  to: SessionStatus
): Result<SessionStatus, InvalidStateTransitionError> {
  if (isValidSessionTransition(from, to)) {
    return ok(to);
  }
  const allowed = SESSION_STATE_TRANSITIONS[from] ?? [];
  return fail(new InvalidStateTransitionError("Session", from, to, allowed));
}

export function validateMessage(
  value: unknown,
  path = "message"
): Result<Message, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const sessionId = collector.check(
    validateString(value.sessionId, `${path}.sessionId`, { minLength: 1, maxLength: 100 })
  );
  const senderId = collector.check(
    validateString(value.senderId, `${path}.senderId`, { minLength: 1, maxLength: 100 })
  );
  const senderType = collector.check(
    validateEnum(value.senderType, `${path}.senderType`, MESSAGE_SENDER_TYPES)
  );
  const role = collector.check(validateEnum(value.role, `${path}.role`, MESSAGE_ROLES));
  const content = collector.check(
    validateString(value.content, `${path}.content`, { minLength: 1, maxLength: 100000 })
  );
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));

  let tokenCount: number | undefined;
  if (value.tokenCount !== undefined) {
    tokenCount = collector.check(
      validateNumber(value.tokenCount, `${path}.tokenCount`, { min: 0, integer: true })
    );
  }

  if (
    collector.hasIssues() ||
    id === undefined ||
    sessionId === undefined ||
    senderId === undefined ||
    senderType === undefined ||
    role === undefined ||
    content === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return fail(collector.toError("Message validation failed"));
  }

  return ok({
    id,
    sessionId,
    senderId,
    senderType,
    role,
    content,
    citations: value.citations as MessageCitation[] | undefined,
    toolCallIds: value.toolCallIds as string[] | undefined,
    tokenCount,
    createdAt,
    updatedAt,
  });
}

export function validateSession(
  value: unknown,
  path = "session"
): Result<Session, DomainValidationError> {
  if (!isRecord(value)) {
    return fail(
      new DomainValidationError(`Expected object for ${path}`, [
        { path, message: "Expected object", received: value },
      ])
    );
  }

  const collector = new ValidationCollector();

  const id = collector.check(validateString(value.id, `${path}.id`, { minLength: 1, maxLength: 100 }));
  const title = collector.check(validateString(value.title, `${path}.title`, { minLength: 1, maxLength: 200 }));
  const mode = collector.check(validateEnum(value.mode, `${path}.mode`, SESSION_MODES));
  const status = collector.check(validateEnum(value.status, `${path}.status`, SESSION_STATUSES));
  const createdAt = collector.check(validateIsoDateTime(value.createdAt, `${path}.createdAt`));
  const updatedAt = collector.check(validateIsoDateTime(value.updatedAt, `${path}.updatedAt`));

  const participants = collector.check(
    validateArray(value.participantAgentIds ?? [], `${path}.participantAgentIds`, (p, pPath) =>
      validateString(p, pPath, { minLength: 1, maxLength: 100 })
    )
  );

  if (
    collector.hasIssues() ||
    id === undefined ||
    title === undefined ||
    mode === undefined ||
    status === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return fail(collector.toError("Session validation failed"));
  }

  return ok({
    id,
    title,
    mode,
    status,
    participantAgentIds: participants ?? [],
    activeTaskId: typeof value.activeTaskId === "string" ? value.activeTaskId : undefined,
    closedAt: typeof value.closedAt === "string" ? value.closedAt : undefined,
    createdAt,
    updatedAt,
  });
}
