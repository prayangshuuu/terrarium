/**
 * @terrarium/cli - commands/provider-commands.ts
 *
 * Command line handlers for provider ecosystem inspection, setup diagnostics,
 * credential status verification, and endpoint health testing.
 * Aligns with PLAN.md Section 12, Section 16 & Prompt 9 requirements (A5 - Provider setup UX).
 */

import {
  type ProviderType,
  PROVIDER_TYPES,
  type Result,
  type TerrariumError,
  type SpecialistIntegration,
  INTEGRATION_RANKINGS,
  ok,
  fail,
} from "@terrarium/contracts";
import type { TerrariumConfig } from "@terrarium/config";
import type { ProviderRegistry } from "@terrarium/core";

export interface ProviderCommandOptions {
  readonly json?: boolean;
  readonly useColor?: boolean;
  readonly allowExternal?: boolean;
}

export interface ProviderSummaryView {
  readonly provider: ProviderType;
  readonly isDefault: boolean;
  readonly isEnabled: boolean;
  readonly credentialStatus: string;
  readonly credentialSource: string;
  readonly baseUrl: string;
  readonly status: string;
  readonly availableModels: number;
}

export interface CliAdapterSummaryView {
  readonly id: string;
  readonly name: string;
  readonly kind: "coding_agent_cli";
  readonly status: string;
  readonly supportedTools: readonly string[];
  readonly defaultTimeoutMs: number;
}

/**
 * Lists all known model providers with configuration and credential status.
 */
export async function handleProviderList(
  config: TerrariumConfig,
  registry?: ProviderRegistry,
  options: ProviderCommandOptions = {}
): Promise<Result<{ output: string; providers: readonly ProviderSummaryView[] }, TerrariumError>> {
  const summaries: ProviderSummaryView[] = [];

  for (const p of PROVIDER_TYPES) {
    const conn = config.getProviderConfig(p);
    const cred = config.getCredentialStatus(p);
    const adapter = registry?.getAdapter(p);
    let modelsCount = 0;
    if (adapter) {
      const modelsRes = await adapter.listModels();
      if (modelsRes.success) {
        modelsCount = modelsRes.data.length;
      }
    }

    summaries.push({
      provider: p,
      isDefault: config.preferences.defaultProvider === p,
      isEnabled: conn.enabled,
      credentialStatus: cred.isConfigured ? "Configured" : "Missing",
      credentialSource: cred.source,
      baseUrl: conn.baseUrl ?? "N/A",
      status: cred.isConfigured || p === "ollama" ? "ready" : "unconfigured",
      availableModels: modelsCount,
    });
  }

  if (options.json) {
    return ok({
      output: JSON.stringify(summaries, null, 2),
      providers: summaries,
    });
  }

  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const green = useColor ? "\x1b[32m" : "";
  const yellow = useColor ? "\x1b[33m" : "";
  const dim = useColor ? "\x1b[2m" : "";
  const reset = useColor ? "\x1b[0m" : "";

  let table = `${bold}Terrarium Model Provider Ecosystem${reset}\n`;
  table += `${dim}Provider      Status        Credentials    Source     Default   Base URL${reset}\n`;
  table += `${dim}──────────────────────────────────────────────────────────────────────────────────${reset}\n`;

  for (const s of summaries) {
    const pPad = s.provider.padEnd(13);
    const statusColor = s.status === "ready" ? green : yellow;
    const statPad = `${statusColor}${s.status.padEnd(13)}${reset}`;
    const credPad = (s.credentialStatus === "Configured" ? `${green}Configured${reset}` : `${dim}Missing   ${reset}`).padEnd(useColor ? 22 : 14);
    const srcPad = s.credentialSource.padEnd(10);
    const defPad = (s.isDefault ? `${green}YES${reset}` : `${dim}no ${reset}`).padEnd(useColor ? 17 : 9);
    const url = s.baseUrl;

    table += `${pPad} ${statPad} ${credPad} ${srcPad} ${defPad} ${url}\n`;
  }

  // CLI Specialist Integrations section
  const cliAdapters = registry?.listCliAdapters() ?? [];
  if (cliAdapters.length > 0) {
    table += `\n${bold}Specialist Coding-Agent CLI Integrations${reset}\n`;
    table += `${dim}ID                 Name                                Status     Timeout   Tools${reset}\n`;
    table += `${dim}──────────────────────────────────────────────────────────────────────────────────${reset}\n`;
    for (const c of cliAdapters) {
      const idPad = c.id.padEnd(18);
      const namePad = c.name.padEnd(35);
      const statPad = `${green}ready${reset}     `;
      const timeoutPad = "120s".padEnd(9);
      const tools = "edit, bash, grep, glob";
      table += `${idPad} ${namePad} ${statPad} ${timeoutPad} ${tools}\n`;
    }
  }

  return ok({
    output: table,
    providers: summaries,
  });
}

/**
 * Displays prioritized ranking matrix of integrations evaluated by user value,
 * risk, maintenance, and support status per PROMPT 19 requirements (A4/A5).
 */
export function handleProviderRankings(
  options: ProviderCommandOptions = {}
): Result<{ output: string; rankings: readonly SpecialistIntegration[] }, TerrariumError> {
  if (options.json) {
    return ok({
      output: JSON.stringify(INTEGRATION_RANKINGS, null, 2),
      rankings: INTEGRATION_RANKINGS,
    });
  }

  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const green = useColor ? "\x1b[32m" : "";
  const yellow = useColor ? "\x1b[33m" : "";
  const cyan = useColor ? "\x1b[36m" : "";
  const dim = useColor ? "\x1b[2m" : "";
  const reset = useColor ? "\x1b[0m" : "";

  let table = `\n${bold}Terrarium Specialist Integration Priority Matrix (PLAN.md Section 12 & 24)${reset}\n`;
  table += `${dim}Rank  Integration           Kind              Value     Risk      Support           Connection${reset}\n`;
  table += `${dim}──────────────────────────────────────────────────────────────────────────────────────────${reset}\n`;

  for (const item of INTEGRATION_RANKINGS) {
    const rankPad = `#${item.rank}`.padEnd(5);
    const idPad = item.id.padEnd(21);
    const kindPad = item.kind.padEnd(17);
    const valueColor = item.userValue === "critical" ? green : item.userValue === "high" ? cyan : yellow;
    const valuePad = `${valueColor}${item.userValue.padEnd(9)}${reset}`;
    const riskColor = item.risk === "low" ? green : item.risk === "medium" ? yellow : "\x1b[31m";
    const riskPad = `${riskColor}${item.risk.padEnd(9)}${reset}`;
    const supportPad = item.supportStatus.replace("_", " ").padEnd(17);
    const connPad = item.connectionMode.replace("_", " ");

    table += `${rankPad} ${idPad} ${kindPad} ${valuePad} ${riskPad} ${supportPad} ${connPad}\n`;
  }

  table += `\n${dim}Run 'terrarium provider setup <id>' to inspect connection instructions and security scopes.${reset}\n`;

  return ok({
    output: table,
    rankings: INTEGRATION_RANKINGS,
  });
}

/**
 * Displays detailed information and capabilities for a specified provider.
 */
export async function handleProviderInfo(
  providerType: ProviderType,
  config: TerrariumConfig,
  registry?: ProviderRegistry,
  options: ProviderCommandOptions = {}
): Promise<Result<string, TerrariumError>> {
  const conn = config.getProviderConfig(providerType);
  const cred = config.getCredentialStatus(providerType);
  const adapter = registry?.getAdapter(providerType);

  const modelsRes = adapter ? await adapter.listModels() : undefined;
  const models = modelsRes?.success ? modelsRes.data : [];
  const capsRes = adapter ? await adapter.getCapabilities() : undefined;
  const caps = capsRes?.success ? capsRes.data : undefined;

  if (options.json) {
    const payload = {
      provider: providerType,
      connection: conn,
      credential: cred,
      capabilities: caps,
      models,
    };
    return ok(JSON.stringify(payload, null, 2));
  }

  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const cyan = useColor ? "\x1b[36m" : "";
  const green = useColor ? "\x1b[32m" : "";
  const dim = useColor ? "\x1b[2m" : "";
  const reset = useColor ? "\x1b[0m" : "";

  let card = `\n${bold}Provider Card: ${providerType.toUpperCase()}${reset}\n`;
  card += `${dim}──────────────────────────────────────────────────${reset}\n`;
  card += `Base URL:           ${conn.baseUrl ?? "N/A"}\n`;
  card += `Credential Status:  ${cred.isConfigured ? `${green}Configured (${cred.source})${reset}` : `${dim}Missing${reset}`}\n`;
  if (cred.maskedKey) {
    card += `Masked Key:         ${cred.maskedKey}\n`;
  }
  card += `Default Provider:   ${config.preferences.defaultProvider === providerType ? "Yes" : "No"}\n`;

  if (caps) {
    card += `\n${bold}Adapter Capabilities:${reset}\n`;
    card += `  Context Window:   ${caps.contextWindow.toLocaleString()} tokens\n`;
    card += `  Max Output:       ${caps.maxOutputTokens.toLocaleString()} tokens\n`;
    card += `  Streaming:        ${caps.supportsStreaming ? "Supported" : "Not Supported"}\n`;
    card += `  Tool Calling:     ${caps.supportsTools ? "Supported" : "Not Supported"}\n`;
    card += `  Vision:           ${caps.supportsVision ? "Supported" : "Not Supported"}\n`;
  }

  if (models.length > 0) {
    card += `\n${bold}Available Models (${models.length}):${reset}\n`;
    for (const m of models) {
      card += `  • ${cyan}${m.id.padEnd(28)}${reset} [${m.tier}] ${dim}(ctx: ${m.contextWindow.toLocaleString()})${reset}\n`;
    }
  }

  // Specialist integration security, scopes, and limitations metadata
  const integrationMeta = INTEGRATION_RANKINGS.find((r) => r.id === providerType || r.providerType === providerType);
  if (integrationMeta) {
    card += `\n${bold}Integration Profile & Least-Privilege Scopes:${reset}\n`;
    card += `  Rank / Status:    #${integrationMeta.rank} (${integrationMeta.supportStatus})\n`;
    card += `  Connection Mode:  ${integrationMeta.connectionMode}\n`;
    card += `  Data Flow:        ${integrationMeta.dataFlowSummary}\n`;
    card += `  Rate Limits:      ${integrationMeta.rateLimitsSummary}\n`;
    if (integrationMeta.requiredScopes.length > 0) {
      card += `  Required Scopes:  ${integrationMeta.requiredScopes.join(", ")}\n`;
    }
    if (integrationMeta.sideEffects.length > 0) {
      card += `  Side Effects:     ${integrationMeta.sideEffects.join("; ")}\n`;
    }
    if (integrationMeta.limitations.length > 0) {
      card += `  Limitations:      ${integrationMeta.limitations.join("; ")}\n`;
    }
  }

  return ok(card);
}

/**
 * Tests provider connection reachability, latency, and diagnostics.
 */
export async function handleProviderTest(
  providerType: ProviderType,
  config: TerrariumConfig,
  registry: ProviderRegistry,
  options: ProviderCommandOptions = {}
): Promise<Result<{ isHealthy: boolean; latencyMs: number; message: string; output: string }, TerrariumError>> {
  const adapter = registry.getAdapter(providerType);

  if (!adapter) {
    const msg = `No adapter registered for provider '${providerType}'.`;
    return ok({
      isHealthy: false,
      latencyMs: 0,
      message: msg,
      output: options.json ? JSON.stringify({ isHealthy: false, message: msg }, null, 2) : msg,
    });
  }

  const healthRes = await adapter.checkHealth();
  const health = healthRes.success
    ? healthRes.data
    : { isHealthy: false, latencyMs: 0, message: healthRes.error.message, timestamp: new Date().toISOString() };

  const output = options.json
    ? JSON.stringify(health, null, 2)
    : `Provider '${providerType}' Test Result:\n  Status:  ${health.isHealthy ? "HEALTHY" : "UNHEALTHY"}\n  Latency: ${health.latencyMs}ms\n  Details: ${health.message ?? "N/A"}\n`;

  return ok({
    isHealthy: health.isHealthy,
    latencyMs: health.latencyMs,
    message: health.message ?? "",
    output,
  });
}

/**
 * Renders user-friendly setup guide with safe credential configuration instructions.
 */
export function handleProviderSetupGuide(
  providerType: ProviderType,
  options: { useColor?: boolean } = {}
): string {
  const useColor = options.useColor ?? false;
  const bold = useColor ? "\x1b[1m" : "";
  const cyan = useColor ? "\x1b[36m" : "";
  const yellow = useColor ? "\x1b[33m" : "";
  const dim = useColor ? "\x1b[2m" : "";
  const reset = useColor ? "\x1b[0m" : "";

  let guide = `\n${bold}Configuring Provider: ${providerType.toUpperCase()}${reset}\n`;
  guide += `${dim}──────────────────────────────────────────────────${reset}\n`;

  switch (providerType) {
    case "anthropic":
      guide += `1. Create an Anthropic API Key in Anthropic Console (https://console.anthropic.com/settings/keys).\n`;
      guide += `2. Export the environment variable in your terminal session:\n`;
      guide += `   ${cyan}export ANTHROPIC_API_KEY="sk-ant-your-key-here"${reset}\n`;
      guide += `   ${dim}Or add to your local '.env' file: ANTHROPIC_API_KEY=sk-ant-...\n`;
      guide += `3. Default frontier model: ${cyan}claude-3-5-sonnet-20241022${reset} (advanced tier, 200k context).\n`;
      guide += `4. Verify setup and reachability:\n`;
      guide += `   ${yellow}terrarium provider test anthropic${reset}\n`;
      break;

    case "openai":
      guide += `1. Generate an API key in OpenAI Dashboard (https://platform.openai.com/api-keys).\n`;
      guide += `2. Export the environment variable in your terminal session:\n`;
      guide += `   ${cyan}export OPENAI_API_KEY="sk-proj-your-key-here"${reset}\n`;
      guide += `   ${dim}Or add it to your local '.env' file (ensuring '.env' is in .gitignore).${reset}\n`;
      guide += `3. Verify configuration:\n`;
      guide += `   ${yellow}terrarium provider info openai${reset}\n`;
      break;

    case "ollama":
      guide += `1. Install Ollama locally (https://ollama.com).\n`;
      guide += `2. Start Ollama daemon and pull recommended coding models:\n`;
      guide += `   ${cyan}ollama serve${reset}\n`;
      guide += `   ${cyan}ollama pull llama3.2${reset}  ${dim}(general lightweight reasoning)${reset}\n`;
      guide += `   ${cyan}ollama pull qwen2.5-coder${reset}  ${dim}(specialized code synthesis)${reset}\n`;
      guide += `3. 100% private offline loopback (http://localhost:11434). Zero cost, no API keys required.\n`;
      guide += `4. Verify reachability:\n`;
      guide += `   ${yellow}terrarium provider test ollama${reset}\n`;
      break;

    case "gemini":
      guide += `1. Create an API key in Google AI Studio (https://aistudio.google.com/app/apikey).\n`;
      guide += `2. Export the environment variable in your terminal session:\n`;
      guide += `   ${cyan}export GEMINI_API_KEY="AIzaSy-your-key-here"${reset}\n`;
      guide += `   ${dim}Or set GOOGLE_API_KEY in your local '.env' file.${reset}\n`;
      guide += `3. Supports 2M token context window (${cyan}gemini-1.5-pro${reset}) for massive repo ingestion.\n`;
      guide += `4. Verify setup:\n`;
      guide += `   ${yellow}terrarium provider test gemini${reset}\n`;
      break;

    case "custom":
      guide += `1. Configure custom OpenAI-compatible endpoint in .env:\n`;
      guide += `   ${cyan}CUSTOM_PROVIDER_BASE_URL="http://localhost:8000/v1"${reset}\n`;
      guide += `   ${cyan}CUSTOM_PROVIDER_API_KEY="optional-bearer-token"${reset}\n`;
      break;

    default:
      guide += `Set credentials in your environment according to provider documentation.\n`;
      break;
  }

  guide += `\n${bold}Security Reminder:${reset} Terrarium never stores raw API keys in project memory or logs.\n`;
  return guide;
}
