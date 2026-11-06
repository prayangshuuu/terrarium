/**
 * @terrarium/core - persistence/repositories/sqlite-event-repository.ts
 *
 * SQLite implementation of EventRepository for observability and auditing.
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type DatabaseError,
  type DomainEvent,
  type EventQueryOptions,
  type EventRepository,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface EventRow {
  id: string;
  event_type: string;
  source: string;
  entity_type: string;
  entity_id: string;
  payload_json: string | null;
  timestamp: string;
}

function rowToEvent(row: EventRow): DomainEvent {
  return {
    id: row.id,
    eventType: row.event_type as any,
    source: row.source as any,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload_json ? JSON.parse(row.payload_json) : undefined,
    timestamp: row.timestamp,
  };
}

export class SqliteEventRepository implements EventRepository {
  constructor(private readonly db: Database) {}

  async record(event: DomainEvent): Promise<Result<DomainEvent, DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO domain_events (id, event_type, source, entity_type, entity_id, payload_json, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          event.id,
          event.eventType,
          event.source,
          event.entityType,
          event.entityId,
          event.payload ? JSON.stringify(event.payload) : null,
          event.timestamp,
        ]
      );
      return ok(event);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "DomainEvent", event.id));
    }
  }

  async query(options: EventQueryOptions = {}): Promise<Result<readonly DomainEvent[], DatabaseError>> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (options.entityType) {
        conditions.push("entity_type = ?");
        params.push(options.entityType);
      }
      if (options.entityId) {
        conditions.push("entity_id = ?");
        params.push(options.entityId);
      }
      if (options.eventType) {
        conditions.push("event_type = ?");
        params.push(options.eventType);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const limit = options.limit ?? 100;
      const offset = options.offset ?? 0;

      const query = `SELECT * FROM domain_events ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?;`;
      const rows = this.db.query(query).all(...params, limit, offset) as EventRow[];
      return ok(rows.map(rowToEvent));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "DomainEvent", "query"));
    }
  }
}
