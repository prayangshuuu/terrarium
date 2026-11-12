/**
 * apps/cli/src/index.tsx
 *
 * Terrarium Interactive OpenTUI Terminal Shell Entrypoint.
 * Aligns with PLAN.md Section 16 & Prompt 14 specifications.
 */

import React from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { getDefaultConfig } from "@terrarium/config";
import { createCoreEngine } from "@terrarium/core";
import { UiStateController, TerrariumUiProvider, AppShell } from "./ui/index.js";
import { dispatchCliCommand } from "./commands/cli-dispatcher.ts";

export { AppShell, UiStateController, TerrariumUiProvider };

// Only initialize and mount if executed directly as main script
const isMain = import.meta.main;

if (isMain) {
  const cliArgs = process.argv.slice(2);
  if (cliArgs.length > 0) {
    await dispatchCliCommand(cliArgs);
  } else {
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
}
