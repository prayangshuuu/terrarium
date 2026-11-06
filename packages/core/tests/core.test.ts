import { describe, expect, it } from "bun:test";
import {
  CORE_PACKAGE_NAME,
  CORE_VERSION,
  createCoreEngine,
} from "../src/index.ts";
import { getDefaultConfig } from "@terrarium/config";

describe("@terrarium/core package boundaries", () => {
  it("exports package metadata constants", () => {
    expect(CORE_PACKAGE_NAME).toBe("@terrarium/core");
    expect(CORE_VERSION).toBe("0.1.0");
  });

  it("initializes core engine with default state", () => {
    const config = getDefaultConfig({ appName: "TerrariumCoreTest" });
    const engine = createCoreEngine(config);

    expect(engine.config.appName).toBe("TerrariumCoreTest");
    const state = engine.getState();
    expect(state.status).toBe("idle");
    expect(state.activeExecutions).toBe(0);
    expect(typeof state.initializedAt).toBe("string");

    const packageInfo = engine.getPackageInfo();
    expect(packageInfo.name).toBe("@terrarium/core");
    expect(packageInfo.role).toBe("orchestration_engine");
  });

  it("handles clean shutdown lifecycle transition", async () => {
    const engine = createCoreEngine();
    expect(engine.getState().status).toBe("idle");

    const shutdownRes = await engine.shutdown();
    expect(shutdownRes.success).toBe(true);
    expect(engine.getState().status).toBe("cancelled");

    const repeatedShutdown = await engine.shutdown();
    expect(repeatedShutdown.success).toBe(false);
  });
});
