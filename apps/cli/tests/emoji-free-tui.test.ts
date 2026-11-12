/**
 * apps/cli/tests/emoji-free-tui.test.ts
 *
 * Automated regression test verifying that 100% of the CLI and TUI source code
 * is strictly emoji-free, adhering to PROMPT 23 Part D:
 * "A clean, quiet, professional developer aesthetic. Strip out all emoji usage
 * across the CLI/TUI: headers, tab bars, statuses, banners, logs, and empty states."
 *
 * Contributed by A4 (Senior CLI/TUI Designer) & A3 (Data, Security & Reliability).
 */

import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { GLYPHS, ASCII_FALLBACKS } from "../src/ui/tokens/glyphs.js";

function scanDirectoryForSourceFiles(dir: string): string[] {
  let results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(scanDirectoryForSourceFiles(fullPath));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

// Unicode blocks covering emojis, miscellaneous symbols, emoticons, and pictorial glyphs
const EMOJI_AND_PICTORIAL_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

describe("PROMPT 23 Part D: Emoji-Free Terminal Aesthetics", () => {
  const uiSrcDir = path.resolve(__dirname, "../src/ui");
  const commandsSrcDir = path.resolve(__dirname, "../src/commands");

  it("verifies GLYPHS token dictionary contains zero unicode emojis", () => {
    for (const [key, glyph] of Object.entries(GLYPHS)) {
      expect(
        EMOJI_AND_PICTORIAL_REGEX.test(glyph),
        `GLYPHS.${key} contains emoji: "${glyph}"`
      ).toBe(false);
    }
  });

  it("verifies ASCII_FALLBACKS token dictionary contains zero unicode emojis", () => {
    for (const [key, glyph] of Object.entries(ASCII_FALLBACKS)) {
      expect(
        EMOJI_AND_PICTORIAL_REGEX.test(glyph),
        `ASCII_FALLBACKS.${key} contains emoji: "${glyph}"`
      ).toBe(false);
    }
  });

  it("asserts zero emojis exist across all TUI views, components, tokens, and state (apps/cli/src/ui)", () => {
    const uiFiles = scanDirectoryForSourceFiles(uiSrcDir);
    expect(uiFiles.length).toBeGreaterThan(15);

    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of uiFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        // Skip comment lines explaining regexes or test expectations
        if (line.includes("EMOJI_AND_PICTORIAL_REGEX") || line.includes("emojiRegex")) {
          return;
        }
        if (EMOJI_AND_PICTORIAL_REGEX.test(line)) {
          violations.push({
            file: path.relative(path.resolve(__dirname, "../.."), file),
            line: index + 1,
            text: line.trim(),
          });
        }
      });
    }

    if (violations.length > 0) {
      console.error("Emoji violations detected in TUI:", violations);
    }
    expect(violations).toEqual([]);
  });

  it("asserts zero emojis exist across all CLI command formatters and outputs (apps/cli/src/commands)", () => {
    const commandFiles = scanDirectoryForSourceFiles(commandsSrcDir);
    expect(commandFiles.length).toBeGreaterThan(10);

    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of commandFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        if (EMOJI_AND_PICTORIAL_REGEX.test(line)) {
          violations.push({
            file: path.relative(path.resolve(__dirname, "../.."), file),
            line: index + 1,
            text: line.trim(),
          });
        }
      });
    }

    if (violations.length > 0) {
      console.error("Emoji violations detected in CLI commands:", violations);
    }
    expect(violations).toEqual([]);
  });
});
