/**
 * apps/cli/src/ui/views/SettingsView.tsx
 *
 * Workspace 10: Settings & Specialist Provider Integrations.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer),
 * with boundary contracts and security verified by A1 & A3.
 *
 * Aligns with PLAN.md Section 10.4, Section 12, Section 24, and PROMPT 19:
 * - Tab 1: Frontier Model API Providers (Anthropic, Ollama, OpenAI, Gemini, Custom).
 * - Tab 2: Specialist Coding-Agent CLI Integrations (Claude Code CLI runner).
 * - Tab 3: Prioritized Integration Ranking & Risk Matrix (Value, Risk, Maintenance, Support).
 * - Tab 4: Live Reachability Diagnostics & Latency Tester.
 */

import React, { useCallback } from "react";
import { TextAttributes, type KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import {
  type ProviderType,
  PROVIDER_TYPES,
  INTEGRATION_RANKINGS,
  type SpecialistIntegration,
} from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { useTerrariumUi } from "../state/ui-context.js";
import type { SettingsActiveTab } from "../state/ui-state-types.js";

export function SettingsView() {
  const { state, controller } = useTerrariumUi();
  const activeTab: SettingsActiveTab = state.settingsActiveTab ?? "providers";
  const selectedProviderIdx = state.selectedProviderSettingIndex ?? 0;
  const providers: readonly ProviderType[] = PROVIDER_TYPES;
  const currentProvider = providers[selectedProviderIdx] ?? "anthropic";

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (state.isCommandPaletteOpen || state.isHelpModalOpen) return;

      const keyName = event.name.toLowerCase();

      // Tab switching [1-4]
      if (keyName === "1") {
        controller.setSettingsTab("providers");
        return;
      }
      if (keyName === "2") {
        controller.setSettingsTab("integrations");
        return;
      }
      if (keyName === "3") {
        controller.setSettingsTab("rankings");
        return;
      }
      if (keyName === "4") {
        controller.setSettingsTab("diagnostics");
        return;
      }

      // Vertical navigation
      if (keyName === "up") {
        const nextIdx = Math.max(0, selectedProviderIdx - 1);
        controller.setSelectedProviderSettingIndex(nextIdx);
        return;
      }
      if (keyName === "down") {
        const nextIdx = Math.min(providers.length - 1, selectedProviderIdx + 1);
        controller.setSelectedProviderSettingIndex(nextIdx);
        return;
      }

      // Actions: [t] Test connection
      if (keyName === "t") {
        void controller.testProviderConnection(currentProvider);
        return;
      }
    },
    [state, controller, selectedProviderIdx, providers, currentProvider]
  );

  useKeyboard(handleKeyboard);

  const integrationMeta = INTEGRATION_RANKINGS.find(
    (r) => r.id === currentProvider || r.providerType === currentProvider
  );
  const diag = state.providerDiagnostics[currentProvider];

  return (
    <box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* 1. Header Bar */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1} flexShrink={0}>
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.statusAccent} attributes={TextAttributes.BOLD}>
            ⚙ Settings & Specialist Provider Integrations
          </text>
          <text fg={THEME_COLORS.fgMuted}> • Workspace 10 • Frontier AI & Coding CLI Runners</text>
        </box>
        <box flexDirection="row">
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            [t] Test Connection  [1-4] Switch Tabs
          </text>
        </box>
      </box>

      {/* 2. Navigation Tabs */}
      <box flexDirection="row" marginBottom={1} flexShrink={0}>
        <box
          border={["bottom"]}
          borderStyle="single"
          borderColor={activeTab === "providers" ? THEME_COLORS.statusInfo : THEME_COLORS.borderSubtle}
          paddingX={2}
          marginRight={1}
        >
          <text
            fg={activeTab === "providers" ? THEME_COLORS.statusInfo : THEME_COLORS.fgSecondary}
            attributes={activeTab === "providers" ? TextAttributes.BOLD : undefined}
          >
            [1] Model Providers
          </text>
        </box>
        <box
          border={["bottom"]}
          borderStyle="single"
          borderColor={activeTab === "integrations" ? THEME_COLORS.statusInfo : THEME_COLORS.borderSubtle}
          paddingX={2}
          marginRight={1}
        >
          <text
            fg={activeTab === "integrations" ? THEME_COLORS.statusInfo : THEME_COLORS.fgSecondary}
            attributes={activeTab === "integrations" ? TextAttributes.BOLD : undefined}
          >
            [2] CLI Integrations
          </text>
        </box>
        <box
          border={["bottom"]}
          borderStyle="single"
          borderColor={activeTab === "rankings" ? THEME_COLORS.statusInfo : THEME_COLORS.borderSubtle}
          paddingX={2}
          marginRight={1}
        >
          <text
            fg={activeTab === "rankings" ? THEME_COLORS.statusInfo : THEME_COLORS.fgSecondary}
            attributes={activeTab === "rankings" ? TextAttributes.BOLD : undefined}
          >
            [3] Priority Matrix
          </text>
        </box>
        <box
          border={["bottom"]}
          borderStyle="single"
          borderColor={activeTab === "diagnostics" ? THEME_COLORS.statusInfo : THEME_COLORS.borderSubtle}
          paddingX={2}
        >
          <text
            fg={activeTab === "diagnostics" ? THEME_COLORS.statusInfo : THEME_COLORS.fgSecondary}
            attributes={activeTab === "diagnostics" ? TextAttributes.BOLD : undefined}
          >
            [4] Diagnostics
          </text>
        </box>
      </box>

      {/* 3. Main Content Panes */}
      {activeTab === "providers" && (
        <box flexDirection="row" flexGrow={1} gap={1}>
          {/* Left Master List: Known Providers */}
          <box
            flexDirection="column"
            width={28}
            border={true}
            borderStyle="single"
            borderColor={THEME_COLORS.borderSubtle}
            backgroundColor={THEME_COLORS.bgCard}
            paddingX={1}
            paddingY={1}
            flexShrink={0}
          >
            <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD} marginBottom={1}>
              PROVIDERS ({providers.length}):
            </text>
            {providers.map((p, idx) => {
              const isSelected = idx === selectedProviderIdx;
              const isDefault = p === "anthropic";
              const isLocal = p === "ollama";
              return (
                <box
                  key={p}
                  flexDirection="row"
                  justifyContent="space-between"
                  paddingX={1}
                  paddingY={0}
                  backgroundColor={isSelected ? THEME_COLORS.bgCardHover : undefined}
                >
                  <text
                    fg={isSelected ? THEME_COLORS.statusInfo : THEME_COLORS.fgPrimary}
                    attributes={isSelected ? TextAttributes.BOLD : undefined}
                  >
                    {isSelected ? "▶ " : "  "}
                    {p.toUpperCase()}
                  </text>
                  <text fg={isDefault ? THEME_COLORS.statusSuccess : isLocal ? THEME_COLORS.statusAccent : THEME_COLORS.fgMuted}>
                    {isDefault ? "DEFAULT" : isLocal ? "OFFLINE" : "CLOUD"}
                  </text>
                </box>
              );
            })}
          </box>

          {/* Right Detail Pane */}
          <box
            flexDirection="column"
            flexGrow={1}
            border={true}
            borderStyle="single"
            borderColor={THEME_COLORS.borderSubtle}
            backgroundColor={THEME_COLORS.bgCard}
            paddingX={2}
            paddingY={1}
          >
            <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
              <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
                {currentProvider.toUpperCase()} ADAPTER SPECIFICATION
              </text>
              {diag && (
                <text fg={diag.isHealthy ? THEME_COLORS.statusSuccess : THEME_COLORS.statusWarning}>
                  {diag.isHealthy ? `● HEALTHY (${diag.latencyMs}ms)` : "○ UNREACHABLE"}
                </text>
              )}
            </box>

            <box flexDirection="column" marginBottom={1}>
              <text fg={THEME_COLORS.fgSecondary}>
                • Default Provider: {currentProvider === "anthropic" ? "Yes (Recommended for reasoning & architecture)" : "No"}
              </text>
              <text fg={THEME_COLORS.fgSecondary}>
                • Connection Mode: {integrationMeta?.connectionMode ?? "explicit_key"}
              </text>
              <text fg={THEME_COLORS.fgSecondary}>
                • Data Flow: {integrationMeta?.dataFlowSummary ?? "N/A"}
              </text>
              <text fg={THEME_COLORS.fgSecondary}>
                • Rate Limits: {integrationMeta?.rateLimitsSummary ?? "Standard quota tracking"}
              </text>
            </box>

            {integrationMeta && integrationMeta.limitations.length > 0 && (
              <box
                border={true}
                borderStyle="single"
                borderColor={THEME_COLORS.statusWarning}
                paddingX={1}
                paddingY={1}
                marginBottom={1}
                flexDirection="column"
              >
                <text fg={THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD}>
                  OPERATIONAL LIMITATIONS & CONSTRAINTS:
                </text>
                {integrationMeta.limitations.map((lim, i) => (
                  <text key={i} fg={THEME_COLORS.fgSecondary}>
                    • {lim}
                  </text>
                ))}
              </box>
            )}

            <box flexDirection="row" marginTop={1}>
              <text fg={THEME_COLORS.statusInfo}>
                Press [t] to test live health check against this provider.
              </text>
            </box>
          </box>
        </box>
      )}

      {activeTab === "integrations" && (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={2}
          paddingY={1}
          flexGrow={1}
        >
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD} marginBottom={1}>
            SPECIALIST CODING-AGENT CLI RUNNERS (PLAN.md Section 10.4)
          </text>
          <text fg={THEME_COLORS.fgSecondary} marginBottom={1}>
            Integrates external coding agent CLIs into Terrarium with least privilege and sandbox isolation:
          </text>

          <box
            border={true}
            borderStyle="single"
            borderColor={THEME_COLORS.borderSubtle}
            paddingX={2}
            paddingY={1}
            marginBottom={1}
            flexDirection="column"
          >
            <text fg={THEME_COLORS.statusAccent} attributes={TextAttributes.BOLD}>
              Claude Code CLI Specialist Adapter (claude-code-cli)
            </text>
            <text fg={THEME_COLORS.fgSecondary} marginTop={1}>
              • Supported Tools: edit, bash, grep, glob
            </text>
            <text fg={THEME_COLORS.fgSecondary}>
              • Execution Mode: Non-interactive batch print mode (-p); interactive PTYs disabled for safety
            </text>
            <text fg={THEME_COLORS.fgSecondary}>
              • Sandbox Boundary: Strictly confined to project workspace directory
            </text>
            <text fg={THEME_COLORS.fgSecondary}>
              • Default Timeout: 120,000ms (2 minutes)
            </text>
            <text fg={THEME_COLORS.fgSecondary}>
              • Prerequisite: Host binary 'claude' must be present in PATH (npm install -g @anthropic-ai/claude-code)
            </text>
          </box>

          <box
            border={true}
            borderStyle="single"
            borderColor={THEME_COLORS.statusDanger}
            paddingX={2}
            paddingY={1}
            flexDirection="column"
          >
            <text fg={THEME_COLORS.statusDanger} attributes={TextAttributes.BOLD}>
              SECURITY GUARD RAILS:
            </text>
            <text fg={THEME_COLORS.fgSecondary}>
              Consequential code alterations proposed by external coding agent runners require explicit human approval.
            </text>
          </box>
        </box>
      )}

      {activeTab === "rankings" && (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={2}
          paddingY={1}
          flexGrow={1}
        >
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD} marginBottom={1}>
            INTEGRATION PRIORITY & RISK MATRIX (PLAN.md Section 12 & 24)
          </text>
          <box flexDirection="column" gap={1}>
            {INTEGRATION_RANKINGS.map((item) => {
              const valueColor = item.userValue === "critical" ? THEME_COLORS.statusSuccess : THEME_COLORS.statusInfo;
              const riskColor = item.risk === "low" ? THEME_COLORS.statusSuccess : item.risk === "medium" ? THEME_COLORS.statusWarning : THEME_COLORS.statusDanger;
              return (
                <box
                  key={item.id}
                  flexDirection="row"
                  justifyContent="space-between"
                  border={true}
                  borderStyle="single"
                  borderColor={THEME_COLORS.borderSubtle}
                  paddingX={1}
                  paddingY={0}
                >
                  <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
                    #{item.rank} {item.name}
                  </text>
                  <box flexDirection="row" gap={2}>
                    <text fg={valueColor}>Value: {item.userValue.toUpperCase()}</text>
                    <text fg={riskColor}>Risk: {item.risk.toUpperCase()}</text>
                    <text fg={THEME_COLORS.fgMuted}>Mode: {item.connectionMode}</text>
                  </box>
                </box>
              );
            })}
          </box>
        </box>
      )}

      {activeTab === "diagnostics" && (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={2}
          paddingY={1}
          flexGrow={1}
        >
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD} marginBottom={1}>
            LIVE PROVIDER REACHABILITY & HEALTH DIAGNOSTICS
          </text>
          <text fg={THEME_COLORS.fgSecondary} marginBottom={1}>
            Press [t] to test reachability against active provider ({currentProvider.toUpperCase()}):
          </text>

          {state.isTestingProvider ? (
            <text fg={THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD}>
              Testing connection reachability to {currentProvider}...
            </text>
          ) : diag ? (
            <box
              border={true}
              borderStyle="single"
              borderColor={diag.isHealthy ? THEME_COLORS.statusSuccess : THEME_COLORS.statusWarning}
              paddingX={2}
              paddingY={1}
              flexDirection="column"
            >
              <text fg={diag.isHealthy ? THEME_COLORS.statusSuccess : THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD}>
                {diag.isHealthy ? "✓ CONNECTION VERIFIED" : "⚠ REACHABILITY WARNING"}
              </text>
              <text fg={THEME_COLORS.fgSecondary} marginTop={1}>
                • Provider: {diag.provider}
              </text>
              <text fg={THEME_COLORS.fgSecondary}>
                • Latency: {diag.latencyMs}ms
              </text>
              <text fg={THEME_COLORS.fgSecondary}>
                • Diagnostics: {diag.message ?? "N/A"}
              </text>
              <text fg={THEME_COLORS.fgMuted}>
                • Timestamp: {diag.timestamp}
              </text>
            </box>
          ) : (
            <box flexDirection="column">
              <text fg={THEME_COLORS.fgMuted}>
                No test results recorded yet. Press [t] to execute a health probe.
              </text>
            </box>
          )}
        </box>
      )}
    </box>
  );
}
