/**
 * apps/cli/src/ui/views/EcosystemView.tsx
 *
 * Workspace 2: Searchable & filterable Agent Ecosystem Directory & Profile Detail View.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer),
 * with runtime integration by A2 and metric/lifecycle correctness by A3.
 *
 * PLAN.md Section 4 & Section 16; PROMPT 15:
 * - Searchable and filterable agent catalog.
 * - Distinguishes lifecycle statuses: registered, enabled, selected, executing, paused, disabled.
 * - Displays demand-based selection rationale and candidate match scores when available.
 * - Prominently labels simulated customer personas [SIMULATED].
 * - Handles clean new-install empty state when catalog is unpopulated.
 */

import React, { useCallback } from "react";
import { TextAttributes, type KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import {
  AGENT_DEPARTMENTS,
  type AgentDepartment,
  AGENT_LIFECYCLE_STATUSES,
  type AgentLifecycleStatus,
  AGENT_LIFECYCLE_UI,
  DEPARTMENT_UI,
  type AgentProfile,
} from "@terrarium/contracts";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";
import { useTerrariumUi } from "../state/ui-context.js";

const DEPARTMENT_CYCLE: readonly ("all" | AgentDepartment)[] = [
  "all",
  ...AGENT_DEPARTMENTS,
];

const LIFECYCLE_CYCLE: readonly ("all" | AgentLifecycleStatus)[] = [
  "all",
  ...AGENT_LIFECYCLE_STATUSES,
];

export function EcosystemView() {
  const { state, controller } = useTerrariumUi();
  const filteredProfiles = controller.getFilteredEcosystemProfiles();
  const selectedProfile = filteredProfiles[state.selectedAgentIndex] ?? null;

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      // If modal overlays (command palette or help) are active, AppShell takes priority
      if (state.isCommandPaletteOpen || state.isHelpModalOpen) {
        return;
      }

      const keyName = event.name.toLowerCase();

      // 1. Detail Modal Open: Escape or Enter closes it
      if (state.isAgentDetailOpen) {
        if (
          keyName === "escape" ||
          keyName === "esc" ||
          event.sequence === "\u001b" ||
          keyName === "return" ||
          keyName === "enter" ||
          keyName === "space"
        ) {
          controller.closeAgentDetail();
        }
        return;
      }

      // 2. Directory Navigation: Up/Down, j/k
      if (keyName === "up" || (!event.ctrl && !event.meta && keyName === "k")) {
        const nextIdx = Math.max(0, state.selectedAgentIndex - 1);
        controller.setEcosystemIndex(nextIdx);
        return;
      }

      if (keyName === "down" || (!event.ctrl && !event.meta && keyName === "j")) {
        const nextIdx = Math.min(filteredProfiles.length - 1, state.selectedAgentIndex + 1);
        controller.setEcosystemIndex(nextIdx);
        return;
      }

      // 3. Inspect Selected Profile: Enter / Space / 'i'
      if (keyName === "return" || keyName === "enter" || keyName === "space" || (!event.ctrl && !event.meta && keyName === "i")) {
        if (selectedProfile) {
          controller.openAgentDetail(selectedProfile.id);
        }
        return;
      }

      // 4. Cycle Department Filter: 'd'
      if (!event.ctrl && !event.meta && keyName === "d") {
        const curFilter = controller.getState().ecosystemFilter;
        const currentIdx = DEPARTMENT_CYCLE.indexOf(curFilter.department);
        const nextIdx = (currentIdx + 1) % DEPARTMENT_CYCLE.length;
        const nextDept = DEPARTMENT_CYCLE[nextIdx] ?? "all";
        controller.setEcosystemDepartmentFilter(nextDept);
        return;
      }

      // 5. Cycle Lifecycle Status Filter: 'f'
      if (!event.ctrl && !event.meta && keyName === "f") {
        const curFilter = controller.getState().ecosystemFilter;
        const currentIdx = LIFECYCLE_CYCLE.indexOf(curFilter.lifecycleStatus);
        const nextIdx = (currentIdx + 1) % LIFECYCLE_CYCLE.length;
        const nextStatus = LIFECYCLE_CYCLE[nextIdx] ?? "all";
        controller.setEcosystemLifecycleFilter(nextStatus);
        return;
      }

      // 6. Reset filters / Search: Escape
      if (keyName === "escape" || keyName === "esc" || event.sequence === "\u001b") {
        controller.resetEcosystemFilters();
        return;
      }

      // 7. Backspace in search
      if (keyName === "backspace" && state.ecosystemFilter.searchQuery) {
        controller.setEcosystemSearch(state.ecosystemFilter.searchQuery.slice(0, -1));
        return;
      }

      // 8. Printable characters for filtering (when not using navigation hotkeys)
      if (
        !event.ctrl &&
        !event.meta &&
        event.sequence &&
        event.sequence.length === 1 &&
        event.sequence >= " " &&
        event.sequence <= "~"
      ) {
        // Avoid intercepting direct workspace number keys (1-9, 0) and global keys (?, q)
        if (
          event.sequence >= "0" &&
          event.sequence <= "9"
        ) {
          return;
        }
        if (event.sequence === "?" || event.sequence === "q") {
          return;
        }

        // Avoid cycling hotkeys if search is empty
        if ((event.sequence === "d" || event.sequence === "f" || event.sequence === "j" || event.sequence === "k" || event.sequence === "i") && !state.ecosystemFilter.searchQuery) {
          return;
        }

        controller.setEcosystemSearch(state.ecosystemFilter.searchQuery + event.sequence);
        return;
      }
    },
    [state, controller, filteredProfiles, selectedProfile]
  );

  useKeyboard(handleKeyboard);

  const isCleanInstall = state.ecosystemProfiles.length === 0;

  return (
    <box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* 1. Header Banner: Title & Ecosystem Summary */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.statusAccent} attributes={TextAttributes.BOLD}>
            {GLYPHS.wsEcosystem} AGENT ECOSYSTEM
          </text>
          <text fg={THEME_COLORS.fgMuted}>
            {" "}• Virtual Organization Directory & Capability Catalog
          </text>
        </box>
        <box flexDirection="row">
          <text fg={THEME_COLORS.fgSecondary}>
            {state.ecosystemProfiles.length} registered profiles
          </text>
        </box>
      </box>

      {/* 2. Search & Filter Bar */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        border={true}
        borderStyle="single"
        borderColor={THEME_COLORS.borderSubtle}
        backgroundColor={THEME_COLORS.bgCard}
        paddingX={1}
        paddingY={0}
        marginBottom={1}
      >
        {/* Search query display */}
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
            FILTER:{" "}
          </text>
          <text fg={state.ecosystemFilter.searchQuery ? THEME_COLORS.fgPrimary : THEME_COLORS.fgDim}>
            {state.ecosystemFilter.searchQuery
              ? `"${state.ecosystemFilter.searchQuery}"`
              : "Type to search (role, name, capability)..."}
          </text>
        </box>

        {/* Filter pills */}
        <box flexDirection="row" alignItems="center">
          <box flexDirection="row" marginRight={2}>
            <text fg={THEME_COLORS.fgMuted}>[d] Dept: </text>
            <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
              {state.ecosystemFilter.department === "all"
                ? "ALL"
                : (DEPARTMENT_UI[state.ecosystemFilter.department]?.shortCode ?? state.ecosystemFilter.department)}
            </text>
          </box>

          <box flexDirection="row" marginRight={2}>
            <text fg={THEME_COLORS.fgMuted}>[f] Status: </text>
            <text fg={THEME_COLORS.statusSuccess} attributes={TextAttributes.BOLD}>
              {state.ecosystemFilter.lifecycleStatus.toUpperCase()}
            </text>
          </box>

          <text fg={THEME_COLORS.fgDim}>
            ({filteredProfiles.length} matching)
          </text>
        </box>
      </box>

      {/* 3. Main Content: Detail Inspection Card, Empty States, or Directory Table */}
      {state.isAgentDetailOpen ? (
        (() => {
          const inspectedProfile = state.selectedAgentId
            ? state.ecosystemProfiles.find((p) => p.id === state.selectedAgentId) ?? selectedProfile
            : selectedProfile;
          if (!inspectedProfile) return null;
          return (
            <AgentDetailInspectionCard
              profile={inspectedProfile}
              lifecycleStatus={controller.getAgentLifecycleStatus(inspectedProfile)}
              selectionRationale={state.selectionRationales[inspectedProfile.id]}
              onClose={() => controller.closeAgentDetail()}
            />
          );
        })()
      ) : isCleanInstall ? (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          title=" UNPOPULATED VIRTUAL ORGANIZATION "
          titleColor={THEME_COLORS.statusInfo}
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={2}
          paddingY={1}
          flexGrow={1}
        >
          <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
            Zero Agent Profiles Registered
          </text>
          <box marginTop={1} flexDirection="column">
            <text fg={THEME_COLORS.fgSecondary}>
              This is a clean installation. No agent profiles have been seeded or registered in the database.
            </text>
            <text fg={THEME_COLORS.fgMuted} marginTop={1}>
              To seed the curated 15-profile virtual organization catalog across all 10 departments:
            </text>
            <text fg={THEME_COLORS.statusInfo} marginTop={0}>
              $ terrarium agent seed
            </text>
          </box>
        </box>
      ) : filteredProfiles.length === 0 ? (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          title=" NO MATCHING AGENTS "
          titleColor={THEME_COLORS.statusWarning}
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={2}
          paddingY={1}
          flexGrow={1}
        >
          <text fg={THEME_COLORS.statusWarning}>
            No agent profiles match current filter criteria.
          </text>
          <text fg={THEME_COLORS.fgDim} marginTop={1}>
            Query: "{state.ecosystemFilter.searchQuery}" • Dept: {state.ecosystemFilter.department} • Status: {state.ecosystemFilter.lifecycleStatus}
          </text>
          <text fg={THEME_COLORS.statusInfo} marginTop={1}>
            Press [Esc] to reset all filters.
          </text>
        </box>
      ) : (
        /* Agent Directory List */
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          title={` AGENT DIRECTORY (${filteredProfiles.length} PROFILES) `}
          titleColor={THEME_COLORS.statusAccent}
          borderColor={THEME_COLORS.borderSubtle}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={1}
          paddingY={0}
          flexGrow={1}
        >
          {/* Table Header */}
          <box flexDirection="row" borderStyle="single" borderColor={THEME_COLORS.borderSubtle} paddingBottom={0} marginBottom={0}>
            <box width={10}><text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD}>STATUS</text></box>
            <box width={26}><text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD}>AGENT / SPECIALIST</text></box>
            <box width={28}><text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD}>ROLE</text></box>
            <box width={18}><text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD}>DEPARTMENT</text></box>
            <box width={10}><text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD}>TIER</text></box>
            <box flexGrow={1}><text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD}>PERSONA / TAGS</text></box>
          </box>

          {/* Directory Rows */}
          {filteredProfiles.slice(0, 14).map((profile, idx) => {
            const isSelected = idx === state.selectedAgentIndex;
            const lifecycleStatus = controller.getAgentLifecycleStatus(profile);
            const statusUi = AGENT_LIFECYCLE_UI[lifecycleStatus];
            const deptUi = DEPARTMENT_UI[profile.department];
            const isSimulated = profile.department === "customer_intelligence" || !!profile.personaAttributes;

            const rowBg = isSelected ? THEME_COLORS.bgActive : "transparent";

            return (
              <box
                key={profile.id}
                flexDirection="row"
                alignItems="center"
                backgroundColor={rowBg}
                paddingY={0}
              >
                {/* 1. Status Glyph & Label */}
                <box width={10} flexDirection="row">
                  <text fg={isSelected ? THEME_COLORS.statusInfo : THEME_COLORS.fgDim}>
                    {isSelected ? "▸ " : "  "}
                  </text>
                  <text
                    fg={
                      lifecycleStatus === "executing"
                        ? THEME_COLORS.statusSuccess
                        : lifecycleStatus === "selected"
                        ? THEME_COLORS.statusWarning
                        : lifecycleStatus === "enabled"
                        ? THEME_COLORS.statusInfo
                        : lifecycleStatus === "disabled"
                        ? THEME_COLORS.fgDim
                        : THEME_COLORS.fgSecondary
                    }
                    attributes={isSelected ? TextAttributes.BOLD : TextAttributes.NONE}
                  >
                    [{statusUi?.shortLabel ?? "REG"}]
                  </text>
                </box>

                {/* 2. Display Name */}
                <box width={26}>
                  <text
                    fg={isSelected ? THEME_COLORS.fgPrimary : THEME_COLORS.fgSecondary}
                    attributes={isSelected ? TextAttributes.BOLD : TextAttributes.NONE}
                  >
                    {profile.name.slice(0, 24)}
                  </text>
                </box>

                {/* 3. Role */}
                <box width={28}>
                  <text fg={isSelected ? THEME_COLORS.fgPrimary : THEME_COLORS.fgMuted}>
                    {profile.role.slice(0, 26)}
                  </text>
                </box>

                {/* 4. Department */}
                <box width={18}>
                  <text fg={isSimulated ? THEME_COLORS.statusSimulated : THEME_COLORS.statusInfo}>
                    {deptUi?.shortCode ?? profile.department}
                  </text>
                </box>

                {/* 5. Model Tier */}
                <box width={10}>
                  <text fg={THEME_COLORS.fgDim}>
                    [{profile.modelPreference?.tier ?? "std"}]
                  </text>
                </box>

                {/* 6. Persona Tag */}
                <box flexGrow={1} flexDirection="row">
                  {isSimulated ? (
                    <text fg={THEME_COLORS.statusSimulated} attributes={TextAttributes.BOLD}>
                      [SIMULATED]
                    </text>
                  ) : (
                    <text fg={THEME_COLORS.fgDim}>
                      {profile.capabilities.length} capabilities
                    </text>
                  )}
                </box>
              </box>
            );
          })}
        </box>
      )}

      {/* 4. Navigation & Keyboard Hints */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={1}>
        <text fg={THEME_COLORS.fgDim} attributes={TextAttributes.DIM}>
          [↑/↓, j/k] Navigate  •  [Enter/Space] Inspect Profile  •  [d] Cycle Dept  •  [f] Cycle Status  •  [Esc] Clear
        </text>
        <text fg={THEME_COLORS.statusAccent} attributes={TextAttributes.DIM}>
          Agent Identity vs Execution • PLAN.md Section 4.1
        </text>
      </box>
    </box>
  );
}

/**
 * Inspectable Agent Profile Detail Card.
 * Displays identity, capabilities, constraints, persona attributes [SIMULATED], and selection rationale.
 */
interface AgentDetailProps {
  readonly profile: AgentProfile;
  readonly lifecycleStatus: AgentLifecycleStatus;
  readonly selectionRationale?: {
    readonly rationale: string;
    readonly score: number;
    readonly matchedCapabilities: readonly string[];
    readonly matchedTasks: readonly string[];
    readonly reasons: readonly string[];
  };
  readonly onClose: () => void;
}

function AgentDetailInspectionCard({
  profile,
  lifecycleStatus,
  selectionRationale,
  onClose,
}: AgentDetailProps) {
  const isSimulated = profile.department === "customer_intelligence" || !!profile.personaAttributes;
  const statusUi = AGENT_LIFECYCLE_UI[lifecycleStatus];

  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="double"
      title={` SPECIALIST PROFILE: ${profile.name.toUpperCase()} `}
      titleColor={isSimulated ? THEME_COLORS.statusSimulated : THEME_COLORS.statusInfo}
      borderColor={isSimulated ? THEME_COLORS.statusSimulated : THEME_COLORS.borderFocused}
      backgroundColor={THEME_COLORS.bgCardElevated}
      paddingX={2}
      paddingY={1}
      marginTop={1}
      marginBottom={1}
    >
      {/* 1. Profile Title, Slug, & Lifecycle Badge */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <box flexDirection="row" alignItems="center">
          <text fg={THEME_COLORS.fgPrimary} attributes={TextAttributes.BOLD}>
            {profile.displayName || profile.name}{" "}
          </text>
          <text fg={THEME_COLORS.fgMuted}>({profile.slug})</text>
        </box>
        <box flexDirection="row">
          <text
            fg={
              lifecycleStatus === "executing"
                ? THEME_COLORS.statusSuccess
                : lifecycleStatus === "selected"
                ? THEME_COLORS.statusWarning
                : lifecycleStatus === "enabled"
                ? THEME_COLORS.statusInfo
                : THEME_COLORS.fgDim
            }
            attributes={TextAttributes.BOLD}
          >
            {statusUi?.glyph ?? "●"} [{statusUi?.label.toUpperCase() ?? lifecycleStatus.toUpperCase()}]
          </text>
        </box>
      </box>

      {/* 2. Simulated Customer Persona Mandatory Warning Banner */}
      {isSimulated && (
        <box
          flexDirection="column"
          border={true}
          borderStyle="single"
          title=" [SIMULATED CUSTOMER PERSONA] "
          titleColor={THEME_COLORS.statusSimulated}
          borderColor={THEME_COLORS.statusSimulated}
          backgroundColor={THEME_COLORS.bgCard}
          paddingX={1}
          paddingY={0}
          marginBottom={1}
        >
          <text fg={THEME_COLORS.statusSimulated} attributes={TextAttributes.BOLD}>
            Simulated viewpoint representing persona attributes.
          </text>
          <text fg={THEME_COLORS.fgSecondary}>
            Not a real human customer, interview subject, or statistically representative sample (PLAN.md Section 8 & Section 4.5).
          </text>

          {profile.personaAttributes && (
            <box flexDirection="column" marginTop={1}>
              <text fg={THEME_COLORS.fgPrimary}>
                • Occupation: {profile.personaAttributes.occupation}
              </text>
              <text fg={THEME_COLORS.fgPrimary}>
                • Tech Familiarity: {profile.personaAttributes.technicalFamiliarity} • Price Sensitivity: {profile.personaAttributes.priceSensitivity}
              </text>
              <text fg={THEME_COLORS.fgDim}>
                • Buying Criteria: {profile.personaAttributes.buyingCriteria.join(", ")}
              </text>
              <text fg={THEME_COLORS.fgDim}>
                • Adoption Barriers: {profile.personaAttributes.adoptionBarriers.join(", ")}
              </text>
            </box>
          )}
        </box>
      )}

      {/* 3. Description & Role */}
      <box flexDirection="column" marginBottom={1}>
        <text fg={THEME_COLORS.fgSecondary}>{profile.description}</text>
      </box>

      {/* 4. Selection Rationale Section (Prompt 15) */}
      <box
        flexDirection="column"
        border={true}
        borderStyle="single"
        title=" DEMAND-BASED SELECTION RATIONALE "
        titleColor={THEME_COLORS.statusAccent}
        borderColor={THEME_COLORS.borderSubtle}
        backgroundColor={THEME_COLORS.bgCard}
        paddingX={1}
        paddingY={0}
        marginBottom={1}
      >
        {selectionRationale ? (
          <box flexDirection="column">
            <box flexDirection="row" justifyContent="space-between">
              <text fg={THEME_COLORS.statusSuccess} attributes={TextAttributes.BOLD}>
                Matched for Execution (Candidate Score: {selectionRationale.score}/100)
              </text>
            </box>
            <text fg={THEME_COLORS.fgPrimary} marginTop={0}>
              {selectionRationale.rationale}
            </text>
            {selectionRationale.reasons.length > 0 && (
              <box flexDirection="column" marginTop={0}>
                {selectionRationale.reasons.map((r, i) => (
                  <text key={i} fg={THEME_COLORS.fgDim}>• {r}</text>
                ))}
              </box>
            )}
          </box>
        ) : (
          <box flexDirection="column">
            <text fg={THEME_COLORS.fgDim}>
              Agent is currently dormant. Selection rationale and capability match scores are generated dynamically by the orchestrator when a task plan matches this specialist profile.
            </text>
          </box>
        )}
      </box>

      {/* 5. Capabilities & Constraints */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        {/* Left: Capabilities */}
        <box flexDirection="column" flexGrow={1} marginRight={1}>
          <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD}>
            CAPABILITIES ({profile.capabilities.length}):
          </text>
          {profile.capabilities.slice(0, 3).map((cap) => (
            <box key={cap.id} flexDirection="row">
              <text fg={THEME_COLORS.statusInfo}>• {cap.name} </text>
              {cap.isConsequential && (
                <text fg={THEME_COLORS.statusApproval}>[CONSEQUENTIAL] </text>
              )}
            </box>
          ))}
        </box>

        {/* Right: Operational Constraints */}
        <box flexDirection="column" width={32}>
          <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD}>
            OPERATIONAL BOUNDS:
          </text>
          <text fg={THEME_COLORS.fgSecondary}>
            • Max tokens/turn: {profile.constraints?.maxTokensPerTurn ?? profile.limits.maxTokensPerTurn}
          </text>
          <text fg={THEME_COLORS.fgSecondary}>
            • Delegation depth: {profile.constraints?.maxDelegationDepth ?? profile.limits.maxDelegationDepth}
          </text>
          <text fg={THEME_COLORS.fgSecondary}>
            • Model tier: {profile.modelPreference?.tier ?? "standard"}
          </text>
        </box>
      </box>

      {/* 6. Footer Dismiss Hint */}
      <box flexDirection="row" justifyContent="space-between">
        <text fg={THEME_COLORS.statusInfo}>
          [Esc] or [Enter] Close detail view
        </text>
      </box>
    </box>
  );
}
