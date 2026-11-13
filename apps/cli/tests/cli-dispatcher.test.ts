/**
 * apps/cli/tests/cli-dispatcher.test.ts
 *
 * Tests for the Universal CLI Command Dispatcher (Prompt 24 & Prompt 25).
 * Contributed by A4 (Senior CLI/TUI Designer) & A1 (Platform & Architecture).
 */

import { describe, expect, it } from "bun:test";
import { dispatchCliCommand, printMainCliHelp } from "../src/commands/cli-dispatcher.ts";

describe("CLI Command Dispatcher Suite (A4 & A1 - Prompt 25)", () => {
  it("returns false when no CLI arguments are supplied (signals interactive TUI launch)", async () => {
    const handled = await dispatchCliCommand([]);
    expect(handled).toBe(false);
  });

  it("prints main CLI help documentation cleanly without error", () => {
    expect(() => printMainCliHelp()).not.toThrow();
  });

  it("dispatches help command", async () => {
    let exitedWith = -1;
    const origExit = process.exit;
    process.exit = ((code?: number) => {
      exitedWith = code ?? 0;
      throw new Error("EXIT");
    }) as any;

    try {
      await dispatchCliCommand(["help"]);
    } catch (e: any) {
      expect(e.message).toBe("EXIT");
    } finally {
      process.exit = origExit;
    }
    expect(exitedWith).toBe(0);
  });

  it("routes 'claude code --dry-run' through dispatcher", async () => {
    let exitedWith = -1;
    const origExit = process.exit;
    process.exit = ((code?: number) => {
      exitedWith = code ?? 0;
      throw new Error("EXIT");
    }) as any;

    try {
      await dispatchCliCommand(["claude", "code", "--dry-run"]);
    } catch (e: any) {
      expect(e.message).toBe("EXIT");
    } finally {
      process.exit = origExit;
    }
    expect(exitedWith).toBe(0);
  });

  it("routes 'agy --dry-run' through dispatcher", async () => {
    let exitedWith = -1;
    const origExit = process.exit;
    process.exit = ((code?: number) => {
      exitedWith = code ?? 0;
      throw new Error("EXIT");
    }) as any;

    try {
      await dispatchCliCommand(["agy", "--dry-run"]);
    } catch (e: any) {
      expect(e.message).toBe("EXIT");
    } finally {
      process.exit = origExit;
    }
    expect(exitedWith).toBe(0);
  });

  it("routes 'agent --dry-run' through dispatcher", async () => {
    let exitedWith = -1;
    const origExit = process.exit;
    process.exit = ((code?: number) => {
      exitedWith = code ?? 0;
      throw new Error("EXIT");
    }) as any;

    try {
      await dispatchCliCommand(["agent", "--dry-run"]);
    } catch (e: any) {
      expect(e.message).toBe("EXIT");
    } finally {
      process.exit = origExit;
    }
    expect(exitedWith).toBe(0);
  });

  it("routes '--ollama llama3.2 --dry-run' through dispatcher", async () => {
    let exitedWith = -1;
    const origExit = process.exit;
    process.exit = ((code?: number) => {
      exitedWith = code ?? 0;
      throw new Error("EXIT");
    }) as any;

    try {
      await dispatchCliCommand(["--ollama", "llama3.2", "--dry-run"]);
    } catch (e: any) {
      expect(e.message).toBe("EXIT");
    } finally {
      process.exit = origExit;
    }
    expect(exitedWith).toBe(0);
  });
});
