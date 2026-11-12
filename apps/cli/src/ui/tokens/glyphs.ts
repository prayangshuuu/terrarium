/**
 * apps/cli/src/ui/tokens/glyphs.ts
 *
 * Professional, emoji-free terminal glyphs, status symbols, and ASCII fallbacks.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 * Strictly complies with PROMPT 23 Part D: Zero emoji in product UI.
 */

export const GLYPHS = {
  // Brand & Identity
  brandLogo: "◈",
  brandDot: "●",
  brandPulse: "*",

  // Navigation & Hierarchy
  navArrow: "▸",
  navArrowRight: "›",
  navArrowDown: "▾",
  navBreadcrumbSeparator: "›",
  navActiveMarker: "●",
  navInactiveMarker: "○",

  // Lifecycle & Status (Clear Text & Restrained Unicode)
  statusSuccess: "[OK]",
  statusError: "[ERR]",
  statusWarning: "[WARN]",
  statusPending: "WAIT",
  statusRunning: "▶",
  statusIdle: "·",
  statusBlocked: "■",
  statusCancelled: "⊘",

  // Workspace Indicators (Numbered Monospace Badges)
  wsOverview: "[1]",
  wsEcosystem: "[2]",
  wsDepartments: "[3]",
  wsConversations: "[4]",
  wsTasks: "[5]",
  wsStudio: "[6]",
  wsMemory: "[7]",
  wsReports: "[8]",
  wsAnalytics: "[9]",
  wsSettings: "[0]",

  // UI Elements
  help: "?",
  search: "/",
  filter: "▼",
  lock: "[SEC]",
  shield: "[POL]",
  folder: "/",
  file: "-",
  budget: "$",
  clock: "@",
  sparkle: "*",

  // Tags & Labels
  simulatedTag: "[SIMULATED]",
  demoTag: "[DEMO DATA]",
  sampleTag: "[SAMPLE]",
  confirmedTag: "[CONFIRMED]",
  hypothesisTag: "[HYPOTHESIS]",
  inferredTag: "[INFERRED]",
} as const;

export const ASCII_FALLBACKS = {
  brandLogo: "*",
  brandDot: "*",
  brandPulse: "*",
  navArrow: ">",
  navArrowRight: ">",
  navArrowDown: "v",
  navBreadcrumbSeparator: "/",
  navActiveMarker: "*",
  navInactiveMarker: "o",
  statusSuccess: "OK",
  statusError: "ERR",
  statusWarning: "WARN",
  statusPending: "WAIT",
  statusRunning: "RUN",
  statusIdle: "-",
  statusBlocked: "BLOCK",
  statusCancelled: "CANC",
  wsOverview: "[1]",
  wsEcosystem: "[2]",
  wsDepartments: "[3]",
  wsConversations: "[4]",
  wsTasks: "[5]",
  wsStudio: "[6]",
  wsMemory: "[7]",
  wsReports: "[8]",
  wsAnalytics: "[9]",
  wsSettings: "[0]",
  help: "?",
  search: "/",
  filter: "v",
  lock: "[SEC]",
  shield: "[POL]",
  folder: "/",
  file: "-",
  budget: "$",
  clock: "@",
  sparkle: "*",
  simulatedTag: "[SIMULATED]",
  demoTag: "[DEMO DATA]",
  sampleTag: "[SAMPLE]",
  confirmedTag: "[CONFIRMED]",
  hypothesisTag: "[HYPOTHESIS]",
  inferredTag: "[INFERRED]",
} as const;

/**
 * Returns either unicode glyph or ascii fallback based on unicode capability.
 */
export function getGlyph(name: keyof typeof GLYPHS, unicode = true): string {
  if (!unicode) {
    return ASCII_FALLBACKS[name] ?? "*";
  }
  return GLYPHS[name];
}
