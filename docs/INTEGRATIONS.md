# TERRARIUM — Specialist Integrations and Provider Reference

> Guide, evaluated rankings, setup instructions, security scopes, and operational boundaries for Terrarium's specialist integrations.
> Aligns with `PLAN.md` Section 10.4, Section 12, Section 24, and `PROMPT 19`.

---

## 1. Specialist Integration Priority Matrix

In accordance with Prompt 19 ("Rank integrations by user value, risk, maintenance, and support"), all candidate integrations have been evaluated and ranked systematically:

| Rank | Integration Identifier | Type | User Value | Risk Level | Maintenance | Support Tier | Connection Mode | Data Flow Policy |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **#1** | `anthropic` | Model API | **Critical** | Low | Low | Tier 1 (Official) | `explicit_key` | Encrypted HTTPS REST (`api.anthropic.com`); zero customer training data retention under commercial API terms. |
| **#2** | `ollama` | Model API | **High** | Low | Low | Tier 1 (Official) | `local_daemon` | 100% private local loopback (`http://localhost:11434`); zero external network egress. |
| **#3** | `openai` | Model API | **High** | Low | Low | Tier 1 (Official) | `explicit_key` | Encrypted HTTPS REST (`api.openai.com/v1`); zero retention enterprise terms. |
| **#4** | `gemini` | Model API | **High** | Medium | Medium | Tier 2 (Experimental) | `explicit_key` | Encrypted HTTPS REST (`generativelanguage.googleapis.com`); Google AI Studio terms apply. |
| **#5** | `claude-code-cli` | Coding Agent CLI | **Medium** | **High** | Medium | Tier 2 (Experimental) | `cli_subprocess` | Local child process execution; strictly sandboxed within the workspace project directory. |

---

## 2. Authentication, Least Privilege & Security Policy

1. **Explicit Connection Requirement**:
   - Cloud providers (`anthropic`, `gemini`, `openai`) default to `enabled: false`. They are never activated unless an explicit API key is configured and external network calls are authorized (`allowExternalCalls=true`).
   - The security guard `assertExternalCallAuthorized()` halts execution immediately before network I/O if authorization or credentials are absent.
2. **Local Loopback Exemption**:
   - Local offline providers (`ollama`) default to `enabled: true` and require no credentials or external network authorization because data never leaves localhost (`http://localhost:11434`).
3. **Subprocess Sandboxing & Non-Interactive Constraints**:
   - The `ClaudeCodeCliAdapter` runs in batch non-interactive print mode (`-p`). Interactive PTYs are disabled in autonomous orchestration to prevent command hijacking or unmonitored shell escapes.
   - Child processes are strictly confined to `options.cwd`. Consequential file alterations require human approval gates.
4. **Credential Isolation**:
   - Terrarium never stores raw API keys in SQLite databases, logs, reports, or durable project memory.
   - HTTP headers (`Authorization`, `x-api-key`, `x-goog-api-key`) are redacted by `sanitizeHeaders()` before audit logging.

---

## 3. Step-by-Step Setup and Disabling Guides

### 1. Anthropic (Rank 1 — Default Frontier Intelligence)
- **Primary Value**: High-order reasoning, system architecture, code review, multi-agent debates.
- **Supported Models**: `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`.
- **How to Connect**:
  1. Obtain an API key from the [Anthropic Console](https://console.anthropic.com/settings/keys).
  2. Export the environment variable or add it to `.env`:
     ```bash
     export ANTHROPIC_API_KEY="sk-ant-api03-..."
     ```
  3. Verify setup:
     ```bash
     terrarium provider test anthropic
     terrarium provider info anthropic
     ```
- **How to Disconnect / Disable**:
  Remove `ANTHROPIC_API_KEY` from your environment or set `enabled: false` in configuration. When disconnected, Terrarium seamlessly falls back to offline or mock adapters.

### 2. Ollama (Rank 2 — 100% Private Offline Inference)
- **Primary Value**: Zero-cost, completely offline execution with zero data egress. Ideal for sensitive codebases.
- **Supported Models**: `llama3.2`, `qwen2.5-coder`, `deepseek-r1`, `codellama`.
- **How to Connect**:
  1. Install Ollama from [ollama.com](https://ollama.com).
  2. Start the daemon and pull desired models:
     ```bash
     ollama serve
     ollama pull llama3.2
     ollama pull qwen2.5-coder
     ```
  3. Ollama runs on `http://localhost:11434` without credentials.
  4. Verify setup:
     ```bash
     terrarium provider test ollama
     ```
- **How to Disconnect / Disable**:
  Stop the local daemon (`killall ollama` or stop the menu bar app). The CLI gracefully reports offline status without throwing unhandled rejections.

### 3. Google Gemini (Rank 4 — Massive Context Window)
- **Primary Value**: Multi-million token context windows (up to 2,000,000 tokens in `gemini-1.5-pro`) for full-repository ingestion.
- **Supported Models**: `gemini-1.5-pro`, `gemini-1.5-flash`.
- **How to Connect**:
  1. Obtain an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
  2. Export the environment variable or add it to `.env`:
     ```bash
     export GEMINI_API_KEY="AIzaSy..."
     # or: export GOOGLE_API_KEY="AIzaSy..."
     ```
  3. Verify setup:
     ```bash
     terrarium provider test gemini
     ```
- **How to Disconnect / Disable**:
  Unset `GEMINI_API_KEY` and `GOOGLE_API_KEY`.

### 4. Claude Code CLI Adapter (Rank 5 — Specialist Coding-Agent Subprocess)
- **Primary Value**: Bridges local Claude Code CLI capabilities (`claude -p <prompt>`) into Terrarium tasks.
- **How to Connect**:
  1. Install the CLI on your host machine:
     ```bash
     npm install -g @anthropic-ai/claude-code
     ```
  2. Verify the binary is in PATH:
     ```bash
     which claude
     ```
  3. Terrarium automatically detects the binary and wraps commands with timeout and sandbox constraints.
- **How to Disconnect / Disable**:
  Uninstall or remove the binary from PATH. If missing, Terrarium returns a typed `ProviderNotFoundError` with installation instructions without crashing.

---

## 4. Disconnected and Degraded Integration Resilience

A core reliability requirement of Terrarium is that **disconnected or failing integrations must NEVER break core CLI functionality**:
1. **Graceful Status Reporting**: `terrarium provider list` displays current connectivity without failing when an endpoint is unreachable.
2. **Offline Fallback Catalog**: If Ollama or an external provider cannot be reached, the model catalog falls back to safe seeded defaults rather than throwing.
3. **Structured Error Hierarchy**: All adapter failures return typed `Result<T, ProviderError>` failure instances (`ProviderAuthenticationError`, `ProviderRateLimitError`, `ProviderNetworkError`, `ProviderTimeoutError`, `ProviderNotFoundError`), preventing unhandled promise rejections.
4. **Mock and Local Fallbacks**: If external cloud calls are disabled or unconfigured, the system automatically routes to local Ollama or registered mock adapters.

---

## 5. Recorded Limitations & Operational Boundaries

| Integration | Known Operational Boundaries & Limitations |
| :--- | :--- |
| **Anthropic** | Requires active internet connection; subject to provider rate limits (RPM/TPM); per-token API costs apply; tool calling JSON schemas require strict property typing. |
| **Ollama** | Maximum context window and generation speed bounded by host RAM/VRAM and GPU compute; local models have lower complex architectural reasoning capabilities than large cloud models; daemon must be running locally. |
| **OpenAI** | Reasoning models (`o1`, `o1-mini`) do not support custom temperature settings or function tool calling; external network required; API costs apply. |
| **Gemini** | Different tool calling JSON schema format than OpenAI standard; safety filter sensitivity may block certain security research queries; API costs apply. |
| **Claude Code CLI** | Requires host Node.js and global binary install; non-interactive mode only; cannot handle interactive terminal prompts; requires human approval for file writes. |
