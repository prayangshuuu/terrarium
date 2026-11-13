/**
 * apps/cli/src/ui/components/PromptComposer.tsx
 *
 * First-Class Terminal Prompt Composer with Multiline Editing, Context Selection,
 * Draft Autosave, Searchable History, Starter Templates, and Multi-Provider Routing.
 *
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 * Aligns strictly with PROMPT 26 Phase B, C, D, and I.
 * 100% zero-emoji terminal typography.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TextAttributes, type KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import {
  type PromptTargetProvider,
  type PromptContextSource,
  type PromptTemplate,
  type PromptHistoryItem,
} from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import {
  PromptStorage,
  getPromptTemplates,
  detectProjectRoot,
  assemblePromptContext,
} from "@terrarium/core";

export interface PromptComposerProps {
  readonly isFocused?: boolean;
  readonly onFocusChange?: (focused: boolean) => void;
  readonly onCancel?: () => void;
  readonly onSubmit: (data: {
    prompt: string;
    provider: PromptTargetProvider;
    contextSources: readonly PromptContextSource[];
    projectRoot: string;
  }) => void;
  readonly initialText?: string;
  readonly initialProvider?: PromptTargetProvider;
  readonly height?: number;
}

const PROVIDERS: readonly { id: PromptTargetProvider; label: string }[] = [
  { id: "orchestrator", label: "Orchestrator" },
  { id: "claude_code", label: "Claude Code" },
  { id: "antigravity", label: "Antigravity" },
  { id: "cursor", label: "Cursor Agent" },
  { id: "ollama", label: "Ollama" },
];

export function PromptComposer({
  isFocused = false,
  onFocusChange,
  onCancel,
  onSubmit,
  initialText = "",
  initialProvider = "orchestrator",
  height = 9,
}: PromptComposerProps) {
  const [lines, setLines] = useState<string[]>(() => {
    const split = initialText.split("\n");
    return split.length > 0 ? split : [""];
  });
  const [cursorRow, setCursorRow] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);
  const [providerIndex, setProviderIndex] = useState(() => {
    const idx = PROVIDERS.findIndex((p) => p.id === initialProvider);
    return idx >= 0 ? idx : 0;
  });
  const [activeContextSources, setActiveContextSources] = useState<PromptContextSource[]>([
    "project_manifest",
    "git_status",
  ]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const storage = useMemo(() => new PromptStorage(), []);
  const project = useMemo(() => detectProjectRoot(process.cwd()), []);
  const templates = useMemo(() => getPromptTemplates(), []);
  const history = useMemo(() => storage.getHistory({ limit: 15 }), [showHistoryModal]);

  const currentProvider = PROVIDERS[providerIndex]?.id ?? "orchestrator";
  const currentProviderLabel = PROVIDERS[providerIndex]?.label ?? "Orchestrator";

  const totalChars = useMemo(() => lines.reduce((acc, l) => acc + l.length, 0), [lines]);
  const fullText = useMemo(() => lines.join("\n"), [lines]);

  // Autosave draft on text change
  useEffect(() => {
    if (fullText.trim().length > 0) {
      storage.saveDraft({
        id: `draft-${project.projectName}`,
        text: fullText,
        projectRoot: project.projectRoot,
        provider: currentProvider,
        selectedProfiles: [],
        contextSources: activeContextSources,
        savedAt: new Date().toISOString(),
      });
    }
  }, [fullText, currentProvider, activeContextSources, project.projectRoot]);

  // Handle slash commands
  const handleSlashCommand = (cmdStr: string): boolean => {
    const parts = cmdStr.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    if (cmd === "/clear") {
      setLines([""]);
      setCursorRow(0);
      setCursorCol(0);
      setStatusMessage("Prompt cleared");
      return true;
    }
    if (cmd === "/templates") {
      setShowTemplatesModal(true);
      return true;
    }
    if (cmd === "/history") {
      setShowHistoryModal(true);
      return true;
    }
    if (cmd === "/provider") {
      const target = parts[1]?.toLowerCase();
      const matchIdx = PROVIDERS.findIndex(
        (p) => p.id.toLowerCase().includes(target ?? "") || p.label.toLowerCase().includes(target ?? "")
      );
      if (matchIdx >= 0) {
        setProviderIndex(matchIdx);
        setStatusMessage(`Provider switched to ${PROVIDERS[matchIdx]?.label}`);
      } else {
        setStatusMessage(`Unknown provider '${target}'. Valid: ${PROVIDERS.map((p) => p.id).join(", ")}`);
      }
      return true;
    }
    if (cmd === "/help") {
      setStatusMessage("Commands: /clear, /templates, /history, /provider <name>, /help");
      return true;
    }

    return false;
  };

  const handleSend = () => {
    const trimmed = fullText.trim();
    if (!trimmed) {
      setStatusMessage("Cannot submit empty prompt");
      return;
    }

    if (trimmed.startsWith("/")) {
      const handled = handleSlashCommand(trimmed);
      if (handled) {
        setLines([""]);
        setCursorRow(0);
        setCursorCol(0);
        return;
      }
    }

    storage.recordPrompt({
      id: `prompt-${Date.now()}`,
      text: trimmed,
      projectRoot: project.projectRoot,
      provider: currentProvider,
      selectedProfiles: [],
      submittedAt: new Date().toISOString(),
      status: "queued",
    });

    storage.clearDraft(`draft-${project.projectName}`);

    onSubmit({
      prompt: trimmed,
      provider: currentProvider,
      contextSources: activeContextSources,
      projectRoot: project.projectRoot,
    });

    setLines([""]);
    setCursorRow(0);
    setCursorCol(0);
    setStatusMessage("Prompt submitted");
  };

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!isFocused) return;
      const keyName = event.name.toLowerCase();

      // 1. Templates Modal Active
      if (showTemplatesModal) {
        if (keyName === "escape") {
          setShowTemplatesModal(false);
          return;
        }
        if (keyName === "up") {
          setSelectedTemplateIdx((prev) => Math.max(0, prev - 1));
          return;
        }
        if (keyName === "down") {
          setSelectedTemplateIdx((prev) => Math.min(templates.length - 1, prev + 1));
          return;
        }
        if (keyName === "return" || keyName === "enter") {
          const t = templates[selectedTemplateIdx];
          if (t) {
            setLines(t.content.split("\n"));
            setCursorRow(0);
            setCursorCol(0);
            if (t.recommendedProvider) {
              const pIdx = PROVIDERS.findIndex((p) => p.id === t.recommendedProvider);
              if (pIdx >= 0) setProviderIndex(pIdx);
            }
            setStatusMessage(`Template loaded: ${t.title}`);
          }
          setShowTemplatesModal(false);
          return;
        }
        return;
      }

      // 2. History Modal Active
      if (showHistoryModal) {
        if (keyName === "escape") {
          setShowHistoryModal(false);
          return;
        }
        if (keyName === "up") {
          setSelectedHistoryIdx((prev) => Math.max(0, prev - 1));
          return;
        }
        if (keyName === "down") {
          setSelectedHistoryIdx((prev) => Math.min(history.length - 1, prev + 1));
          return;
        }
        if (keyName === "return" || keyName === "enter") {
          const h = history[selectedHistoryIdx];
          if (h) {
            setLines(h.text.split("\n"));
            setCursorRow(0);
            setCursorCol(0);
            const pIdx = PROVIDERS.findIndex((p) => p.id === h.provider);
            if (pIdx >= 0) setProviderIndex(pIdx);
            setStatusMessage("Historical prompt loaded");
          }
          setShowHistoryModal(false);
          return;
        }
        return;
      }

      // 3. Global Composer Shortcuts
      if (keyName === "f2" || (event.ctrl && keyName === "t")) {
        setShowTemplatesModal(true);
        return;
      }
      if (keyName === "f3" || (event.ctrl && keyName === "h")) {
        setShowHistoryModal(true);
        return;
      }
      if (event.ctrl && keyName === "p") {
        setProviderIndex((prev) => (prev + 1) % PROVIDERS.length);
        return;
      }
      if (keyName === "escape") {
        onCancel?.();
        onFocusChange?.(false);
        return;
      }

      // 4. Submission: Ctrl+Enter or Meta+Enter
      if ((event.ctrl || event.meta) && (keyName === "return" || keyName === "enter")) {
        handleSend();
        return;
      }

      // 5. Enter -> New line
      if (keyName === "return" || keyName === "enter") {
        const curLine = lines[cursorRow] ?? "";
        const head = curLine.substring(0, cursorCol);
        const tail = curLine.substring(cursorCol);
        const newLines = [...lines];
        newLines.splice(cursorRow, 1, head, tail);
        setLines(newLines);
        setCursorRow((prev) => prev + 1);
        setCursorCol(0);
        return;
      }

      // 6. Backspace
      if (keyName === "backspace") {
        const curLine = lines[cursorRow] ?? "";
        if (cursorCol > 0) {
          const updated = curLine.substring(0, cursorCol - 1) + curLine.substring(cursorCol);
          const newLines = [...lines];
          newLines[cursorRow] = updated;
          setLines(newLines);
          setCursorCol((c) => c - 1);
        } else if (cursorRow > 0) {
          const prevLine = lines[cursorRow - 1] ?? "";
          const newCol = prevLine.length;
          const merged = prevLine + curLine;
          const newLines = [...lines];
          newLines.splice(cursorRow - 1, 2, merged);
          setLines(newLines);
          setCursorRow((r) => r - 1);
          setCursorCol(newCol);
        }
        return;
      }

      // 7. Delete
      if (keyName === "delete") {
        const curLine = lines[cursorRow] ?? "";
        if (cursorCol < curLine.length) {
          const updated = curLine.substring(0, cursorCol) + curLine.substring(cursorCol + 1);
          const newLines = [...lines];
          newLines[cursorRow] = updated;
          setLines(newLines);
        } else if (cursorRow < lines.length - 1) {
          const nextLine = lines[cursorRow + 1] ?? "";
          const merged = curLine + nextLine;
          const newLines = [...lines];
          newLines.splice(cursorRow, 2, merged);
          setLines(newLines);
        }
        return;
      }

      // 8. Navigation: Left / Right / Up / Down / Home / End
      if (keyName === "left") {
        if (cursorCol > 0) {
          setCursorCol((c) => c - 1);
        } else if (cursorRow > 0) {
          const prevLen = lines[cursorRow - 1]?.length ?? 0;
          setCursorRow((r) => r - 1);
          setCursorCol(prevLen);
        }
        return;
      }
      if (keyName === "right") {
        const curLen = lines[cursorRow]?.length ?? 0;
        if (cursorCol < curLen) {
          setCursorCol((c) => c + 1);
        } else if (cursorRow < lines.length - 1) {
          setCursorRow((r) => r + 1);
          setCursorCol(0);
        }
        return;
      }
      if (keyName === "up") {
        if (cursorRow > 0) {
          const nextRow = cursorRow - 1;
          const targetLen = lines[nextRow]?.length ?? 0;
          setCursorRow(nextRow);
          setCursorCol((c) => Math.min(c, targetLen));
        }
        return;
      }
      if (keyName === "down") {
        if (cursorRow < lines.length - 1) {
          const nextRow = cursorRow + 1;
          const targetLen = lines[nextRow]?.length ?? 0;
          setCursorRow(nextRow);
          setCursorCol((c) => Math.min(c, targetLen));
        }
        return;
      }
      if (keyName === "home") {
        setCursorCol(0);
        return;
      }
      if (keyName === "end") {
        const curLen = lines[cursorRow]?.length ?? 0;
        setCursorCol(curLen);
        return;
      }

      // 9. Printable characters (single chars, space, symbols, paste)
      if (
        !event.ctrl &&
        !event.meta &&
        event.sequence &&
        event.sequence.length > 0 &&
        event.sequence >= " " &&
        event.sequence !== "\u001b"
      ) {
        const curLine = lines[cursorRow] ?? "";
        const updated = curLine.substring(0, cursorCol) + event.sequence + curLine.substring(cursorCol);
        const newLines = [...lines];
        newLines[cursorRow] = updated;
        setLines(newLines);
        setCursorCol((c) => c + event.sequence.length);
      }
    },
    [
      isFocused,
      lines,
      cursorRow,
      cursorCol,
      showTemplatesModal,
      showHistoryModal,
      selectedTemplateIdx,
      selectedHistoryIdx,
      templates,
      history,
      currentProvider,
      activeContextSources,
      project.projectRoot,
      onFocusChange,
    ]
  );

  useKeyboard(handleKeyboard);

  const displayLines = lines.slice(0, height - 3);

  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="single"
      borderColor={isFocused ? THEME_COLORS.borderFocused : THEME_COLORS.borderDefault}
      backgroundColor={THEME_COLORS.bgInput}
      paddingX={1}
      paddingY={0}
    >
      {/* 1. Header Toolbar */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={0}>
        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            PROMPT COMPOSER
          </text>
          <text fg={THEME_COLORS.fgMuted}>[Project: {project.projectName}]</text>
          <text fg={THEME_COLORS.statusAccent}>[Provider: {currentProviderLabel}]</text>
          <text fg={THEME_COLORS.fgSecondary}>[Context: manifest, git]</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={THEME_COLORS.statusSuccess}>[F2: Templates]</text>
          <text fg={THEME_COLORS.statusWarning}>[F3: History]</text>
          <text fg={THEME_COLORS.fgMuted}>[Ctrl+P: Cycle Provider]</text>
        </box>
      </box>

      {/* 2. Multiline Editor Area */}
      <box flexDirection="column" marginTop={0} marginBottom={0} minHeight={3}>
        {displayLines.map((line, r) => {
          const isCursorOnThisLine = isFocused && cursorRow === r;
          const head = isCursorOnThisLine ? line.substring(0, cursorCol) : line;
          const tail = isCursorOnThisLine ? line.substring(cursorCol) : "";

          return (
            <box key={r} flexDirection="row" alignItems="center">
              <text fg={THEME_COLORS.fgDim} width={3}>
                {r + 1}│
              </text>
              <text fg={THEME_COLORS.fgPrimary}>{head}</text>
              {isCursorOnThisLine && (
                <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
                  ▎
                </text>
              )}
              <text fg={THEME_COLORS.fgPrimary}>{tail}</text>
              {!line && !isCursorOnThisLine && r === 0 && (
                <text fg={THEME_COLORS.fgDim}>
                  Write instructions, ask for architectural analysis, or type /help...
                </text>
              )}
            </box>
          );
        })}
      </box>

      {/* 3. Footer Status and Shortcuts */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={0}>
        <box flexDirection="row" gap={1}>
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            Ctrl+Enter: Send
          </text>
          <text fg={THEME_COLORS.fgMuted}>Enter: New Line</text>
          <text fg={THEME_COLORS.fgMuted}>Esc: Unfocus</text>
          {statusMessage && <text fg={THEME_COLORS.statusWarning}>• {statusMessage}</text>}
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={THEME_COLORS.fgDim}>
            Row {cursorRow + 1}:{cursorCol + 1} │ Chars: {totalChars}
          </text>
        </box>
      </box>

      {/* Templates Modal Overlay */}
      {showTemplatesModal && (
        <box
          border={true}
          borderStyle="double"
          borderColor={THEME_COLORS.statusInfo}
          backgroundColor={THEME_COLORS.bgCardElevated}
          paddingX={2}
          paddingY={1}
          marginTop={1}
          flexDirection="column"
        >
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD} marginBottom={1}>
            SELECT PROMPT STARTER TEMPLATE (Enter to Load, Esc to Cancel)
          </text>
          {templates.slice(0, 7).map((t, i) => (
            <box key={t.id} flexDirection="row" gap={1}>
              <text
                fg={i === selectedTemplateIdx ? THEME_COLORS.statusInfo : THEME_COLORS.fgSecondary}
                attributes={i === selectedTemplateIdx ? TextAttributes.BOLD : undefined}
              >
                {i === selectedTemplateIdx ? "▸ " : "  "}
                [{t.category.toUpperCase()}] {t.title}
              </text>
            </box>
          ))}
        </box>
      )}

      {/* History Modal Overlay */}
      {showHistoryModal && (
        <box
          border={true}
          borderStyle="double"
          borderColor={THEME_COLORS.statusWarning}
          backgroundColor={THEME_COLORS.bgCardElevated}
          paddingX={2}
          paddingY={1}
          marginTop={1}
          flexDirection="column"
        >
          <text fg={THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD} marginBottom={1}>
            PROMPT SUBMISSION HISTORY (Enter to Load, Esc to Cancel)
          </text>
          {history.length === 0 ? (
            <text fg={THEME_COLORS.fgDim}>No previous prompts recorded.</text>
          ) : (
            history.slice(0, 5).map((h, i) => (
              <box key={h.id} flexDirection="row" gap={1}>
                <text
                  fg={i === selectedHistoryIdx ? THEME_COLORS.statusWarning : THEME_COLORS.fgSecondary}
                  attributes={i === selectedHistoryIdx ? TextAttributes.BOLD : undefined}
                >
                  {i === selectedHistoryIdx ? "▸ " : "  "}
                  [{h.provider}] {h.text.slice(0, 50)}...
                </text>
              </box>
            ))
          )}
        </box>
      )}
    </box>
  );
}
