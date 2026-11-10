/**
 * @terrarium/core - observability/retention-cleaner.ts
 *
 * Automated retention policy enforcement for structured logs and domain events.
 * Prunes historical records beyond age limits or maximum record quotas.
 * Aligns with PLAN.md Section 18 and Prompt 13 requirements.
 */

import {
  type Result,
  ok,
  fail,
  type RetentionPolicy,
  DEFAULT_RETENTION_POLICY,
  type DatabaseError,
} from "@terrarium/contracts";
import { SqliteLogRepository } from "../persistence/repositories/sqlite-log-repository.js";

export interface CleanupResult {
  readonly logsDeleted: number;
  readonly eventsDeleted: number;
  readonly cleanedAt: string;
}

export class RetentionCleaner {
  constructor(
    private readonly repository?: SqliteLogRepository,
    private readonly defaultPolicy: RetentionPolicy = DEFAULT_RETENTION_POLICY
  ) {}

  /**
   * Executes retention policy cleanup.
   * Telemetry failure isolation guarantees this method never crashes the host runtime.
   */
  async clean(policy?: RetentionPolicy): Promise<Result<CleanupResult, DatabaseError>> {
    if (!this.repository) {
      return ok({
        logsDeleted: 0,
        eventsDeleted: 0,
        cleanedAt: new Date().toISOString(),
      });
    }

    const maxLogDays = policy?.maxLogAgeDays ?? this.defaultPolicy.maxLogAgeDays ?? 30;
    const maxEventDays = policy?.maxEventAgeDays ?? this.defaultPolicy.maxEventAgeDays ?? 90;
    const maxLogRecords = policy?.maxLogRecords ?? this.defaultPolicy.maxLogRecords ?? 50_000;
    const maxEventRecords = policy?.maxEventRecords ?? this.defaultPolicy.maxEventRecords ?? 100_000;

    const now = Date.now();
    const logCutoffIso = new Date(now - maxLogDays * 86_400_000).toISOString();
    const eventCutoffIso = new Date(now - maxEventDays * 86_400_000).toISOString();

    try {
      const logRes = await this.repository.cleanLogs(logCutoffIso, maxLogRecords);
      const logsDeleted = logRes.success ? logRes.data : 0;

      const eventRes = await this.repository.cleanEvents(eventCutoffIso, maxEventRecords);
      const eventsDeleted = eventRes.success ? eventRes.data : 0;

      return ok({
        logsDeleted,
        eventsDeleted,
        cleanedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      // Telemetry failure isolation
      console.error("Retention cleaner encountered non-fatal error:", err);
      return ok({
        logsDeleted: 0,
        eventsDeleted: 0,
        cleanedAt: new Date().toISOString(),
      });
    }
  }
}
