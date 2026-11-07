/**
 * @terrarium/core - memory/conflict-detector.ts
 *
 * Conflict detection engine for project memory items.
 * Prevents silent overwriting and ensures contradictory assertions surface as conflicts.
 * Aligns with PLAN.md Section 14 and Section 2 (Preserved Specialist Disagreement).
 */

import { type MemoryItem } from "@terrarium/contracts";

export interface ConflictDetectionResult {
  readonly hasConflict: boolean;
  readonly isIdentical: boolean;
  readonly conflictingItem?: MemoryItem;
  readonly reason?: string;
}

/**
 * Normalizes text for basic similarity and comparison by lowercasing and collapsing whitespace.
 */
function normalizeContent(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Detects whether an incoming memory assertion conflicts with an existing memory item.
 * Never allows silent clobbering of previously confirmed decisions or requirements.
 */
export function detectMemoryConflict(
  existingItem: MemoryItem,
  incomingContent: string,
  incomingConfidence = "confirmed"
): ConflictDetectionResult {
  const existingNorm = normalizeContent(existingItem.content);
  const incomingNorm = normalizeContent(incomingContent);

  // 1. Identical content is not a conflict (idempotent write or revalidation)
  if (existingNorm === incomingNorm) {
    return {
      hasConflict: false,
      isIdentical: true,
      conflictingItem: existingItem,
    };
  }

  // 2. If existing memory is already marked superseded or archived, new memory can replace it without active conflict
  if (existingItem.isArchived || existingItem.freshnessStatus === "superseded") {
    return {
      hasConflict: false,
      isIdentical: false,
      conflictingItem: existingItem,
    };
  }

  // 3. If existing memory is confirmed fact and incoming is unverified hypothesis that diverges
  if (existingItem.confidence === "confirmed" && incomingConfidence !== "confirmed") {
    return {
      hasConflict: true,
      isIdentical: false,
      conflictingItem: existingItem,
      reason: `Incoming '${incomingConfidence}' contradicts durable confirmed fact '${existingItem.id}' without revalidation.`,
    };
  }

  // 4. Content divergence on the same key
  return {
    hasConflict: true,
    isIdentical: false,
    conflictingItem: existingItem,
    reason: `Divergent content for key '${existingItem.key}' in category '${existingItem.category}'. Existing: "${existingItem.content.slice(
      0,
      80
    )}...", Incoming: "${incomingContent.slice(0, 80)}..."`,
  };
}
