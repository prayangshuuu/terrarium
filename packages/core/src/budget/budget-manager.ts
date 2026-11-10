/**
 * @terrarium/core - budget/budget-manager.ts
 *
 * Central coordinator for budget limits, concurrent reservations, spend accounting,
 * operational bounds, and approval gates on limit exhaustion.
 * Aligns strictly with PLAN.md Section 13 & 17 and PLAN_CONTEXT.md Section 8.
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
  type DomainEvent,
  BudgetExceededError,
  BudgetExhaustedError,
  TerrariumError,
  ApprovalRequiredError,
} from "@terrarium/contracts";
import { BudgetLedger, type ReserveBudgetOptions, type CommitUsageOptions } from "./budget-ledger.js";
import { BoundsEnforcer } from "./bounds-enforcer.js";
import { ApprovalManager } from "../approvals/approval-manager.js";

export type BudgetEventListener = (event: DomainEvent) => void | Promise<void>;

export interface BudgetManagerOptions {
  readonly repository?: BudgetRepository;
  readonly approvals?: ApprovalManager;
  readonly approvalManager?: ApprovalManager;
  readonly onEvent?: BudgetEventListener;
}

export interface ReserveBudgetRequest {
  readonly scope?: BudgetScope;
  readonly targetId?: string;
  readonly taskId?: string;
  readonly agentSlug?: string;
  readonly estimatedTokens?: number;
  readonly estimatedSpendUsd?: number;
  readonly ttlMs?: number;
}

export interface CommitUsageRequest {
  readonly reservationId: string;
  readonly taskId?: string;
  readonly agentSlug?: string;
  readonly scope?: BudgetScope;
  readonly targetId?: string;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly usage: {
    readonly promptTokens?: number;
    readonly completionTokens?: number;
    readonly totalTokens: number;
    readonly estimatedCostUsd?: number;
  };
}

export class BudgetManager {
  readonly ledger: BudgetLedger;
  readonly bounds: BoundsEnforcer;
  private readonly approvalManager?: ApprovalManager;
  private readonly onEvent?: BudgetEventListener;

  constructor(options?: BudgetManagerOptions) {
    this.ledger = new BudgetLedger(options?.repository);
    this.bounds = new BoundsEnforcer();
    this.approvalManager = options?.approvalManager ?? options?.approvals;
    this.onEvent = options?.onEvent;
  }

  private dispatchEvent(
    eventType: DomainEvent["eventType"],
    entityId: string,
    payload?: Record<string, unknown>
  ): void {
    if (!this.onEvent) return;

    const event: DomainEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      eventType,
      source: "system",
      entityType: "Budget",
      entityId,
      payload,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = this.onEvent(event);
      if (res instanceof Promise) {
        res.catch((err) => console.error("Budget event listener error:", err));
      }
    } catch (err) {
      console.error("Budget event dispatch failed:", err);
    }
  }

  async setConfig(config: BudgetConfig): Promise<Result<BudgetConfig, TerrariumError>> {
    return this.ledger.setConfig(config);
  }

  async getConfig(scope: BudgetScope, targetId = "default"): Promise<Result<BudgetConfig, TerrariumError>> {
    const res = await this.ledger.getConfig(scope, targetId);
    if (!res.success) return res;
    if (res.data) return ok(res.data);

    // Return sensible default configuration
    const defaultConfig: BudgetConfig = {
      scope,
      targetId,
      maxTokens: 100_000,
      maxSpendUsd: 5.0,
      maxDurationMs: 300_000,
      maxConcurrency: 5,
      maxDelegationDepth: 3,
      maxRetries: 3,
      maxDebateRounds: 3,
      warningThresholdPercent: 80,
      isHardLimit: true,
      onLimitExceeded: "stop",
    };
    return ok(defaultConfig);
  }

  async getSummary(scope: BudgetScope, targetId = "default"): Promise<Result<BudgetSummary, TerrariumError>> {
    const summaryRes = await this.ledger.getSummary(scope, targetId);
    if (!summaryRes.success) return summaryRes;

    const activeConcurrency = this.bounds.getActiveConcurrency(scope, targetId);
    return ok({
      ...summaryRes.data,
      activeConcurrency,
    });
  }

  /**
   * Evaluates budget status and executes configured limit action on exhaustion.
   */
  async checkBudget(
    scope: BudgetScope,
    targetId = "default",
    actionContext?: { taskId?: string; description?: string }
  ): Promise<Result<BudgetSummary, TerrariumError>> {
    const summaryRes = await this.getSummary(scope, targetId);
    if (!summaryRes.success) return summaryRes;
    const summary = summaryRes.data;

    const configRes = await this.getConfig(scope, targetId);
    const config = configRes.success ? configRes.data : null;

    if (summary.isWarning) {
      this.dispatchEvent("budget:warning", `${scope}:${targetId}`, {
        usedTokens: summary.usedTokens,
        usedSpendUsd: summary.usedSpendUsd,
        allocatedTokens: summary.allocatedTokens,
        allocatedSpendUsd: summary.allocatedSpendUsd,
      });
    }

    if (summary.isExceeded) {
      this.dispatchEvent("budget:exceeded", `${scope}:${targetId}`, {
        usedTokens: summary.usedTokens,
        usedSpendUsd: summary.usedSpendUsd,
      });

      const onLimit = config?.onLimitExceeded ?? "stop";

      if (onLimit === "pause_and_request_approval" && this.approvalManager && actionContext?.taskId) {
        // Create an inspectable approval request to override budget limit
        const approvalRes = await this.approvalManager.createRequest({
          taskId: actionContext.taskId,
          actionType: "budget_override",
          description: `Budget limit exceeded for ${scope} '${targetId}'. ${actionContext.description ?? "Requesting additional budget approval."}`,
          toolId: "system.budget_override",
          riskLevel: "high",
          requestedByAgentId: "system.budget_manager",
          payload: {
            scope,
            targetId,
            currentTokens: summary.usedTokens,
            currentSpendUsd: summary.usedSpendUsd,
            requestedLimitIncreaseUsd: 1.0,
          },
        });

        if (approvalRes.success) {
          this.dispatchEvent("budget:paused_approval", approvalRes.data.id, {
            approvalId: approvalRes.data.id,
            scope,
            targetId,
          });
          return fail(new ApprovalRequiredError(approvalRes.data.id, "budget_manager", "budget_override"));
        }
      }

      if (onLimit === "stop" && config?.isHardLimit) {
        return fail(
          new BudgetExceededError(
            scope,
            summary.usedSpendUsd,
            config.maxSpendUsd ?? config.maxTokens ?? 0,
            config.maxSpendUsd !== undefined ? "usd" : "tokens"
          )
        );
      }
    }

    return ok(summary);
  }

  /**
   * Reserves estimated budget under concurrency. Supports both object request and positional arguments.
   */
  async reserve(
    scopeOrReq: BudgetScope | ReserveBudgetRequest,
    targetId = "default",
    tokens = 0,
    spendUsd = 0,
    options?: ReserveBudgetOptions
  ): Promise<Result<BudgetReservation, TerrariumError>> {
    let scope: BudgetScope = "task";
    let tid = targetId;
    let tok = tokens;
    let spend = spendUsd;
    let opts = options;

    if (typeof scopeOrReq === "object") {
      scope = scopeOrReq.scope ?? "task";
      tid = scopeOrReq.targetId ?? scopeOrReq.taskId ?? "default";
      tok = scopeOrReq.estimatedTokens ?? 0;
      spend = scopeOrReq.estimatedSpendUsd ?? 0;
      opts = scopeOrReq.ttlMs ? { ttlMs: scopeOrReq.ttlMs } : undefined;
    } else {
      scope = scopeOrReq;
    }

    // Check budget limits first before reserving, to handle pause_and_request_approval or hard limit
    const configRes = await this.getConfig(scope, tid);
    const config = configRes.success ? configRes.data : null;
    const summaryRes = await this.getSummary(scope, tid);

    if (config && summaryRes.success) {
      const summary = summaryRes.data;
      const totalTokensAfter = summary.usedTokens + summary.reservedTokens + tok;
      const totalSpendAfter = summary.usedSpendUsd + summary.reservedSpendUsd + spend;

      const isTokenExceeded = config.maxTokens !== undefined && totalTokensAfter > config.maxTokens;
      const isSpendExceeded = config.maxSpendUsd !== undefined && totalSpendAfter > config.maxSpendUsd;

      if (isTokenExceeded || isSpendExceeded) {
        if (config.onLimitExceeded === "pause_and_request_approval" && this.approvalManager) {
          const taskId = typeof scopeOrReq === "object" ? (scopeOrReq.taskId ?? tid) : tid;
          const approvalRes = await this.approvalManager.createRequest({
            taskId,
            actionType: "budget_override",
            description: `Budget limit reached for ${scope} '${tid}'. Reservation of ${tok} tokens requires approval.`,
            toolId: "system.budget_override",
            riskLevel: "high",
            requestedByAgentId: typeof scopeOrReq === "object" ? (scopeOrReq.agentSlug ?? "system") : "system",
            payload: {
              scope,
              targetId: tid,
              currentTokens: summary.usedTokens,
              requestedTokens: tok,
              currentSpendUsd: summary.usedSpendUsd,
              requestedSpendUsd: spend,
            },
          });

          if (approvalRes.success) {
            this.dispatchEvent("budget:paused_approval", approvalRes.data.id, {
              approvalId: approvalRes.data.id,
              scope,
              targetId: tid,
            });
            return fail(new ApprovalRequiredError(approvalRes.data.id, "system.budget_override", "budget_override"));
          }
        }

        if (config.isHardLimit) {
          return fail(
            new BudgetExhaustedError(
              scope,
              isSpendExceeded ? totalSpendAfter : totalTokensAfter,
              isSpendExceeded ? (config.maxSpendUsd ?? 0) : (config.maxTokens ?? 0),
              isSpendExceeded ? "usd" : "tokens"
            )
          );
        }
      }
    }

    const res = await this.ledger.reserve(scope, tid, tok, spend, opts);
    if (res.success) {
      this.dispatchEvent("budget:reserved", res.data.id, {
        scope,
        targetId: tid,
        reservedTokens: tok,
        reservedSpendUsd: spend,
      });
    }
    return res;
  }

  /**
   * Commits actual usage from a completed model invocation.
   */
  async commit(
    reservationId: string,
    actualTokens: number,
    actualSpendUsd: number,
    options?: CommitUsageOptions
  ): Promise<Result<BudgetLedgerEntry, TerrariumError>> {
    const res = await this.ledger.commit(reservationId, actualTokens, actualSpendUsd, options);
    if (res.success) {
      this.dispatchEvent("budget:committed", res.data.id, {
        tokens: actualTokens,
        spendUsd: actualSpendUsd,
      });
    }
    return res;
  }

  /**
   * High-level commit usage method taking a structured commit request.
   */
  async commitUsage(req: CommitUsageRequest): Promise<Result<BudgetLedgerEntry, TerrariumError>> {
    return this.commit(req.reservationId, req.usage.totalTokens, req.usage.estimatedCostUsd ?? 0, {
      modelId: req.modelId,
      providerId: req.providerId,
    });
  }

  /**
   * Releases an unused reservation.
   */
  async release(reservationId: string): Promise<Result<boolean, TerrariumError>> {
    const res = await this.ledger.release(reservationId);
    if (res.success) {
      this.dispatchEvent("budget:released", reservationId);
    }
    return res;
  }

  /**
   * High-level release alias supporting optional reason.
   */
  async releaseReservation(reservationId: string, reason?: string): Promise<Result<boolean, TerrariumError>> {
    return this.release(reservationId);
  }
}
