/**
 * packages/core/tests/prompt-storage.test.ts
 *
 * Tests for PromptStorage, draft persistence, bounded history, and secret redaction.
 * Prompt 26 verification suite. Zero emoji typography.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PromptStorage,
  redactSecrets,
  getPromptStorage,
} from "../src/prompt/prompt-storage.ts";
import { type PromptDraft } from "@terrarium/contracts";

describe("PromptStorage & Secret Redaction (Prompt 26)", () => {
  let tempDir: string;
  let storage: PromptStorage;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "terrarium-prompt-storage-"));
    storage = new PromptStorage({
      storageDir: tempDir,
      enableHistory: true,
      maxHistoryItems: 5,
    });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("redactSecrets", () => {
    it("redacts Anthropic API keys", () => {
      const input = "Use key sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456 to call Claude";
      const sanitized = redactSecrets(input);
      expect(sanitized).not.toContain("sk-ant-api03-");
      expect(sanitized).toContain("[REDACTED_CREDENTIAL]");
    });

    it("redacts OpenAI API keys", () => {
      const input = "Authorization: sk-proj-1234567890abcdefghijklmnopqrstuv";
      const sanitized = redactSecrets(input);
      expect(sanitized).not.toContain("sk-proj-");
      expect(sanitized).toContain("[REDACTED_CREDENTIAL]");
    });

    it("redacts Google AI Studio / Gemini API keys", () => {
      const input = "GEMINI_API_KEY=AIzaSyA1234567890abcdefghijklmnopqrstuv";
      const sanitized = redactSecrets(input);
      expect(sanitized).not.toContain("AIzaSy");
      expect(sanitized).toContain("[REDACTED_CREDENTIAL]");
    });

    it("redacts GitHub tokens", () => {
      const input = "Token is ghp_1234567890abcdefghijklmnopqrstuvwxyzAB";
      const sanitized = redactSecrets(input);
      expect(sanitized).not.toContain("ghp_");
      expect(sanitized).toContain("[REDACTED_CREDENTIAL]");
    });

    it("redacts Bearer authorization tokens", () => {
      const input = "Header Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghij";
      const sanitized = redactSecrets(input);
      expect(sanitized).not.toContain("eyJhbGciOi");
      expect(sanitized).toContain("[REDACTED_CREDENTIAL]");
    });

    it("leaves safe prompts untouched", () => {
      const safe = "Refactor the database queries in packages/core/src/db.ts to use transactions.";
      expect(redactSecrets(safe)).toBe(safe);
    });
  });

  describe("Drafts Lifecycle", () => {
    it("saves and retrieves a draft", () => {
      const draft: PromptDraft = {
        id: "draft_1",
        text: "Explain the architecture of the intake pipeline.",
        projectRoot: "/workspace/my-app",
        provider: "orchestrator",
        selectedProfiles: ["architect", "backend-lead"],
        contextSources: ["project_manifest", "git_status"],
        savedAt: new Date().toISOString(),
      };

      storage.saveDraft(draft);

      const retrieved = storage.getDraft("draft_1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.text).toBe(draft.text);
      expect(retrieved?.projectRoot).toBe("/workspace/my-app");
    });

    it("returns latest draft for a specific project", () => {
      const draftOld: PromptDraft = {
        id: "draft_old",
        text: "Old prompt",
        projectRoot: "/workspace/app-a",
        provider: "claude_code",
        selectedProfiles: [],
        contextSources: ["project_manifest"],
        savedAt: "2026-11-13T01:00:00.000Z",
      };
      const draftNew: PromptDraft = {
        id: "draft_new",
        text: "New prompt",
        projectRoot: "/workspace/app-a",
        provider: "claude_code",
        selectedProfiles: [],
        contextSources: ["project_manifest"],
        savedAt: "2026-11-13T02:00:00.000Z",
      };
      const draftOther: PromptDraft = {
        id: "draft_other",
        text: "Other project prompt",
        projectRoot: "/workspace/app-b",
        provider: "antigravity",
        selectedProfiles: [],
        contextSources: [],
        savedAt: "2026-11-13T03:00:00.000Z",
      };

      storage.saveDraft(draftOld);
      storage.saveDraft(draftNew);
      storage.saveDraft(draftOther);

      const latestA = storage.getLatestDraftForProject("/workspace/app-a");
      expect(latestA?.id).toBe("draft_new");
      expect(latestA?.text).toBe("New prompt");
    });

    it("clears a draft and reflects in list", () => {
      const draft: PromptDraft = {
        id: "draft_del",
        text: "To be deleted",
        projectRoot: "/workspace/test",
        provider: "cursor",
        selectedProfiles: [],
        contextSources: [],
        savedAt: new Date().toISOString(),
      };

      storage.saveDraft(draft);
      expect(storage.listDrafts().length).toBe(1);

      const deleted = storage.clearDraft("draft_del");
      expect(deleted).toBe(true);
      expect(storage.getDraft("draft_del")).toBeUndefined();
      expect(storage.listDrafts().length).toBe(0);
    });
  });

  describe("History & Redaction", () => {
    it("records prompt history and automatically sanitizes embedded secrets", () => {
      const recorded = storage.recordPrompt({
        id: "hist_1",
        text: "Deploy with sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456 now",
        projectRoot: "/workspace/proj",
        provider: "claude_code",
        selectedProfiles: [],
        submittedAt: new Date().toISOString(),
        status: "completed",
      });

      expect(recorded.text).not.toContain("sk-ant-api03-");
      expect(recorded.text).toContain("[REDACTED_CREDENTIAL]");

      const history = storage.getHistory();
      expect(history.length).toBe(1);
      expect(history[0]?.text).toContain("[REDACTED_CREDENTIAL]");
    });

    it("enforces maxHistoryItems bounds via FIFO eviction", () => {
      for (let i = 1; i <= 8; i++) {
        storage.recordPrompt({
          id: `hist_${i}`,
          text: `Prompt number ${i}`,
          projectRoot: "/workspace/proj",
          provider: "orchestrator",
          selectedProfiles: [],
          submittedAt: new Date().toISOString(),
          status: "completed",
        });
      }

      const history = storage.getHistory();
      expect(history.length).toBe(5); // Bound was 5
      expect(history[0]?.text).toBe("Prompt number 8");
      expect(history[4]?.text).toBe("Prompt number 4");
    });

    it("filters history by projectRoot and search query", () => {
      storage.recordPrompt({
        id: "h1",
        text: "Architecture review for auth module",
        projectRoot: "/proj/backend",
        provider: "claude_code",
        selectedProfiles: [],
        submittedAt: new Date().toISOString(),
        status: "completed",
      });
      storage.recordPrompt({
        id: "h2",
        text: "Unit tests for frontend button component",
        projectRoot: "/proj/frontend",
        provider: "cursor",
        selectedProfiles: [],
        submittedAt: new Date().toISOString(),
        status: "completed",
      });

      const backendOnly = storage.getHistory({ projectRoot: "/proj/backend" });
      expect(backendOnly.length).toBe(1);
      expect(backendOnly[0]?.id).toBe("h1");

      const authSearch = storage.getHistory({ query: "auth" });
      expect(authSearch.length).toBe(1);
      expect(authSearch[0]?.id).toBe("h1");

      const buttonSearch = storage.getHistory({ query: "button" });
      expect(buttonSearch.length).toBe(1);
      expect(buttonSearch[0]?.id).toBe("h2");
    });

    it("clears entire prompt history", () => {
      storage.recordPrompt({
        id: "h1",
        text: "Test prompt",
        projectRoot: "/proj",
        provider: "orchestrator",
        selectedProfiles: [],
        submittedAt: new Date().toISOString(),
        status: "completed",
      });
      expect(storage.getHistory().length).toBe(1);

      storage.clearHistory();
      expect(storage.getHistory().length).toBe(0);
    });
  });

  describe("Singleton Factory", () => {
    it("returns prompt storage instance via getPromptStorage", () => {
      const instance = getPromptStorage({ storageDir: tempDir });
      expect(instance).toBeInstanceOf(PromptStorage);
    });
  });
});
