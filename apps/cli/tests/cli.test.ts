import { describe, expect, it } from "bun:test";
import { CONTRACTS_VERSION } from "@terrarium/contracts";
import { getDefaultConfig } from "@terrarium/config";
import { createCoreEngine } from "@terrarium/core";

describe("apps/cli workspace integration", () => {
  it("imports and uses workspace packages cleanly", () => {
    expect(CONTRACTS_VERSION).toBe("0.1.0");

    const config = getDefaultConfig();
    expect(config.appName).toBe("TERRARIUM");

    const engine = createCoreEngine(config);
    expect(engine.getState().status).toBe("idle");
    expect(engine.getPackageInfo().name).toBe("@terrarium/core");
  });
});
