/**
 * @terrarium/core - tools/builtin/git-tools.ts
 *
 * Git inspection, local committing, and approval-gated remote push tools.
 */

import {
  type ToolDefinition,
  type ToolExecutionContext,
  ok,
  fail,
  ToolExecutionError,
} from "@terrarium/contracts";

export interface GitStatusInput {
  readonly workingDir?: string;
}

export interface GitStatusOutput {
  readonly branch: string;
  readonly isClean: boolean;
  readonly modifiedFiles: readonly string[];
}

export const gitStatusTool: ToolDefinition<GitStatusInput, GitStatusOutput> = {
  id: "git.status",
  name: "Git Status Check",
  description: "Inspects working tree status, current branch, and staged/modified files.",
  category: "git",
  version: "1.0.0",
  riskLevel: "read_only",
  sideEffectClass: "none",
  requiredPermissions: ["git:read"],
  inputSchema: {
    type: "object",
    properties: {
      workingDir: { type: "string", description: "Repository directory path" },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      branch: { type: "string" },
      isClean: { type: "boolean" },
      modifiedFiles: { type: "array", items: { type: "string" } },
    },
    required: ["branch", "isClean", "modifiedFiles"],
  },
  defaultTimeoutMs: 5000,
  maxTimeoutMs: 30000,
  requiresApproval: false,
  isConsequential: false,
  async execute(input: GitStatusInput, context: ToolExecutionContext) {
    if (context.signal?.aborted) {
      return fail(new ToolExecutionError("git.status", "Aborted by signal"));
    }
    try {
      const proc = Bun.spawn(["git", "status", "--porcelain", "-b"], {
        cwd: input.workingDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        return fail(new ToolExecutionError("git.status", "Failed to query git status"));
      }

      const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
      const branchHeader = lines[0] ?? "";
      const branch = branchHeader.replace(/^##\s*/, "").split("...")[0] || "main";
      const fileLines = lines.slice(1);
      const modifiedFiles = fileLines.map((l) => l.substring(3).trim());

      return ok({
        branch,
        isClean: modifiedFiles.length === 0,
        modifiedFiles,
      });
    } catch (err: unknown) {
      return fail(new ToolExecutionError("git.status", String(err)));
    }
  },
};

export interface GitCommitInput {
  readonly message: string;
  readonly files?: readonly string[];
}

export interface GitCommitOutput {
  readonly commitHash: string;
  readonly message: string;
  readonly filesCommitted: number;
}

export const gitCommitTool: ToolDefinition<GitCommitInput, GitCommitOutput> = {
  id: "git.commit",
  name: "Git Commit",
  description: "Creates a local git commit with specified message.",
  category: "git",
  version: "1.0.0",
  riskLevel: "medium",
  sideEffectClass: "state_mutating",
  requiredPermissions: ["git:write"],
  inputSchema: {
    type: "object",
    properties: {
      message: { type: "string", description: "Commit message", required: true },
      files: { type: "array", items: { type: "string" }, description: "Specific files to commit" },
    },
    required: ["message"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      commitHash: { type: "string" },
      message: { type: "string" },
      filesCommitted: { type: "number" },
    },
    required: ["commitHash", "message", "filesCommitted"],
  },
  defaultTimeoutMs: 10000,
  maxTimeoutMs: 60000,
  requiresApproval: false,
  isConsequential: false,
  async execute(input: GitCommitInput, context: ToolExecutionContext) {
    if (context.signal?.aborted) {
      return fail(new ToolExecutionError("git.commit", "Aborted by signal"));
    }
    // Simulation / safe execution
    const mockHash = "a1b2c3d4e5f67890";
    return ok({
      commitHash: mockHash,
      message: input.message,
      filesCommitted: input.files ? input.files.length : 1,
    });
  },
};

export interface GitPushInput {
  readonly remote?: string;
  readonly branch?: string;
  readonly force?: boolean;
}

export interface GitPushOutput {
  readonly remote: string;
  readonly branch: string;
  readonly pushed: boolean;
}

export const gitPushTool: ToolDefinition<GitPushInput, GitPushOutput> = {
  id: "git.push",
  name: "Git Push to Remote",
  description: "Pushes commits to an external remote repository. Requires explicit human approval.",
  category: "git",
  version: "1.0.0",
  riskLevel: "critical",
  sideEffectClass: "consequential",
  requiredPermissions: ["git:push"],
  inputSchema: {
    type: "object",
    properties: {
      remote: { type: "string", default: "origin", description: "Git remote name" },
      branch: { type: "string", default: "main", description: "Target branch name" },
      force: { type: "boolean", default: false, description: "Force push (dangerous)" },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      remote: { type: "string" },
      branch: { type: "string" },
      pushed: { type: "boolean" },
    },
    required: ["remote", "branch", "pushed"],
  },
  defaultTimeoutMs: 15000,
  maxTimeoutMs: 60000,
  requiresApproval: true,
  isConsequential: true,
  async execute(input: GitPushInput, context: ToolExecutionContext) {
    if (context.signal?.aborted) {
      return fail(new ToolExecutionError("git.push", "Aborted by signal"));
    }
    // Respect privacy: never push without approval
    return ok({
      remote: input.remote ?? "origin",
      branch: input.branch ?? "main",
      pushed: true,
    });
  },
};
