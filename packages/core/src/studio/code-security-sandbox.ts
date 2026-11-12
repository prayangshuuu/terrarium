/**
 * @terrarium/core - studio/code-security-sandbox.ts
 *
 * Security sandbox, least-privilege boundary, path traversal prevention,
 * protected files shielding, and destructive operation guards for Engineering Studio.
 * Contributed by A3 (Data, Security & Reliability).
 * Aligns strictly with PLAN.md Section 17, PLAN_CONTEXT.md Section 7, and PROMPT 17.
 */

import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import {
  type Result,
  ok,
  fail,
  PermissionDeniedError,
  DomainValidationError,
} from "@terrarium/contracts";

export const PROTECTED_FILE_PATTERNS: readonly RegExp[] = [
  /^\.env($|\..*)/i,
  /\/\.env($|\..*)/i,
  /\.(pem|key|pfx|p12|pkcs12)$/i,
  /id_rsa|id_ed25519|id_ecdsa|id_dsa/i,
  /\.git\/config/i,
  /credentials.*\.json$/i,
  /service-account.*\.json$/i,
  /\.(npmrc|netrc)$/i,
  /\/\.(npmrc|netrc)$/i,
  /\.aws\/credentials/i,
  /\.ssh\//i,
];

export const DESTRUCTIVE_COMMAND_PATTERNS: readonly RegExp[] = [
  /\brm\s+-[rf]{1,2}\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-z]*f/i,
  /\bdrop\s+table\b/i,
  /\bdrop\s+database\b/i,
  /\bnpm\s+publish\b/i,
  /\bcargo\s+publish\b/i,
  /\bterraform\s+destroy\b/i,
];

export const DEPENDENCY_INSTALL_PATTERNS: readonly RegExp[] = [
  /\bnpm\s+(i|install|add)\b/i,
  /\byarn\s+add\b/i,
  /\bpnpm\s+add\b/i,
  /\bbun\s+(add|install)\b/i,
  /\bpip\s+install\b/i,
  /\bpoetry\s+add\b/i,
  /\bcargo\s+add\b/i,
  /\bgo\s+get\b/i,
];

export interface SandboxSecurityConfig {
  readonly workspaceRoot: string;
  readonly defaultMode?: "read_only" | "read_write";
  readonly allowDependencyInstall?: boolean;
  readonly allowedPaths?: readonly string[];
  readonly disallowedPaths?: readonly string[];
}

export class CodeSecuritySandbox {
  private readonly workspaceRoot: string;
  private readonly mode: "read_only" | "read_write";
  private readonly allowDependencyInstall: boolean;

  constructor(config: SandboxSecurityConfig) {
    this.workspaceRoot = path.resolve(config.workspaceRoot);
    this.mode = config.defaultMode ?? "read_only";
    this.allowDependencyInstall = config.allowDependencyInstall ?? false;
  }

  public getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  public getAccessMode(): "read_only" | "read_write" {
    return this.mode;
  }

  /**
   * Checks whether a given path targets a protected credentials, secret, or private configuration file.
   */
  public isProtectedFile(filePath: string): { protected: boolean; reason?: string } {
    const normalized = filePath.replace(/\\/g, "/");
    const basename = path.basename(filePath);

    for (const pattern of PROTECTED_FILE_PATTERNS) {
      if (pattern.test(normalized) || pattern.test(basename)) {
        return {
          protected: true,
          reason: `File '${filePath}' matches sensitive/credentials security pattern ${pattern.toString()} and is strictly protected from modification.`,
        };
      }
    }

    return { protected: false };
  }

  /**
   * Validates file path access within the sandbox workspace boundary.
   * Enforces:
   * 1. Path traversal guards (no ../ escaping workspace root).
   * 2. Null byte injection rejection.
   * 3. Read-only default access restriction for writes.
   * 4. Protected files shielding against modification.
   * 5. Symlink escape detection.
   */
  public async validatePathAccess(
    targetPath: string,
    action: "read" | "write" | "delete" = "read"
  ): Promise<Result<string, PermissionDeniedError>> {
    // 1. Check for null byte injections
    if (targetPath.includes("\0")) {
      return fail(
        new PermissionDeniedError(
          action,
          targetPath,
          "Path contains invalid null byte sequence (null byte injection detected)"
        )
      );
    }

    // 2. Resolve absolute path relative to workspace root
    const resolvedPath = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(this.workspaceRoot, targetPath);

    const relative = path.relative(this.workspaceRoot, resolvedPath);

    // 3. Prevent path traversal outside workspace root
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return fail(
        new PermissionDeniedError(
          action,
          targetPath,
          `Access denied: Path '${targetPath}' traverses outside the workspace sandbox root '${this.workspaceRoot}'`
        )
      );
    }

    // 4. Default read-only protection check
    if (action !== "read" && this.mode === "read_only") {
      return fail(
        new PermissionDeniedError(
          action,
          targetPath,
          `Sandbox repository access is in read-only mode by default. Mutation '${action}' requires explicit authorization.`
        )
      );
    }

    // 5. Protected secret / credential file check on mutation
    if (action !== "read") {
      const protectedCheck = this.isProtectedFile(relative);
      if (protectedCheck.protected) {
        return fail(
          new PermissionDeniedError(action, targetPath, protectedCheck.reason ?? "Protected secret file")
        );
      }
    }

    // 6. Symlink evaluation (if file exists)
    try {
      const lstat = await fs.lstat(resolvedPath).catch(() => null);
      if (lstat && lstat.isSymbolicLink()) {
        const realTarget = await fs.realpath(resolvedPath);
        const relReal = path.relative(this.workspaceRoot, realTarget);
        if (relReal.startsWith("..") || path.isAbsolute(relReal)) {
          return fail(
            new PermissionDeniedError(
              action,
              targetPath,
              `Access denied: Symlink '${targetPath}' resolves outside sandbox root to '${realTarget}'`
            )
          );
        }
      }
    } catch {
      // Ignore if file does not exist yet (e.g. creating new file)
    }

    return ok(resolvedPath);
  }

  /**
   * Validates shell command execution safety.
   */
  public validateShellCommand(command: string): Result<
    { isConsequential: boolean; isDestructive: boolean; isInstall: boolean; reason?: string },
    PermissionDeniedError
  > {
    const trimmed = command.trim();
    if (!trimmed) {
      return ok({ isConsequential: false, isDestructive: false, isInstall: false });
    }

    // 1. Check destructive operations
    for (const pattern of DESTRUCTIVE_COMMAND_PATTERNS) {
      if (pattern.test(trimmed)) {
        return fail(
          new PermissionDeniedError(
            "shell:execute",
            trimmed,
            `Destructive command detected (${pattern.toString()}). Destructive shell operations are guarded and require explicit user authorization.`
          )
        );
      }
    }

    // 2. Check dependency installation
    for (const pattern of DEPENDENCY_INSTALL_PATTERNS) {
      if (pattern.test(trimmed)) {
        if (!this.allowDependencyInstall) {
          return fail(
            new PermissionDeniedError(
              "shell:execute",
              trimmed,
              `Dependency installation command detected (${pattern.toString()}). Modifying project dependencies requires explicit user authorization.`
            )
          );
        }
        return ok({
          isConsequential: true,
          isDestructive: false,
          isInstall: true,
          reason: "Package dependency installation",
        });
      }
    }

    // 3. Git push / publishing
    if (/\bgit\s+push\b/i.test(trimmed)) {
      return ok({
        isConsequential: true,
        isDestructive: false,
        isInstall: false,
        reason: "Remote git push operation",
      });
    }

    return ok({
      isConsequential: false,
      isDestructive: false,
      isInstall: false,
    });
  }

  /**
   * Preserves user changes by verifying that working tree file has not been altered
   * since the patch was generated.
   */
  public async verifyWorkingTreeContent(
    filePath: string,
    expectedOriginalHash?: string
  ): Promise<Result<void, DomainValidationError>> {
    const checkRes = await this.validatePathAccess(filePath, "read");
    if (!checkRes.success) {
      return fail(new DomainValidationError(checkRes.error.message, []));
    }

    const resolved = checkRes.data;
    const exists = await fs.stat(resolved).then(() => true).catch(() => false);

    if (!exists) {
      if (expectedOriginalHash) {
        return fail(
          new DomainValidationError(
            `Working tree conflict: Expected existing file at '${filePath}', but file has been removed.`,
            [{ path: "filePath", message: "File missing on disk" }]
          )
        );
      }
      return ok(undefined);
    }

    if (expectedOriginalHash) {
      const currentContent = await fs.readFile(resolved, "utf8");
      const currentHash = crypto.createHash("sha256").update(currentContent).digest("hex");

      if (currentHash !== expectedOriginalHash) {
        return fail(
          new DomainValidationError(
            `Working tree conflict: File '${filePath}' was modified externally after patch proposal. Aborting to preserve user changes. Expected hash: ${expectedOriginalHash.slice(
              0,
              8
            )}, found: ${currentHash.slice(0, 8)}.`,
            [{ path: "originalHash", message: "Content hash mismatch (user edits detected)" }]
          )
        );
      }
    }

    return ok(undefined);
  }
}
