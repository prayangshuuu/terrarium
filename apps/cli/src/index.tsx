/**
 * apps/cli/src/index.tsx
 *
 * Terrarium Interactive OpenTUI Terminal Shell Entrypoint.
 * Aligns with PLAN.md Section 16 & Prompt 26 specifications.
 */

import React from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { getDefaultConfig } from "@terrarium/config";
import { createCoreEngine } from "@terrarium/core";
import { UiStateController, TerrariumUiProvider, AppShell } from "./ui/index.js";
import { dispatchCliCommand } from "./commands/cli-dispatcher.ts";

export { AppShell, UiStateController, TerrariumUiProvider };

export async function runCli(cliArgs: readonly string[] = process.argv.slice(2)): Promise<void> {
  // 1. Direct CLI subcommand or prompt arguments
  if (cliArgs.length > 0) {
    await dispatchCliCommand(cliArgs);
    return;
  }

  // 2. Check for piped stdin prompt (e.g. echo "Explain codebase" | terrarium)
  if (!process.stdin.isTTY) {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const pipedPrompt = Buffer.concat(chunks).toString("utf8").trim();
      if (pipedPrompt.length > 0) {
        await dispatchCliCommand([pipedPrompt]);
        return;
      }
    } catch {
      // Fall through to interactive TUI if reading stdin fails
    }
  }

  // 3. Launch interactive OpenTUI workspace
  const config = getDefaultConfig();
  const engine = createCoreEngine({ config, enableDatabase: true });
  const controller = new UiStateController({
    engine,
    projectName: config.appName,
    environment: "development",
  });

  const renderer = await createCliRenderer();

  const handleQuit = async () => {
    controller.destroy();
    try {
      await engine.shutdown();
    } catch {}
    renderer.destroy();
    process.exit(0);
  };

  createRoot(renderer).render(
    <TerrariumUiProvider controller={controller}>
      <AppShell
        version={config.version}
        onQuit={handleQuit}
      />
    </TerrariumUiProvider>
  );
}

// Auto-run if executed directly as main script
if (import.meta.main) {
  await runCli();
}
