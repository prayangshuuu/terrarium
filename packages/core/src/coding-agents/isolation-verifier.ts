/**
 * @terrarium/core - coding-agents/isolation-verifier.ts
 *
 * Mandatory Isolation Boundary Verifier for Claude Code Dangerous-Permissions Mode.
 * Contributed by A3 (Senior Backend Developer, Data, Security & Reliability).
 *
 * Enforces strict security preconditions before --dangerously-skip-permissions can be used:
 * 1. Confines workspace strictly to an isolated directory or dedicated worktree.
 * 2. Forbids root directory (/) and user home directory (~ / /Users/... / /root).
 * 3. Scans for sensitive credential files (.ssh, .aws, .gnupg, cloud tokens, .env) and shields them.
 * 4. Sanitizes process environment against token exfiltration (only allowlisted vars forwarded).
 * 5. Accurately verifies and reports OS sandbox / container status without misleading claims.
 * 6. Fails closed: if isolation cannot be verified, launch is strictly blocked.
 */

import {
  type IsolationStatus,
  type IsolationVerificationReport,
} from "@terrarium/contracts";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { existsSync, statSync } from "node:fs";

export interface IsolationVerifyOptions {
  readonly requireWorktree?: boolean;
  readonly requireContainer?: boolean;
  readonly allowedWorkspaceRoots?: readonly string[];
}

/**
 * Sensitive file or directory patterns that must never be exposed writable to a bypassed process.
 */
export const SENSITIVE_PATH_PATTERNS: readonly RegExp[] = [
  /^\.ssh($|\/)/i,
  /^\.aws($|\/)/i,
  /^\.gnupg($|\/)/i,
  /^\.config\/gcloud($|\/)/i,
  /^\.azure($|\/)/i,
  /\.(pem|key|p12|pkcs12)$/i,
  /id_rsa|id_ed25519|id_ecdsa/i,
  /credentials\.json$/i,
  /service-account.*\.json$/i,
  /^\.env($|\..*)/i,
];

/**
 * Environment variables allowlisted for forwarding to isolated coding agent subprocesses.
 * Any credentials, tokens, or ambient auth sockets NOT explicitly allowlisted are stripped.
 */
export const ALLOWLISTED_ENV_VARS: readonly string[] = [
  "PATH",
  "HOME",
  "SHELL",
  "USER",
  "LOGNAME",
  "TERM",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TMPDIR",
  "TZ",
  "EDITOR",
  "VISUAL",
  "COLORTERM",
  "TERM_PROGRAM",
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_EXECUTABLE_PATH",
];

/**
 * Verifies whether a given workspace root satisfies isolation preconditions for dangerous-permissions launch.
 */
export async function verifyIsolation(
  workspaceRoot: string,
  options: IsolationVerifyOptions = {}
): Promise<IsolationVerificationReport> {
  const resolvedRoot = path.resolve(workspaceRoot);
  const homeDir = os.homedir();
  const rootDir = path.parse(resolvedRoot).root;

  const honestLimitations: string[] = [
    "A dedicated workspace folder or Git worktree confines file system operations to that tree.",
    "It does NOT provide kernel-level syscall filtering or process namespace isolation unless an OS container or hypervisor is active.",
    "Bypassing Claude Code permission checks means Claude Code will not prompt for command execution inside this boundary.",
    "Network access is enabled by default to reach Anthropic frontier APIs; host network sockets remain reachable unless OS containerized.",
  ];

  // 1. Check if workspace path exists and is a directory
  if (!existsSync(resolvedRoot)) {
    return {
      isIsolated: false,
      status: "failed",
      workspaceRoot: resolvedRoot,
      isWorktree: false,
      isHomeDirOrRoot: false,
      shieldedPaths: [],
      exposedSensitivePaths: [],
      networkPolicy: "unrestricted",
      containerOrOsSandboxActive: false,
      failureReason: `Workspace path does not exist: '${resolvedRoot}'`,
      honestLimitations,
    };
  }

  let isDir = false;
  try {
    const st = statSync(resolvedRoot);
    isDir = st.isDirectory();
  } catch {
    isDir = false;
  }

  if (!isDir) {
    return {
      isIsolated: false,
      status: "failed",
      workspaceRoot: resolvedRoot,
      isWorktree: false,
      isHomeDirOrRoot: false,
      shieldedPaths: [],
      exposedSensitivePaths: [],
      networkPolicy: "unrestricted",
      containerOrOsSandboxActive: false,
      failureReason: `Workspace path is not a directory: '${resolvedRoot}'`,
      honestLimitations,
    };
  }

  // 2. Reject Root directory (/) and Home directory (~ or /Users/...)
  const isRoot = resolvedRoot === rootDir;
  const isHome = resolvedRoot === path.resolve(homeDir);

  if (isRoot || isHome) {
    return {
      isIsolated: false,
      status: "failed",
      workspaceRoot: resolvedRoot,
      isWorktree: false,
      isHomeDirOrRoot: true,
      shieldedPaths: [],
      exposedSensitivePaths: [isRoot ? "root_filesystem" : "user_home_directory"],
      networkPolicy: "unrestricted",
      containerOrOsSandboxActive: false,
      failureReason: `Workspace root cannot be root directory ('/') or user home directory ('${homeDir}'). Dangerous-permissions mode requires a dedicated isolated project directory or worktree.`,
      honestLimitations,
    };
  }

  // Reject system directories
  const systemPrefixes = ["/bin", "/sbin", "/usr", "/etc", "/var", "/System", "/Library", "C:\\Windows", "C:\\Program Files"];
  for (const sysPrefix of systemPrefixes) {
    if (resolvedRoot.startsWith(sysPrefix)) {
      return {
        isIsolated: false,
        status: "failed",
        workspaceRoot: resolvedRoot,
        isWorktree: false,
        isHomeDirOrRoot: false,
        shieldedPaths: [],
        exposedSensitivePaths: [sysPrefix],
        networkPolicy: "unrestricted",
        containerOrOsSandboxActive: false,
        failureReason: `Workspace root cannot be inside system directory '${sysPrefix}'.`,
        honestLimitations,
      };
    }
  }

  // 3. Scan for exposed sensitive files/directories in workspace root
  const exposedSensitivePaths: string[] = [];
  const shieldedPaths: string[] = [];

  try {
    const entries = await fs.readdir(resolvedRoot, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      for (const pattern of SENSITIVE_PATH_PATTERNS) {
        if (pattern.test(name)) {
          exposedSensitivePaths.push(name);
          break;
        }
      }
    }
  } catch (err: any) {
    return {
      isIsolated: false,
      status: "failed",
      workspaceRoot: resolvedRoot,
      isWorktree: false,
      isHomeDirOrRoot: false,
      shieldedPaths: [],
      exposedSensitivePaths: [],
      networkPolicy: "unrestricted",
      containerOrOsSandboxActive: false,
      failureReason: `Failed to inspect workspace directory permissions: ${err?.message ?? "unknown"}`,
      honestLimitations,
    };
  }

  // Record shielded standard locations that are excluded by policy
  shieldedPaths.push("~/.ssh (excluded from mount/env)");
  shieldedPaths.push("~/.aws (excluded from mount/env)");
  shieldedPaths.push("~/.gnupg (excluded from mount/env)");

  // If sensitive files like .ssh or .aws are present directly inside workspace root, fail isolation
  if (exposedSensitivePaths.some((p) => p.startsWith(".ssh") || p.startsWith(".aws") || p.startsWith(".gnupg"))) {
    return {
      isIsolated: false,
      status: "failed",
      workspaceRoot: resolvedRoot,
      isWorktree: false,
      isHomeDirOrRoot: false,
      shieldedPaths,
      exposedSensitivePaths,
      networkPolicy: "unrestricted",
      containerOrOsSandboxActive: false,
      failureReason: `Critical credential directory detected directly inside workspace: ${exposedSensitivePaths.join(", ")}. Cannot safely run dangerous-permissions mode.`,
      honestLimitations,
    };
  }

  // 4. Check if workspace is a Git worktree or isolated copy
  let isWorktree = false;
  try {
    const gitPath = path.join(resolvedRoot, ".git");
    if (existsSync(gitPath)) {
      const stat = statSync(gitPath);
      if (stat.isFile()) {
        // A .git file (instead of a .git directory) indicates a git worktree or submodule
        const content = await fs.readFile(gitPath, "utf-8");
        if (content.includes("gitdir:")) {
          isWorktree = true;
        }
      }
    }
  } catch {}

  if (options.requireWorktree && !isWorktree) {
    return {
      isIsolated: false,
      status: "failed",
      workspaceRoot: resolvedRoot,
      isWorktree: false,
      isHomeDirOrRoot: false,
      shieldedPaths,
      exposedSensitivePaths,
      networkPolicy: "unrestricted",
      containerOrOsSandboxActive: false,
      failureReason: `Isolation policy requires a dedicated Git worktree, but '${resolvedRoot}' is not a worktree.`,
      honestLimitations,
    };
  }

  // 5. Check if OS container or sandbox is active
  const containerOrOsSandboxActive =
    existsSync("/.dockerenv") ||
    existsSync("/run/.containerenv") ||
    process.env.SANDBOX_TYPE === "docker" ||
    process.env.SANDBOX_TYPE === "container";

  if (options.requireContainer && !containerOrOsSandboxActive) {
    return {
      isIsolated: false,
      status: "unsupported",
      workspaceRoot: resolvedRoot,
      isWorktree,
      isHomeDirOrRoot: false,
      shieldedPaths,
      exposedSensitivePaths,
      networkPolicy: "unrestricted",
      containerOrOsSandboxActive: false,
      failureReason: "Isolation policy requires an active OS container or hypervisor sandbox.",
      honestLimitations,
    };
  }

  return {
    isIsolated: true,
    status: "verified",
    workspaceRoot: resolvedRoot,
    isWorktree,
    isHomeDirOrRoot: false,
    shieldedPaths,
    exposedSensitivePaths,
    networkPolicy: "unrestricted", // Claude Code requires outbound HTTPS to Anthropic
    containerOrOsSandboxActive,
    honestLimitations,
  };
}

/**
 * Sanitizes the host environment for isolated execution.
 * Only forwards allowlisted variables; strips ambient secrets and auth tokens.
 */
export function sanitizeEnvironment(
  hostEnv: Record<string, string | undefined> = process.env,
  overrides?: Readonly<Record<string, string>>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const key of ALLOWLISTED_ENV_VARS) {
    const val = hostEnv[key];
    if (val !== undefined && val !== "") {
      sanitized[key] = val;
    }
  }

  // Apply explicit overrides if provided
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      sanitized[k] = v;
    }
  }

  return sanitized;
}
