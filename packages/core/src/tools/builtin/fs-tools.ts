/**
 * @terrarium/core - tools/builtin/fs-tools.ts
 *
 * Built-in filesystem tools with least privilege, safe sandboxing, and approval gating.
 */

import {
  type ToolDefinition,
  type ToolExecutionContext,
  ok,
  fail,
  ToolExecutionError,
} from "@terrarium/contracts";

export interface ReadFileInput {
  readonly path: string;
  readonly encoding?: string;
}

export interface ReadFileOutput {
  readonly path: string;
  readonly content: string;
  readonly sizeBytes: number;
}

export const readFileTool: ToolDefinition<ReadFileInput, ReadFileOutput> = {
  id: "fs.read_file",
  name: "Read File",
  description: "Reads the content of a file on the local filesystem.",
  category: "filesystem",
  version: "1.0.0",
  riskLevel: "read_only",
  sideEffectClass: "idempotent",
  requiredPermissions: ["file:read"],
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file to read", required: true },
      encoding: { type: "string", default: "utf-8", description: "Character encoding" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      content: { type: "string" },
      sizeBytes: { type: "number" },
    },
    required: ["path", "content", "sizeBytes"],
  },
  defaultTimeoutMs: 5000,
  maxTimeoutMs: 30000,
  requiresApproval: false,
  isConsequential: false,
  async execute(input: ReadFileInput, context: ToolExecutionContext) {
    if (context.signal?.aborted) {
      return fail(new ToolExecutionError("fs.read_file", "Aborted by signal"));
    }
    try {
      const file = Bun.file(input.path);
      const exists = await file.exists();
      if (!exists) {
        return fail(new ToolExecutionError("fs.read_file", `File '${input.path}' does not exist`));
      }
      const content = await file.text();
      return ok({
        path: input.path,
        content,
        sizeBytes: file.size,
      });
    } catch (err: unknown) {
      return fail(new ToolExecutionError("fs.read_file", String(err)));
    }
  },
};

export interface WriteFileInput {
  readonly path: string;
  readonly content: string;
  readonly overwrite?: boolean;
}

export interface WriteFileOutput {
  readonly path: string;
  readonly bytesWritten: number;
  readonly overwritten: boolean;
}

export const writeFileTool: ToolDefinition<WriteFileInput, WriteFileOutput> = {
  id: "fs.write_file",
  name: "Write File",
  description: "Writes content to a file on the local filesystem.",
  category: "filesystem",
  version: "1.0.0",
  riskLevel: "medium",
  sideEffectClass: "state_mutating",
  requiredPermissions: ["file:write"],
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Destination file path", required: true },
      content: { type: "string", description: "Content to write", required: true },
      overwrite: { type: "boolean", default: false, description: "Whether to overwrite existing file" },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      bytesWritten: { type: "number" },
      overwritten: { type: "boolean" },
    },
    required: ["path", "bytesWritten", "overwritten"],
  },
  defaultTimeoutMs: 10000,
  maxTimeoutMs: 60000,
  // Require approval if overwriting an existing consequential file
  requiresApproval: async (input: WriteFileInput) => {
    if (input.overwrite) {
      const file = Bun.file(input.path);
      return await file.exists();
    }
    return false;
  },
  isConsequential: async (input: WriteFileInput) => {
    return Boolean(input.overwrite);
  },
  async execute(input: WriteFileInput, context: ToolExecutionContext) {
    if (context.signal?.aborted) {
      return fail(new ToolExecutionError("fs.write_file", "Aborted by signal"));
    }
    try {
      const file = Bun.file(input.path);
      const exists = await file.exists();
      if (exists && !input.overwrite) {
        return fail(
          new ToolExecutionError(
            "fs.write_file",
            `File '${input.path}' already exists and overwrite is false`
          )
        );
      }
      await Bun.write(input.path, input.content);
      return ok({
        path: input.path,
        bytesWritten: Buffer.byteLength(input.content, "utf-8"),
        overwritten: exists,
      });
    } catch (err: unknown) {
      return fail(new ToolExecutionError("fs.write_file", String(err)));
    }
  },
};

export interface DeleteFileInput {
  readonly path: string;
}

export interface DeleteFileOutput {
  readonly path: string;
  readonly deleted: boolean;
}

export const deleteFileTool: ToolDefinition<DeleteFileInput, DeleteFileOutput> = {
  id: "fs.delete_file",
  name: "Delete File",
  description: "Permanently deletes a file from the filesystem. Requires explicit human approval.",
  category: "filesystem",
  version: "1.0.0",
  riskLevel: "critical",
  sideEffectClass: "consequential",
  requiredPermissions: ["file:delete"],
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path of file to delete", required: true },
    },
    required: ["path"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      deleted: { type: "boolean" },
    },
    required: ["path", "deleted"],
  },
  defaultTimeoutMs: 5000,
  maxTimeoutMs: 30000,
  requiresApproval: true,
  isConsequential: true,
  async execute(input: DeleteFileInput, context: ToolExecutionContext) {
    if (context.signal?.aborted) {
      return fail(new ToolExecutionError("fs.delete_file", "Aborted by signal"));
    }
    try {
      const file = Bun.file(input.path);
      const exists = await file.exists();
      if (!exists) {
        return fail(new ToolExecutionError("fs.delete_file", `File '${input.path}' does not exist`));
      }
      const unlink = await import("node:fs/promises").then((m) => m.unlink);
      await unlink(input.path);
      return ok({
        path: input.path,
        deleted: true,
      });
    } catch (err: unknown) {
      return fail(new ToolExecutionError("fs.delete_file", String(err)));
    }
  },
};
