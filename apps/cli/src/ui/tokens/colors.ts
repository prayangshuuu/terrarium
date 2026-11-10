/**
 * apps/cli/src/ui/tokens/colors.ts
 *
 * Restrained color palette and semantic tokens for Terrarium terminal UI.
 * Contributed by A5 (Senior Frontend/Product Interface Designer).
 * Aligns with PLAN.md Section 16 (restrained, accessible, high-contrast palette).
 */

export const THEME_COLORS = {
  // Surfaces and Backgrounds
  bgApp: "#0B0F17",
  bgSidebar: "#0D131D",
  bgHeader: "#080B10",
  bgFooter: "#080B10",
  bgCard: "#131B26",
  bgCardElevated: "#182332",
  bgCardHover: "#1E293B",
  bgActive: "#1E2A3C",
  bgHighlight: "#163456",
  bgOverlay: "#0B0F17E6", // with alpha if supported, or fallback
  bgInput: "#0D131D",

  // Text and Foregrounds
  fgPrimary: "#F8FAFC",      // Crisp white
  fgSecondary: "#94A3B8",    // Slate light
  fgMuted: "#64748B",        // Slate mid
  fgDim: "#475569",          // Slate dark
  fgInverse: "#0B0F17",      // Dark on bright backgrounds

  // Borders and Dividers
  borderSubtle: "#1E293B",
  borderDefault: "#243247",
  borderFocused: "#38BDF8",
  borderActive: "#38BDF8",
  borderHeader: "#1A2433",

  // Semantic Status Accents
  statusSuccess: "#34D399",   // Emerald green (safe, completed, verified)
  statusWarning: "#FBBF24",   // Amber yellow (budget warning, pending, retry)
  statusDanger: "#F87171",    // Red (failed, error, blocked, critical)
  statusInfo: "#38BDF8",      // Sky cyan (info, active step, running)
  statusAccent: "#A78BFA",    // Violet (intelligence, reasoning, orchestration)
  statusSimulated: "#C084FC", // Purple (strictly reserved for simulated personas/data)
  statusApproval: "#FB923C",  // Orange (consequential actions requiring authorization)

  // Department Badges (consistent with contracts)
  deptEngineering: "#38BDF8",
  deptCustomerIntelligence: "#C084FC",
  deptProductManagement: "#34D399",
  deptDesign: "#F472B6",
  deptMarketing: "#FBBF24",
  deptSecurity: "#F87171",
  deptResearch: "#60A5FA",
  deptDocumentation: "#A3E635",
  deptLegal: "#E879F9",
  deptExecutive: "#FCD34D",
} as const;

export type ThemeColorName = keyof typeof THEME_COLORS;

/**
 * Returns a hex color for a given status or risk level.
 */
export function getSemanticColor(
  type: "success" | "warning" | "danger" | "info" | "accent" | "simulated" | "approval"
): string {
  switch (type) {
    case "success":
      return THEME_COLORS.statusSuccess;
    case "warning":
      return THEME_COLORS.statusWarning;
    case "danger":
      return THEME_COLORS.statusDanger;
    case "info":
      return THEME_COLORS.statusInfo;
    case "accent":
      return THEME_COLORS.statusAccent;
    case "simulated":
      return THEME_COLORS.statusSimulated;
    case "approval":
      return THEME_COLORS.statusApproval;
    default:
      return THEME_COLORS.fgPrimary;
  }
}
