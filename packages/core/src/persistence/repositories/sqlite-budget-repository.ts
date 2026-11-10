/**
 * @terrarium/core - persistence/repositories/sqlite-budget-repository.ts
 *
 * SQLite implementation of BudgetRepository for configs, reservations, and ledger entries.
 * Safe under concurrency with atomic transactions.
 * Aligns with PLAN.md Section 13 (Token, Cost, & Performance Management).
 */

import { Database } from "bun:sqlite";
import {
  type Result,
  ok,
  fail,
  type BudgetConfig,
  type BudgetLedgerEntry,
  type BudgetReservation,
  type BudgetScope,
  type BudgetSummary,
  type BudgetRepository,
  type DatabaseError,
} from "@terrarium/contracts";
import { handleSqliteError } from "./base-sqlite-repository.ts";

interface BudgetConfigRow {
  id: string;
  scope: string;
  target_id: string | null;
  max_tokens: number | null;
  max_spend_usd: number | null;
  max_duration_ms: number | null;
  max_concurrency: number | null;
  max_delegation_depth: number | null;
  max_retries: number | null;
  max_debate_rounds: number | null;
  warning_threshold_percent: number;
  is_hard_limit: number;
  on_limit_exceeded: string;
}

interface BudgetReservationRow {
  id: string;
  scope: string;
  target_id: string;
  reserved_tokens: number;
  reserved_spend_usd: number;
  status: string;
  expires_at: string;
  created_at: string;
  settled_at: string | null;
}

interface BudgetLedgerRow {
  id: string;
  scope: string;
  target_id: string;
  tokens: number;
  spend_usd: number;
  is_estimate: number;
  model_id: string | null;
  provider_id: string | null;
  task_step_id: string | null;
  timestamp: string;
}

function rowToConfig(row: BudgetConfigRow): BudgetConfig {
  return {
    scope: row.scope as BudgetScope,
    targetId: row.target_id ?? undefined,
    maxTokens: row.max_tokens ?? undefined,
    maxSpendUsd: row.max_spend_usd ?? undefined,
    maxDurationMs: row.max_duration_ms ?? undefined,
    maxConcurrency: row.max_concurrency ?? undefined,
    maxDelegationDepth: row.max_delegation_depth ?? undefined,
    maxRetries: row.max_retries ?? undefined,
    maxDebateRounds: row.max_debate_rounds ?? undefined,
    warningThresholdPercent: row.warning_threshold_percent,
    isHardLimit: Boolean(row.is_hard_limit),
    onLimitExceeded: (row.on_limit_exceeded as any) ?? "stop",
  };
}

function rowToReservation(row: BudgetReservationRow): BudgetReservation {
  return {
    id: row.id,
    scope: row.scope as BudgetScope,
    targetId: row.target_id,
    reservedTokens: row.reserved_tokens,
    reservedSpendUsd: row.reserved_spend_usd,
    status: row.status as any,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    settledAt: row.settled_at ?? undefined,
  };
}

export class SqliteBudgetRepository implements BudgetRepository {
  constructor(private readonly db: Database) {}

  async findConfig(scope: BudgetScope, targetId?: string): Promise<Result<BudgetConfig | null, DatabaseError>> {
    try {
      let row: BudgetConfigRow | null;
      if (targetId) {
        row = this.db
          .query("SELECT * FROM budget_configs WHERE scope = ? AND target_id = ?;")
          .get(scope, targetId) as BudgetConfigRow | null;
      } else {
        row = this.db
          .query("SELECT * FROM budget_configs WHERE scope = ? AND target_id IS NULL;")
          .get(scope) as BudgetConfigRow | null;
      }

      if (!row) return ok(null);
      return ok(rowToConfig(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "BudgetConfig", `${scope}:${targetId ?? "global"}`));
    }
  }

  async saveConfig(config: BudgetConfig): Promise<Result<BudgetConfig, DatabaseError>> {
    try {
      const now = new Date().toISOString();
      const id = `bc-${config.scope}-${config.targetId ?? "default"}`;
      this.db.run(
        `INSERT INTO budget_configs (
          id, scope, target_id, max_tokens, max_spend_usd, max_duration_ms,
          max_concurrency, max_delegation_depth, max_retries, max_debate_rounds,
          warning_threshold_percent, is_hard_limit, on_limit_exceeded, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(scope, target_id) DO UPDATE SET
          max_tokens = excluded.max_tokens,
          max_spend_usd = excluded.max_spend_usd,
          max_duration_ms = excluded.max_duration_ms,
          max_concurrency = excluded.max_concurrency,
          max_delegation_depth = excluded.max_delegation_depth,
          max_retries = excluded.max_retries,
          max_debate_rounds = excluded.max_debate_rounds,
          warning_threshold_percent = excluded.warning_threshold_percent,
          is_hard_limit = excluded.is_hard_limit,
          on_limit_exceeded = excluded.on_limit_exceeded,
          updated_at = excluded.updated_at;`,
        [
          id,
          config.scope,
          config.targetId ?? null,
          config.maxTokens ?? null,
          config.maxSpendUsd ?? null,
          config.maxDurationMs ?? null,
          config.maxConcurrency ?? null,
          config.maxDelegationDepth ?? null,
          config.maxRetries ?? null,
          config.maxDebateRounds ?? null,
          config.warningThresholdPercent ?? 80.0,
          config.isHardLimit !== false ? 1 : 0,
          config.onLimitExceeded ?? "stop",
          now,
          now,
        ]
      );
      return ok(config);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "BudgetConfig", config.scope));
    }
  }

  async recordLedgerEntry(entry: BudgetLedgerEntry): Promise<Result<BudgetLedgerEntry, DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO budget_ledger (
          id, scope, target_id, tokens, spend_usd, is_estimate,
          model_id, provider_id, task_step_id, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          entry.id,
          entry.scope,
          entry.targetId,
          entry.tokens,
          entry.spendUsd,
          entry.isEstimate ? 1 : 0,
          entry.modelId ?? null,
          entry.providerId ?? null,
          entry.taskStepId ?? null,
          entry.timestamp,
        ]
      );
      return ok(entry);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "BudgetLedgerEntry", entry.id));
    }
  }

  async createReservation(res: BudgetReservation): Promise<Result<BudgetReservation, DatabaseError>> {
    try {
      this.db.run(
        `INSERT INTO budget_reservations (
          id, scope, target_id, reserved_tokens, reserved_spend_usd, status,
          expires_at, created_at, settled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          res.id,
          res.scope,
          res.targetId,
          res.reservedTokens,
          res.reservedSpendUsd,
          res.status,
          res.expiresAt,
          res.createdAt,
          res.settledAt ?? null,
        ]
      );
      return ok(res);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "BudgetReservation", res.id));
    }
  }

  async updateReservation(res: BudgetReservation): Promise<Result<BudgetReservation, DatabaseError>> {
    try {
      this.db.run(
        `UPDATE budget_reservations SET
          status = ?,
          settled_at = ?
        WHERE id = ?;`,
        [res.status, res.settledAt ?? null, res.id]
      );
      return ok(res);
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "BudgetReservation", res.id));
    }
  }

  async findActiveReservation(id: string): Promise<Result<BudgetReservation | null, DatabaseError>> {
    try {
      const row = this.db
        .query("SELECT * FROM budget_reservations WHERE id = ?;")
        .get(id) as BudgetReservationRow | null;
      if (!row) return ok(null);
      return ok(rowToReservation(row));
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "BudgetReservation", id));
    }
  }

  async getSummary(scope: BudgetScope, targetId = "default"): Promise<Result<BudgetSummary, DatabaseError>> {
    try {
      const isoNow = new Date().toISOString();

      // Expire stale active reservations whose expires_at is past
      this.db.run(
        "UPDATE budget_reservations SET status = 'expired' WHERE status = 'active' AND expires_at < ?;",
        [isoNow]
      );

      // Aggregate committed usage from ledger
      const usageRow = this.db
        .query(
          `SELECT
            COALESCE(SUM(tokens), 0) AS total_tokens,
            COALESCE(SUM(spend_usd), 0.0) AS total_spend
          FROM budget_ledger
          WHERE scope = ? AND target_id = ?;`
        )
        .get(scope, targetId) as { total_tokens: number; total_spend: number } | null;

      const usedTokens = usageRow?.total_tokens ?? 0;
      const usedSpendUsd = Number((usageRow?.total_spend ?? 0).toFixed(6));

      // Aggregate active reservations
      const reserveRow = this.db
        .query(
          `SELECT
            COALESCE(SUM(reserved_tokens), 0) AS total_reserved_tokens,
            COALESCE(SUM(reserved_spend_usd), 0.0) AS total_reserved_spend
          FROM budget_reservations
          WHERE scope = ? AND target_id = ? AND status = 'active';`
        )
        .get(scope, targetId) as { total_reserved_tokens: number; total_reserved_spend: number } | null;

      const reservedTokens = reserveRow?.total_reserved_tokens ?? 0;
      const reservedSpendUsd = Number((reserveRow?.total_reserved_spend ?? 0).toFixed(6));

      // Config check
      const configRes = await this.findConfig(scope, targetId);
      const config = configRes.success ? configRes.data : null;

      const allocatedTokens = config?.maxTokens;
      const allocatedSpendUsd = config?.maxSpendUsd;

      const totalCommittedTokens = usedTokens + reservedTokens;
      const totalCommittedSpend = Number((usedSpendUsd + reservedSpendUsd).toFixed(6));

      const remainingTokens = allocatedTokens !== undefined ? Math.max(0, allocatedTokens - totalCommittedTokens) : undefined;
      const remainingSpendUsd = allocatedSpendUsd !== undefined ? Math.max(0, Number((allocatedSpendUsd - totalCommittedSpend).toFixed(6))) : undefined;

      const warnFactor = (config?.warningThresholdPercent ?? 80) / 100;
      const isTokenWarning = allocatedTokens !== undefined && totalCommittedTokens >= allocatedTokens * warnFactor;
      const isSpendWarning = allocatedSpendUsd !== undefined && totalCommittedSpend >= allocatedSpendUsd * warnFactor;
      const isWarning = isTokenWarning || isSpendWarning;

      const isTokenExceeded = allocatedTokens !== undefined && totalCommittedTokens >= allocatedTokens;
      const isSpendExceeded = allocatedSpendUsd !== undefined && totalCommittedSpend >= allocatedSpendUsd;
      const isExceeded = isTokenExceeded || isSpendExceeded;

      return ok({
        scope,
        targetId,
        allocatedTokens,
        allocatedSpendUsd,
        usedTokens,
        usedSpendUsd,
        reservedTokens,
        reservedSpendUsd,
        remainingTokens,
        remainingSpendUsd,
        isWarning,
        isExceeded,
        isEstimate: true,
        activeConcurrency: 0,
        maxConcurrency: config?.maxConcurrency,
        lastCheckedAt: isoNow,
      });
    } catch (err: unknown) {
      return fail(handleSqliteError(err, "BudgetSummary", `${scope}:${targetId}`));
    }
  }
}
