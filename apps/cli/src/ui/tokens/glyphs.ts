/**
 * apps/cli/src/ui/tokens/glyphs.ts
 *
 * Terminal glyphs, status symbols, and ASCII fallbacks.
 * Contributed by A4 (Senior CLI/TUI Designer) & A5 (Product Interface Designer).
 */

export const GLYPHS = {
  // Brand & Identity
  brandLogo: "◈",
  brandDot: "●",
  brandPulse: "⚡",

  // Navigation & Hierarchy
  navArrow: "▸",
  navArrowRight: "›",
  navArrowDown: "▾",
  navBreadcrumbSeparator: "›",
  navActiveMarker: "●",
  navInactiveMarker: "○",

  // Lifecycle & Status
  statusSuccess: "✓",
  statusError: "✗",
  statusWarning: "▲",
  statusPending: "⏳",
  statusRunning: "▶",
  statusIdle: "·",
  statusBlocked: "■",
  statusCancelled: "⊘",

  // Workspace Icons
  wsOverview: "◈",
  wsEcosystem: "👥",
  wsDepartments: "🏛",
  wsConversations: "💬",
  wsTasks: "📋",
  wsStudio: "⚡",
  wsMemory: "🧠",
  wsReports: "📊",
  wsAnalytics: "📈",
  wsSettings: "⚙",

  // UI Elements
  help: "?",
  search: "🔍",
  filter: "▼",
  lock: "🔒",
  shield: "🛡",
  folder: "📁",
  file: "📄",
  budget: "💰",
  clock: "🕒",
  sparkle: "✨",

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
  brandPulse: ">",
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
  lock: "!",
  shield: "#",
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
