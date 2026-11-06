import { createCliRenderer, TextAttributes } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { CONTRACTS_VERSION } from "@terrarium/contracts";
import { getDefaultConfig } from "@terrarium/config";
import { createCoreEngine } from "@terrarium/core";

const config = getDefaultConfig();
const engine = createCoreEngine(config);
const engineState = engine.getState();

function App() {
  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <box justifyContent="center" alignItems="flex-end">
        <ascii-font font="tiny" text="TERRARIUM" />
        <text attributes={TextAttributes.DIM}>
          v{config.version} (contracts v{CONTRACTS_VERSION}) • Status: {engineState.status}
        </text>
        <text attributes={TextAttributes.DIM}>
          On-Demand Multi-Agent AI Orchestration
        </text>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
