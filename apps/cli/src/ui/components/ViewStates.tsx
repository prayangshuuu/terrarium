/**
 * apps/cli/src/ui/components/ViewStates.tsx
 *
 * Dedicated safety, status, and feedback state components.
 * Contributed by A3 (Data, Security & Reliability) & A5 (Product Interface Designer).
 * Aligns with Prompt 14: "Provide loading/empty/error/disconnected states. Clearly label demo data."
 */

import React, { type ReactNode } from "react";
import { TextAttributes } from "@opentui/core";
import { THEME_COLORS } from "../tokens/colors.js";
import { GLYPHS } from "../tokens/glyphs.js";

export interface LoadingStateProps {
  readonly message?: string;
  readonly detail?: string;
}

export function LoadingState({
  message = "Loading workspace data...",
  detail = "Synchronizing state with core engine",
}: LoadingStateProps) {
  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingY={4}
      paddingX={2}
    >
      <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.BOLD}>
        {GLYPHS.statusPending} {message}
      </text>
      <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.DIM}>
        {detail}
      </text>
    </box>
  );
}

export interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly actionHint?: string;
  readonly icon?: string;
}

export function EmptyState({
  title,
  description,
  actionHint,
  icon = GLYPHS.folder,
}: EmptyStateProps) {
  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingY={4}
      paddingX={2}
      border={true}
      borderStyle="single"
      borderColor={THEME_COLORS.borderSubtle}
      backgroundColor={THEME_COLORS.bgCard}
    >
      <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.BOLD}>
        {icon} {title}
      </text>
      <text fg={THEME_COLORS.fgSecondary} attributes={TextAttributes.NONE}>
        {description}
      </text>
      {actionHint && (
        <box marginTop={1}>
          <text fg={THEME_COLORS.statusInfo} attributes={TextAttributes.DIM}>
            {actionHint}
          </text>
        </box>
      )}
    </box>
  );
}

export interface ErrorStateProps {
  readonly title?: string;
  readonly error: string;
  readonly onRetry?: () => void;
  readonly recoveryHint?: string;
}

export function ErrorState({
  title = "Component Execution Error",
  error,
  onRetry,
  recoveryHint = "Press [Esc] to navigate back or restart workspace session",
}: ErrorStateProps) {
  return (
    <box
      flexDirection="column"
      paddingY={2}
      paddingX={2}
      border={true}
      borderStyle="rounded"
      borderColor={THEME_COLORS.statusDanger}
      backgroundColor={THEME_COLORS.bgCard}
    >
      <box flexDirection="row" alignItems="center" marginBottom={1}>
        <text fg={THEME_COLORS.statusDanger} attributes={TextAttributes.BOLD}>
          {GLYPHS.statusError} {title}
        </text>
      </box>
      <text fg={THEME_COLORS.fgPrimary}>
        {error}
      </text>
      <box marginTop={1}>
        <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.DIM}>
          {recoveryHint}
        </text>
      </box>
    </box>
  );
}

export interface DisconnectedStateProps {
  readonly engineStatus?: string;
  readonly onReconnect?: () => void;
}

export function DisconnectedState({
  engineStatus = "disconnected",
  onReconnect,
}: DisconnectedStateProps) {
  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingY={3}
      paddingX={2}
      border={true}
      borderStyle="rounded"
      borderColor={THEME_COLORS.statusWarning}
      backgroundColor={THEME_COLORS.bgCard}
    >
      <text fg={THEME_COLORS.statusWarning} attributes={TextAttributes.BOLD}>
        {GLYPHS.statusWarning} Engine Status: {engineStatus.toUpperCase()}
      </text>
      <text fg={THEME_COLORS.fgSecondary}>
        Cannot connect to Terrarium core daemon or local state service.
      </text>
      <box marginTop={1}>
        <text fg={THEME_COLORS.fgMuted} attributes={TextAttributes.DIM}>
          Operating in offline inspection mode. Run `terrarium start` to activate the engine.
        </text>
      </box>
    </box>
  );
}

export interface DemoDataBadgeProps {
  readonly isSimulated?: boolean;
  readonly label?: string;
}

/**
 * Prominently labels simulated personas, synthesized metrics, and mock fixtures.
 * Strictly adheres to PLAN_CONTEXT.md Section 2.
 */
export function DemoDataBadge({
  isSimulated = false,
  label,
}: DemoDataBadgeProps) {
  const badgeText = label ?? (isSimulated ? GLYPHS.simulatedTag : GLYPHS.demoTag);
  const color = isSimulated ? THEME_COLORS.statusSimulated : THEME_COLORS.statusWarning;

  return (
    <box flexDirection="row" alignItems="center">
      <text fg={color} attributes={TextAttributes.BOLD}>
        {badgeText}
      </text>
    </box>
  );
}
