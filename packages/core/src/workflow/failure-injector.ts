/**
 * @terrarium/core - workflow/failure-injector.ts
 *
 * Deterministic failure injection harness for end-to-end resilience and reliability testing.
 * Simulates cancellation, timeouts, provider outages, rate limits, malformed schemas,
 * budget exhaustion, and approval rejections.
 * Contributed by A2 (Orchestration & AI Runtime).
 */

import { type WorkflowFailureMode, type WorkflowStage } from "@terrarium/contracts";

export interface FailureInjectionConfig {
  readonly failAtStage?: WorkflowStage;
  readonly failureMode?: WorkflowFailureMode;
  readonly errorMessage?: string;
  readonly providerStatusCode?: number;
  readonly delayMs?: number;
  readonly partialCompletionSteps?: number;
}

export class WorkflowFailureInjector {
  private readonly config: FailureInjectionConfig;
  private triggered = false;

  constructor(config: FailureInjectionConfig) {
    this.config = config;
  }

  get targetStage(): WorkflowStage | undefined {
    return this.config.failAtStage;
  }

  get failureMode(): WorkflowFailureMode | undefined {
    return this.config.failureMode;
  }

  get delayMs(): number {
    return this.config.delayMs ?? 0;
  }

  get partialCompletionSteps(): number | undefined {
    return this.config.partialCompletionSteps;
  }

  shouldFailAt(stage: WorkflowStage): boolean {
    if (this.config.failAtStage === stage && !this.triggered) {
      this.triggered = true;
      return true;
    }
    return false;
  }

  getErrorMessage(defaultMessage: string): string {
    return this.config.errorMessage ?? defaultMessage;
  }

  getProviderStatusCode(): number {
    return this.config.providerStatusCode ?? 500;
  }

  reset(): void {
    this.triggered = false;
  }
}
