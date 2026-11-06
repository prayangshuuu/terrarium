import { describe, expect, it } from "bun:test";
import {
  CONTRACTS_PACKAGE_NAME,
  CONTRACTS_VERSION,
  fail,
  ok,
  type ExecutionStatus,
  type Result,
  type TerrariumPackageInfo,
} from "../src/index.ts";

describe("@terrarium/contracts package boundaries", () => {
  it("exports package metadata constants", () => {
    expect(CONTRACTS_PACKAGE_NAME).toBe("@terrarium/contracts");
    expect(CONTRACTS_VERSION).toBe("0.1.0");
  });

  it("produces valid Result ok and fail objects", () => {
    const successRes: Result<number, string> = ok(42);
    expect(successRes.success).toBe(true);
    if (successRes.success) {
      expect(successRes.data).toBe(42);
    }

    const failureRes: Result<number, string> = fail("Operation failed");
    expect(failureRes.success).toBe(false);
    if (!failureRes.success) {
      expect(failureRes.error).toBe("Operation failed");
    }
  });

  it("verifies package info interface conformance", () => {
    const info: TerrariumPackageInfo = {
      name: CONTRACTS_PACKAGE_NAME,
      version: CONTRACTS_VERSION,
      role: "domain_contracts",
    };
    expect(info.name).toBe("@terrarium/contracts");
    expect(info.role).toBe("domain_contracts");
  });

  it("verifies execution status types", () => {
    const statuses: ExecutionStatus[] = [
      "idle",
      "queued",
      "running",
      "completed",
      "failed",
      "cancelled",
      "blocked",
    ];
    expect(statuses.length).toBe(7);
  });
});
