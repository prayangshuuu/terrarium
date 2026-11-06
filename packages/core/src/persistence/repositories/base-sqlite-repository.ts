/**
 * @terrarium/core - persistence/repositories/base-sqlite-repository.ts
 *
 * Shared SQLite repository base and constraint error translation.
 */

import { Database } from "bun:sqlite";
import {
  DatabaseError,
  DuplicateEntityError,
  ForeignKeyConstraintError,
} from "@terrarium/contracts";

export function handleSqliteError(
  err: unknown,
  entityType: string,
  entityId: string,
  foreignKey = "relationship"
): DatabaseError {
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes("UNIQUE constraint failed") ||
    message.includes("PRIMARY KEY constraint failed")
  ) {
    return new DuplicateEntityError(entityType, entityId);
  }
  if (message.includes("FOREIGN KEY constraint failed")) {
    return new ForeignKeyConstraintError(entityType, foreignKey, entityId);
  }
  return new DatabaseError(`Database operation failed on ${entityType} (${entityId}): ${message}`);
}
