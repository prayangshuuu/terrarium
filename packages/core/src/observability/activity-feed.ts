/**
 * @terrarium/core - observability/activity-feed.ts
 *
 * Separates human-facing activity milestones from internal low-level diagnostic logs.
 * Formats domain events into structured, readable activity entries.
 * Aligns with PLAN.md Section 18 & 16 and Prompt 13 requirements.
 */

import {
  type DomainEvent,
  type ActivityFeedItem,
} from "@terrarium/contracts";

// Events that represent notable milestones for human operators
const MILESTONE_EVENT_TYPES = new Set([
  "task:created",
  "task:completed",
  "task:failed",
  "task:cancelled",
  "approval:requested",
  "approval:approved",
  "approval:rejected",
  "budget:exceeded",
  "budget:paused_approval",
  "artifact:generated",
  "artifact:published",
  "report:generated",
]);

/**
 * Derives a human-friendly narrative summary from a domain event.
 */
export function formatActivitySummary(event: DomainEvent): string {
  const p = event.payload ?? {};

  switch (event.eventType) {
    case "task:created":
      return `Task initiated: ${p.title ? `"${p.title}"` : event.entityId}`;
    case "task:completed":
      return `Task completed successfully`;
    case "task:failed":
      return `Task failed: ${p.reason ?? p.error ?? "Unknown error"}`;
    case "task:cancelled":
      return `Task cancelled by operator`;
    case "step:started":
      return `Step started by ${p.agentSlug ?? "agent"}: ${p.title ? `"${p.title}"` : event.entityId}`;
    case "step:completed":
      return `Step finished by ${p.agentSlug ?? "agent"}`;
    case "step:failed":
      return `Step execution failed: ${p.reason ?? p.error ?? "Failed"}`;
    case "tool:invoked":
      return `Tool executed: ${p.toolId ?? event.entityId}`;
    case "tool:succeeded":
      return `Tool completed: ${p.toolId ?? event.entityId}`;
    case "tool:failed":
      return `Tool failed: ${p.toolId ?? event.entityId} (${p.error ?? "error"})`;
    case "tool:blocked":
      return `Tool blocked by permission policy: ${p.toolId ?? event.entityId}`;
    case "approval:requested":
      return `Approval required for ${p.actionType ?? "action"} (${p.riskLevel ?? "high"} risk)`;
    case "approval:approved":
      return `Approval granted by operator`;
    case "approval:rejected":
      return `Approval rejected by operator`;
    case "budget:warning":
      return `Budget warning: consumption reached 80% threshold`;
    case "budget:exceeded":
      return `Budget limit reached: operations constrained`;
    case "budget:paused_approval":
      return `Budget limit reached — approval requested for additional spend`;
    case "model:routed":
      return `Routed to ${p.modelId ?? "model"} (${p.tier ?? "tier"})`;
    case "memory:recorded":
      return `Recorded durable memory: ${p.key ?? event.entityId} (${p.category ?? "project"})`;
    case "artifact:generated":
      return `Artifact generated: ${p.title ? `"${p.title}"` : event.entityId}`;
    case "artifact:published":
      return `Artifact published for project consumption`;
    case "report:generated":
      return `Executive report synthesized: ${p.title ? `"${p.title}"` : event.entityId}`;
    default:
      return `${event.eventType.replace(/[_:]/g, " ")} on ${event.entityType} (${event.entityId})`;
  }
}

/**
 * Transforms a raw domain event into a formatted activity feed item.
 */
export function eventToActivityItem(event: DomainEvent): ActivityFeedItem {
  const actor =
    (event.payload?.agentSlug as string) ??
    (event.payload?.requestedByAgentId as string) ??
    event.source ??
    "system";

  const isMilestone = MILESTONE_EVENT_TYPES.has(event.eventType);

  return {
    id: event.id,
    timestamp: event.timestamp,
    eventType: event.eventType,
    actor,
    summary: formatActivitySummary(event),
    status: (event.payload?.status as string) ?? undefined,
    taskId: (event.payload?.taskId as string) ?? undefined,
    durationMs: event.durationMs,
    metadata: event.payload,
    isMilestone,
  };
}

export class ActivityFeed {
  private readonly items: ActivityFeedItem[] = [];

  constructor(private readonly maxItems = 1_000) {}

  /**
   * Ingests a domain event into the activity feed.
   * Internal diagnostic events are ignored unless explicitly flagged.
   */
  ingest(event: DomainEvent): ActivityFeedItem | null {
    if (event.isDiagnostic) {
      return null; // Skip noisy diagnostic logs
    }

    const item = eventToActivityItem(event);
    if (this.items.length >= this.maxItems) {
      this.items.shift();
    }
    this.items.push(item);
    return item;
  }

  /**
   * Returns recent activity items with optional milestone or task filtering.
   */
  getItems(options?: {
    taskId?: string;
    milestonesOnly?: boolean;
    limit?: number;
  }): readonly ActivityFeedItem[] {
    let result = this.items;

    if (options?.taskId) {
      result = result.filter((i) => i.taskId === options.taskId);
    }
    if (options?.milestonesOnly) {
      result = result.filter((i) => i.isMilestone);
    }

    const limit = options?.limit ?? 50;
    return result.slice(-limit).reverse();
  }

  clear(): void {
    this.items.length = 0;
  }
}
