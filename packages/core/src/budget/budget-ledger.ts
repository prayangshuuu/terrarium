/**
 * @terrarium/core - budget/budget-ledger.ts
 *
 * Concurrency-safe budget ledger and reservation management.
 * Prevents race conditions during simultaneous agent executions and guarantees
 * atomic accounting of tokens and dollar spend under concurrency.
 * Aligns with PLAN.md Section 13 & PLAN_CONTEXT.md Section 8.
 */

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
  ReservationExhaustedError,
  TerrariumError,
} from "@terrarium/contracts";

export interface ReserveBudgetOptions {
  readonly ttlMs?: number; // Default: 60,000ms (1 minute)
}

export interface CommitUsageOptions {
  readonly modelId?: string;
  readonly providerId?: string;
  readonly taskStepId?: string;
  readonly isEstimate?: boolean;
}

export class BudgetLedger {
  private readonly repository?: BudgetRepository;

  // In-memory fallback structures
  private readonly configs: Map<string, BudgetConfig> = new Map();
  private readonly reservations: Map<string, BudgetReservation> = new Map();
  private readonly ledger: BudgetLedgerEntry[] = [];

  // Mutex lock for atomic operations in memory
  private lockPromise: Promise<void> = Promise.resolve();

  constructor(repository?: BudgetRepository) {
    this.repository = repository;
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    let releaseLock: () => void;
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const previousLock = this.lockPromise;
    this.lockPromise = nextLock;

    await previousLock;
    try {
      return await operation();
    } finally {
      releaseLock!();
    }
  }

  private makeKey(scope: BudgetScope, targetId = "default"): string {
    return `${scope}:${targetId}`;
  }

  async setConfig(config: BudgetConfig): Promise<Result<BudgetConfig, TerrariumError>> {
    if (this.repository) {
      return this.repository.saveConfig(config);
    }
    const key = this.makeKey(config.scope, config.targetId);
    this.configs.set(key, config);
    return ok(config);
  }

  async getConfig(scope: BudgetScope, targetId = "default"): Promise<Result<BudgetConfig | null, TerrariumError>> {
    if (this.repository) {
      return this.repository.findConfig(scope, targetId);
    }
    const key = this.makeKey(scope, targetId);
    return ok(this.configs.get(key) ?? null);
  }

  /**
   * Reserves a budget slice atomically, checking limits before granting the reservation.
   * Prevents concurrency races and overspending when multiple agents run in parallel.
   */
  async reserve(
    scope: BudgetScope,
    targetId = "default",
    tokens = 0,
    spendUsd = 0,
    options?: ReserveBudgetOptions
  ): Promise<Result<BudgetReservation, TerrariumError>> {
    return this.withLock(async () => {
      const summaryRes = await this.getSummary(scope, targetId);
      if (!summaryRes.success) return summaryRes;
      const summary = summaryRes.data;

      const safeSpend = typeof spendUsd === "number" && !isNaN(spendUsd) ? spendUsd : 0;
      const safeTokens = typeof tokens === "number" && !isNaN(tokens) ? tokens : 0;

      const configRes = await this.getConfig(scope, targetId);
      const config = configRes.success ? configRes.data : null;

      // Check if requested reservation would exceed hard limits
      if (config?.isHardLimit) {
        if (config.maxTokens !== undefined) {
          const availableTokens = Math.max(
            0,
            config.maxTokens - (summary.usedTokens + summary.reservedTokens)
          );
          if (safeTokens > availableTokens) {
            return fail(new ReservationExhaustedError(scope, safeTokens, availableTokens));
          }
        }

        if (config.maxSpendUsd !== undefined && safeSpend > 0) {
          const availableSpend = Math.max(
            0,
            config.maxSpendUsd - (summary.usedSpendUsd + summary.reservedSpendUsd)
          );
          if (safeSpend > availableSpend) {
            return fail(new ReservationExhaustedError(scope, Math.round(safeSpend * 100), Math.round(availableSpend * 100)));
          }
        }
      }

      const isoNow = new Date().toISOString();
      const ttlMs = options?.ttlMs ?? 60_000;
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();

      const reservation: BudgetReservation = {
        id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        scope,
        targetId,
        reservedTokens: safeTokens,
        reservedSpendUsd: Number(safeSpend.toFixed(6)),
        status: "active",
        expiresAt,
        createdAt: isoNow,
      };

      if (this.repository) {
        const createRes = await this.repository.createReservation(reservation);
        if (!createRes.success) return fail(createRes.error);
      } else {
        this.reservations.set(reservation.id, reservation);
      }

      return ok(reservation);
    });
  }

  /**
   * Commits actual usage, releasing the reservation and recording the transaction in the ledger.
   */
  async commit(
    reservationId: string,
    actualTokens: number,
    actualSpendUsd: number,
    options?: CommitUsageOptions
  ): Promise<Result<BudgetLedgerEntry, TerrariumError>> {
    return this.withLock(async () => {
      const isoNow = new Date().toISOString();
      let reservation: BudgetReservation | null = null;

      if (this.repository) {
        const resCheck = await this.repository.findActiveReservation(reservationId);
        if (!resCheck.success) return fail(resCheck.error);
        reservation = resCheck.data;
      } else {
        reservation = this.reservations.get(reservationId) ?? null;
      }

      if (!reservation) {
        return fail(new TerrariumError(`Reservation '${reservationId}' not found or already settled.`, "NOT_FOUND"));
      }

      // Mark reservation committed
      const updatedReservation: BudgetReservation = {
        ...reservation,
        status: "committed",
        settledAt: isoNow,
      };

      if (this.repository) {
        await this.repository.updateReservation(updatedReservation);
      } else {
        this.reservations.set(reservation.id, updatedReservation);
      }

      // Record actual usage in ledger
      const entry: BudgetLedgerEntry = {
        id: `led-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        scope: reservation.scope,
        targetId: reservation.targetId,
        tokens: actualTokens,
        spendUsd: Number(actualSpendUsd.toFixed(6)),
        isEstimate: options?.isEstimate ?? false,
        modelId: options?.modelId,
        providerId: options?.providerId,
        taskStepId: options?.taskStepId,
        timestamp: isoNow,
      };

      if (this.repository) {
        const recRes = await this.repository.recordLedgerEntry(entry);
        if (!recRes.success) return fail(recRes.error);
      } else {
        this.ledger.push(entry);
      }

      return ok(entry);
    });
  }

  /**
   * Releases an active reservation back to available budget without recording spend (e.g. on task cancellation or error).
   */
  async release(reservationId: string): Promise<Result<boolean, TerrariumError>> {
    return this.withLock(async () => {
      const isoNow = new Date().toISOString();
      let reservation: BudgetReservation | null = null;

      if (this.repository) {
        const resCheck = await this.repository.findActiveReservation(reservationId);
        if (!resCheck.success) return fail(resCheck.error);
        reservation = resCheck.data;
      } else {
        reservation = this.reservations.get(reservationId) ?? null;
      }

      if (!reservation) {
        return ok(false); // Already released or expired
      }

      const updatedReservation: BudgetReservation = {
        ...reservation,
        status: "released",
        settledAt: isoNow,
      };

      if (this.repository) {
        await this.repository.updateReservation(updatedReservation);
      } else {
        this.reservations.set(reservation.id, updatedReservation);
      }

      return ok(true);
    });
  }

  /**
   * Returns current budget and expenditure summary for a scope.
   */
  async getSummary(scope: BudgetScope, targetId = "default"): Promise<Result<BudgetSummary, TerrariumError>> {
    if (this.repository) {
      return this.repository.getSummary(scope, targetId);
    }

    const isoNow = new Date().toISOString();

    // Expire stale reservations
    for (const [id, res] of this.reservations.entries()) {
      if (res.status === "active" && res.expiresAt < isoNow) {
        this.reservations.set(id, { ...res, status: "expired" });
      }
    }

    const configKey = this.makeKey(scope, targetId);
    const config = this.configs.get(configKey) ?? null;

    let usedTokens = 0;
    let usedSpendUsd = 0;
    for (const entry of this.ledger) {
      if (entry.scope === scope && entry.targetId === targetId) {
        usedTokens += entry.tokens;
        usedSpendUsd += entry.spendUsd;
      }
    }

    let reservedTokens = 0;
    let reservedSpendUsd = 0;
    for (const res of this.reservations.values()) {
      if (res.scope === scope && res.targetId === targetId && res.status === "active") {
        reservedTokens += res.reservedTokens;
        reservedSpendUsd += res.reservedSpendUsd;
      }
    }

    usedSpendUsd = Number(usedSpendUsd.toFixed(6));
    reservedSpendUsd = Number(reservedSpendUsd.toFixed(6));

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
  }
}
