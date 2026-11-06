/**
 * @terrarium/core - persistence/repositories/sqlite-session-repository.ts
 *
 * SQLite implementation of SessionRepository.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type DatabaseError,
  type DuplicateEntityError,
  type Message,
  NotFoundError,
  type Session,
  type SessionRepository,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface SessionRow {
  id: string;
  title: string;
  mode: string;
  status: string;
  participant_agent_ids_json: string;
  active_task_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  sender_id: string;
  sender_type: string;
  role: string;
  content: string;
  citations_json: string | null;
  tool_call_ids_json: string | null;
  token_count: number | null;
  created_at: string;
  updated_at: string;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode as any,
    status: row.status as any,
    participantAgentIds: JSON.parse(row.participant_agent_ids_json || "[]"),
    activeTaskId: row.active_task_id ?? undefined,
    closedAt: row.closed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    senderId: row.sender_id,
    senderType: row.sender_type as any,
    role: row.role as any,
    content: row.content,
    citations: row.citations_json ? JSON.parse(row.citations_json) : undefined,
    toolCallIds: row.tool_call_ids_json ? JSON.parse(row.tool_call_ids_json) : undefined,
    tokenCount: row.token_count ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Result<Session | null, DatabaseError>> {
    try {
      const row = this.db.query("SELECT * FROM sessions WHERE id = ?;").get(id) as SessionRow | null;
      if (!row) {
        return ok(null);
      }
      return ok(rowToSession(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Session", id));
    }
  }

  async list(limit = 50, offset = 0): Promise<Result<readonly Session[], DatabaseError>> {
    try {
      const rows = this.db
        .query("SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?;")
        .all(limit, offset) as SessionRow[];
      return ok(rows.map(rowToSession));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Session", "list"));
    }
  }

  async create(session: Session): Promise<Result<Session, DuplicateEntityError | DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO sessions (
          id, title, mode, status, participant_agent_ids_json, active_task_id, closed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          session.id,
          session.title,
          session.mode,
          session.status,
          JSON.stringify(session.participantAgentIds),
          session.activeTaskId ?? null,
          session.closedAt ?? null,
          session.createdAt,
          session.updatedAt,
        ]
      );
      return ok(session);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Session", session.id));
    }
  }

  async update(session: Session): Promise<Result<Session, NotFoundError | DatabaseError>> {
    try {
      const res = this.db.run(
        `UPDATE sessions SET
          title = ?,
          mode = ?,
          status = ?,
          participant_agent_ids_json = ?,
          active_task_id = ?,
          closed_at = ?,
          updated_at = ?
        WHERE id = ?;`,
        [
          session.title,
          session.mode,
          session.status,
          JSON.stringify(session.participantAgentIds),
          session.activeTaskId ?? null,
          session.closedAt ?? null,
          session.updatedAt,
          session.id,
        ]
      );

      if (res.changes === 0) {
        return fail(new NotFoundError("Session", session.id));
      }
      return ok(session);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Session", session.id));
    }
  }

  async delete(id: string): Promise<Result<boolean, DatabaseError>> {
    try {
      const res = this.db.run("DELETE FROM sessions WHERE id = ?;", [id]);
      return ok(res.changes > 0);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Session", id));
    }
  }

  async addMessage(message: Message): Promise<Result<Message, DuplicateEntityError | DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO messages (
          id, session_id, sender_id, sender_type, role, content,
          citations_json, tool_call_ids_json, token_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          message.id,
          message.sessionId,
          message.senderId,
          message.senderType,
          message.role,
          message.content,
          message.citations ? JSON.stringify(message.citations) : null,
          message.toolCallIds ? JSON.stringify(message.toolCallIds) : null,
          message.tokenCount ?? null,
          message.createdAt,
          message.updatedAt,
        ]
      );
      return ok(message);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Message", message.id, "session_id"));
    }
  }

  async getMessages(
    sessionId: string,
    limit = 100,
    offset = 0
  ): Promise<Result<readonly Message[], DatabaseError>> {
    try {
      const rows = this.db
        .query("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?;")
        .all(sessionId, limit, offset) as MessageRow[];
      return ok(rows.map(rowToMessage));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "Message", sessionId));
    }
  }
}
