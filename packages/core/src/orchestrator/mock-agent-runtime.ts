/**
 * @terrarium/core - orchestrator/mock-agent-runtime.ts
 *
 * Deterministic mock agent runtime for bounded orchestration testing without paid API calls.
 * Simulates outputs, token metrics, evidence items, and preserved disagreements.
 * Aligns with PLAN.md Section 5 & Prompt 8 requirements.
 */

import {
  type AgentProfile,
  type DisagreementItem,
  type EvidenceItem,
  type ExecutionMetrics,
  type PlanStep,
  type Result,
  type TaskPlan,
  type UnresolvedQuestion,
  ok,
  fail,
} from "@terrarium/contracts";

export interface MockExecutionBehavior {
  readonly failStepIds?: readonly string[];
  readonly transientFailures?: Readonly<Record<string, number>>; // stepId -> count of transient failures
  readonly delayMs?: number;
  readonly simulatedMetrics?: Partial<ExecutionMetrics>;
  readonly customEvidence?: readonly EvidenceItem[];
  readonly customDisagreements?: readonly DisagreementItem[];
  readonly customUnresolvedQuestions?: readonly UnresolvedQuestion[];
}

export interface MockAgentRunResult {
  readonly output: string;
  readonly metrics: ExecutionMetrics;
  readonly evidence: readonly EvidenceItem[];
  readonly disagreements: readonly DisagreementItem[];
  readonly unresolvedQuestions: readonly UnresolvedQuestion[];
}

export class MockAgentRuntime {
  private readonly behavior: MockExecutionBehavior;
  private readonly failureCounts: Map<string, number> = new Map();

  constructor(behavior: MockExecutionBehavior = {}) {
    this.behavior = behavior;
  }

  async runStep(
    plan: TaskPlan,
    step: PlanStep,
    profile: AgentProfile,
    signal?: AbortSignal
  ): Promise<Result<MockAgentRunResult, string>> {
    if (signal?.aborted) {
      return fail("Execution aborted by cancellation signal");
    }

    if (this.behavior.delayMs && this.behavior.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.behavior.delayMs));
    }

    if (signal?.aborted) {
      return fail("Execution aborted by cancellation signal");
    }

    // Check permanent failure simulation
    if (this.behavior.failStepIds?.includes(step.id)) {
      return fail(`Simulated permanent failure for step '${step.id}' by profile '${profile.slug}'`);
    }

    // Check transient failure simulation
    const maxTransient = this.behavior.transientFailures?.[step.id] ?? 0;
    const currentFailures = this.failureCounts.get(step.id) ?? 0;
    if (currentFailures < maxTransient) {
      this.failureCounts.set(step.id, currentFailures + 1);
      return fail(
        `Simulated transient provider error (attempt ${currentFailures + 1}/${maxTransient}) for step '${step.id}'`
      );
    }

    // Generate deterministic outputs based on profile and step
    const output = `Completed step '${step.title}' using ${profile.displayName} (${profile.role}). Output verified against criteria: ${step.completionCriteria.join(
      "; "
    )}.`;

    const tokensPrompt = this.behavior.simulatedMetrics?.tokensPrompt ?? step.estimatedTokens * 0.6;
    const tokensCompletion = this.behavior.simulatedMetrics?.tokensCompletion ?? step.estimatedTokens * 0.4;
    const tokensTotal = tokensPrompt + tokensCompletion;
    const estimatedCostUsd = this.behavior.simulatedMetrics?.estimatedCostUsd ?? step.estimatedCostUsd;
    const durationMs = this.behavior.simulatedMetrics?.durationMs ?? (this.behavior.delayMs ?? 15);

    const metrics: ExecutionMetrics = {
      tokensPrompt: Math.round(tokensPrompt),
      tokensCompletion: Math.round(tokensCompletion),
      tokensTotal: Math.round(tokensTotal),
      estimatedCostUsd: Math.round(estimatedCostUsd * 1000) / 1000,
      durationMs,
    };

    // Default evidence items
    const evidence: EvidenceItem[] = this.behavior.customEvidence
      ? [...this.behavior.customEvidence]
      : [
          {
            claim: `Verification succeeded for ${step.title}`,
            confidence: profile.department === "customer_intelligence" ? "simulated" : "verified",
            sourceReference: `${profile.slug} output inspection`,
            excerpt: `All completion criteria for ${step.id} met`,
          },
        ];

    // Default disagreements if simulation or multi-department
    const disagreements: DisagreementItem[] = this.behavior.customDisagreements
      ? [...this.behavior.customDisagreements]
      : profile.department === "customer_intelligence"
      ? [
          {
            topic: "Pricing Sensitivity vs Value Perception",
            positions: [
              {
                agentId: profile.id,
                role: profile.role,
                stance: "Cautious objection to recurring overhead",
                argument: "Early adopters require immediate self-serve value before justifying monthly subscription.",
              },
            ],
            resolutionStatus: "open",
            synthesisNotes: "Preserved simulated objection for real-world user validation.",
          },
        ]
      : [];

    const unresolvedQuestions: UnresolvedQuestion[] = this.behavior.customUnresolvedQuestions
      ? [...this.behavior.customUnresolvedQuestions]
      : [];

    return ok({
      output,
      metrics,
      evidence,
      disagreements,
      unresolvedQuestions,
    });
  }
}
