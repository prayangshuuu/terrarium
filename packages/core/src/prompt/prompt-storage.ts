/**
 * @terrarium/core - prompt/prompt-storage.ts
 *
 * Local Storage & Retention Manager for Prompt Drafts and History.
 * Contributed by A3 (Data, Security & Reliability).
 * Aligns with PROMPT 26 Phase B.4, B.5, and H.
 */

import path from "node:path";
import os from "node:os";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { type PromptDraft, type PromptHistoryItem } from "@terrarium/contracts";

export interface PromptStorageOptions {
  readonly storageDir?: string;
  readonly enableHistory?: boolean;
  readonly maxHistoryItems?: number;
}

/**
 * Common patterns for secret tokens and API keys that must be redacted before persistence.
 */
export const SECRET_PATTERNS: readonly RegExp[] = [
  /sk-ant-[a-zA-Z0-9_\-]{20,}/g,           // Anthropic API keys
  /sk-[a-zA-Z0-9_\-]{20,}/g,               // OpenAI API keys
  /AIza[0-9A-Za-z\-_]{35}/g,               // Google AI Studio / Gemini API keys
  /ghp_[a-zA-Z0-9]{36}/g,                  // GitHub Personal Access Tokens
  /gho_[a-zA-Z0-9]{36}/g,                  // GitHub OAuth Tokens
  /xox[baprs]-[0-9a-zA-Z\-]{10,}/g,        // Slack tokens
  /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,      // Bearer tokens
  /password\s*[:=]\s*["']?[^"'\s]{4,}["']?/gi, // inline passwords
];

/**
 * Redacts known secret tokens, credentials, and API keys from a prompt string.
 */
export function redactSecrets(text: string): string {
  let redacted = text;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED_CREDENTIAL]");
  }
  return redacted;
}

export class PromptStorage {
  private readonly storageDir: string;
  private readonly enableHistory: boolean;
  private readonly maxHistoryItems: number;
  private memoryHistory: PromptHistoryItem[] = [];
  private memoryDrafts: Map<string, PromptDraft> = new Map();

  constructor(options: PromptStorageOptions = {}) {
    this.storageDir = options.storageDir ?? path.join(os.homedir(), ".terrarium");
    this.enableHistory = options.enableHistory ?? true;
    this.maxHistoryItems = options.maxHistoryItems ?? 100;
    this.loadFromDisk();
  }

  private get historyFile(): string {
    return path.join(this.storageDir, "prompt_history.json");
  }

  private get draftsFile(): string {
    return path.join(this.storageDir, "prompt_drafts.json");
  }

  private loadFromDisk(): void {
    try {
      if (existsSync(this.historyFile)) {
        const raw = readFileSync(this.historyFile, "utf8");
        this.memoryHistory = JSON.parse(raw);
      }
    } catch {
      this.memoryHistory = [];
    }

    try {
      if (existsSync(this.draftsFile)) {
        const raw = readFileSync(this.draftsFile, "utf8");
        const list: PromptDraft[] = JSON.parse(raw);
        for (const item of list) {
          this.memoryDrafts.set(item.id, item);
        }
      }
    } catch {
      this.memoryDrafts = new Map();
    }
  }

  private saveToDisk(): void {
    try {
      if (!existsSync(this.storageDir)) {
        mkdirSync(this.storageDir, { recursive: true });
      }
      if (this.enableHistory) {
        writeFileSync(this.historyFile, JSON.stringify(this.memoryHistory, null, 2), "utf8");
      }
      const draftList = Array.from(this.memoryDrafts.values());
      writeFileSync(this.draftsFile, JSON.stringify(draftList, null, 2), "utf8");
    } catch {
      // Non-fatal if filesystem is read-only (e.g. sandbox test)
    }
  }

  // --- Drafts API ---

  saveDraft(draft: PromptDraft): void {
    this.memoryDrafts.set(draft.id, draft);
    this.saveToDisk();
  }

  getDraft(id: string): PromptDraft | undefined {
    return this.memoryDrafts.get(id);
  }

  getLatestDraftForProject(projectRoot: string): PromptDraft | undefined {
    const list = Array.from(this.memoryDrafts.values())
      .filter((d) => d.projectRoot === projectRoot)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    return list[0];
  }

  clearDraft(id: string): boolean {
    const deleted = this.memoryDrafts.delete(id);
    if (deleted) {
      this.saveToDisk();
    }
    return deleted;
  }

  listDrafts(): readonly PromptDraft[] {
    return Array.from(this.memoryDrafts.values());
  }

  // --- History API ---

  recordPrompt(item: Omit<PromptHistoryItem, "text"> & { text: string }): PromptHistoryItem {
    if (!this.enableHistory) {
      return {
        ...item,
        text: redactSecrets(item.text),
      };
    }

    const sanitizedItem: PromptHistoryItem = {
      ...item,
      text: redactSecrets(item.text),
    };

    this.memoryHistory.unshift(sanitizedItem);
    if (this.memoryHistory.length > this.maxHistoryItems) {
      this.memoryHistory = this.memoryHistory.slice(0, this.maxHistoryItems);
    }

    this.saveToDisk();
    return sanitizedItem;
  }

  getHistory(options: { projectRoot?: string; limit?: number; query?: string } = {}): readonly PromptHistoryItem[] {
    let list = this.memoryHistory;
    if (options.projectRoot) {
      list = list.filter((item) => item.projectRoot === options.projectRoot);
    }
    if (options.query) {
      const q = options.query.toLowerCase();
      list = list.filter((item) => item.text.toLowerCase().includes(q));
    }
    if (options.limit && options.limit > 0) {
      list = list.slice(0, options.limit);
    }
    return list;
  }

  clearHistory(): void {
    this.memoryHistory = [];
    this.saveToDisk();
  }
}

let defaultPromptStorage: PromptStorage | null = null;

export function getPromptStorage(options?: PromptStorageOptions): PromptStorage {
  if (!defaultPromptStorage || options) {
    defaultPromptStorage = new PromptStorage(options);
  }
  return defaultPromptStorage;
}

