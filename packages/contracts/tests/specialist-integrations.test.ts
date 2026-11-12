/**
 * @terrarium/contracts - tests/specialist-integrations.test.ts
 *
 * Unit tests for specialist integrations contracts, ranking evaluation, and domain validators.
 * Aligns with PROMPT 19 requirements (A1 - Boundaries & A3 - Reliability).
 */

import { describe, expect, it } from "bun:test";
import {
  INTEGRATION_RANKINGS,
  INTEGRATION_VALUE_LEVELS,
  INTEGRATION_RISK_LEVELS,
  INTEGRATION_MAINTENANCE_LEVELS,
  INTEGRATION_SUPPORT_LEVELS,
  INTEGRATION_CONNECTION_MODES,
  validateSpecialistIntegration,
  type SpecialistIntegration,
} from "../src/index.ts";

describe("Specialist Integrations Contracts & Rankings Suite", () => {
  it("provides canonical integration rankings ordered strictly by rank", () => {
    expect(INTEGRATION_RANKINGS.length).toBe(5);

    // Verify ordering 1 through 5
    for (let i = 0; i < INTEGRATION_RANKINGS.length; i++) {
      const item = INTEGRATION_RANKINGS[i];
      expect(item).toBeDefined();
      if (item) {
        expect(item.rank).toBe(i + 1);
      }
    }

    const ids = INTEGRATION_RANKINGS.map((r) => r.id);
    expect(ids).toEqual(["anthropic", "ollama", "openai", "gemini", "claude-code-cli"]);
  });

  it("verifies top-ranked integration is Anthropic with critical value and low risk", () => {
    const anthropic = INTEGRATION_RANKINGS[0];
    expect(anthropic).toBeDefined();
    if (!anthropic) return;
    expect(anthropic.id).toBe("anthropic");
    expect(anthropic.userValue).toBe("critical");
    expect(anthropic.risk).toBe("low");
    expect(anthropic.supportStatus).toBe("tier1_official");
    expect(anthropic.connectionMode).toBe("explicit_key");
    expect(anthropic.requiredScopes).toContain("messages:write");
    expect(anthropic.dataFlowSummary).toContain("api.anthropic.com");
    expect(anthropic.sideEffects.length).toBeGreaterThan(0);
    expect(anthropic.limitations.length).toBeGreaterThan(0);
  });

  it("verifies rank 2 integration is Ollama for 100% private offline execution", () => {
    const ollama = INTEGRATION_RANKINGS[1];
    expect(ollama).toBeDefined();
    if (!ollama) return;
    expect(ollama.id).toBe("ollama");
    expect(ollama.userValue).toBe("high");
    expect(ollama.risk).toBe("low");
    expect(ollama.supportStatus).toBe("tier1_official");
    expect(ollama.connectionMode).toBe("local_daemon");
    expect(ollama.dataFlowSummary).toContain("localhost");
    expect(ollama.sideEffects[0]).toContain("hardware");
  });

  it("verifies coding agent CLI integration is classified with high risk profile", () => {
    const cliIntegration = INTEGRATION_RANKINGS[4];
    expect(cliIntegration).toBeDefined();
    if (!cliIntegration) return;
    expect(cliIntegration.id).toBe("claude-code-cli");
    expect(cliIntegration.kind).toBe("coding_agent_cli");
    expect(cliIntegration.risk).toBe("high");
    expect(cliIntegration.connectionMode).toBe("cli_subprocess");
    expect(cliIntegration.requiredScopes).toContain("subproc:sandbox_exec");
    expect(cliIntegration.sideEffects[0]).toContain("child processes");
  });

  it("validates a compliant SpecialistIntegration object via domain validator", () => {
    const sample = INTEGRATION_RANKINGS[0];
    const validation = validateSpecialistIntegration(sample);
    expect(validation.success).toBe(true);
    if (validation.success) {
      expect(validation.data.id).toBe("anthropic");
      expect(validation.data.rank).toBe(1);
    }
  });

  it("rejects invalid integration objects with missing or malformed fields", () => {
    const invalid = {
      id: "unknown",
      rank: 0, // must be min 1
      userValue: "infinite", // invalid enum
    };

    const validation = validateSpecialistIntegration(invalid);
    expect(validation.success).toBe(false);
  });
});
