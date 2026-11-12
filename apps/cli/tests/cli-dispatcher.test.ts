/**
 * apps/cli/tests/cli-dispatcher.test.ts
 *
 * Tests for the CLI Command Dispatcher.
 * Contributed by A4 (Senior CLI/TUI Designer) & A1 (Platform & Architecture).
 */

import { describe, expect, it } from "bun:test";
import { dispatchCliCommand, printMainCliHelp } from "../src/commands/cli-dispatcher.ts";

describe("CLI Command Dispatcher Suite (A4 & A1)", () => {
  it("returns false when no CLI arguments are supplied (signals interactive TUI launch)", async () => {
    const handled = await dispatchCliCommand([]);
    expect(handled).toBe(false);
  });

  it("prints main CLI help documentation cleanly without error", () => {
    // Should execute without throwing
    expect(() => printMainCliHelp()).not.toThrow();
  });
});
