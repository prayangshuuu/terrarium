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

  return ok({
    output: table,
    providers: summaries,
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
      card += `  • ${cyan}${m.id.padEnd(20)}${reset} [${m.tier}] ${dim}(ctx: ${m.contextWindow.toLocaleString()})${reset}\n`;
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
      guide += `2. Start Ollama and pull desired model:\n`;
      guide += `   ${cyan}ollama run llama3.2${reset}\n`;
      guide += `3. Ollama runs on http://localhost:11434 with zero credential requirements.\n`;
      break;

    default:
      guide += `Set credentials in your environment according to provider documentation.\n`;
      break;
  }

  guide += `\n${bold}Security Reminder:${reset} Terrarium never stores raw API keys in project memory or logs.\n`;
  return guide;
}
