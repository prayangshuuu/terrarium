/**
 * @terrarium/core - intake/request-normalizer.ts
 *
 * Normalizes user requests without mutating or altering the user's intent.
 * Aligns with PLAN.md Section 5.1 & 6.1 and Prompt 7 requirements.
 */

import { type AgentDepartment, AGENT_DEPARTMENTS, type TaskPriority, TASK_PRIORITIES } from "@terrarium/contracts";

export interface NormalizedRequest {
  readonly rawPrompt: string;
  readonly normalizedPrompt: string;
  readonly extractedFilePaths: readonly string[];
  readonly explicitDepartment?: AgentDepartment;
  readonly explicitPriority?: TaskPriority;
  readonly wordCount: number;
  readonly charCount: number;
}

/**
 * Regex matching relative or absolute file or directory paths with standard extensions or slashes.
 */
const FILE_PATH_REGEX = /(?:^|[\s"'\(`])((?:[a-zA-Z0-9_\-.]+\/)+[a-zA-Z0-9_\-.]*|[a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]{1,8}|package\.json|Dockerfile|Makefile|README\.md)(?:$|[\s"'\)`:;,])/g;

/**
 * Normalizes input text while preserving user intent, semantic terminology, and instructions.
 */
export function normalizeRequest(raw: string): NormalizedRequest {
  if (!raw || typeof raw !== "string") {
    return {
      rawPrompt: raw ?? "",
      normalizedPrompt: "",
      extractedFilePaths: [],
      wordCount: 0,
      charCount: 0,
    };
  }

  let text = raw.trim();

  // Normalize line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // If the user wrapped the whole prompt in a markdown fence, unwrap it cleanly
  const fenceMatch = text.match(/^```(?:[a-zA-Z0-9_-]*)\n([\s\S]*?)\n```$/);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
  }

  // Normalize excessive blank lines (more than 2 consecutive newlines down to 2)
  text = text.replace(/\n{3,}/g, "\n\n");

  // Extract explicit department directives if provided (e.g. @engineering, dept:engineering)
  let explicitDepartment: AgentDepartment | undefined;
  for (const dept of AGENT_DEPARTMENTS) {
    const atPattern = new RegExp(`(?:^|\\s)@(${dept})(?:\\b|\\s)`, "i");
    const prefixPattern = new RegExp(`(?:^|\\s)dept:(${dept})(?:\\b|\\s)`, "i");
    if (atPattern.test(text) || prefixPattern.test(text)) {
      explicitDepartment = dept;
      break;
    }
  }

  // Extract explicit priority if provided (e.g. priority:high, [urgent])
  let explicitPriority: TaskPriority | undefined;
  for (const prio of TASK_PRIORITIES) {
    const prioPattern = new RegExp(`(?:^|\\s)(?:priority|prio):(${prio})(?:\\b|\\s)`, "i");
    if (prioPattern.test(text)) {
      explicitPriority = prio;
      break;
    }
  }
  if (!explicitPriority && /\b(?:urgent|asap|critical priority)\b/i.test(text)) {
    explicitPriority = "urgent";
  }

  // Extract file and directory paths referenced in the prompt
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = FILE_PATH_REGEX.exec(text)) !== null) {
    const rawCandidate = match[1];
    if (!rawCandidate) continue;
    const candidate = rawCandidate.replace(/\/$/, "");
    // Filter out obvious numbers, urls, or single-character noise
    if (
      candidate &&
      !candidate.startsWith("http://") &&
      !candidate.startsWith("https://") &&
      (candidate.includes(".") || candidate.includes("/")) &&
      !paths.includes(candidate)
    ) {
      paths.push(candidate);
    }
  }

  // Word count and char count
  const words = text.length > 0 ? text.split(/\s+/).filter(Boolean) : [];

  return {
    rawPrompt: raw,
    normalizedPrompt: text,
    extractedFilePaths: paths,
    explicitDepartment,
    explicitPriority,
    wordCount: words.length,
    charCount: text.length,
  };
}
