/**
 * @terrarium/core - tools/builtin/index.ts
 *
 * Built-in tool suite loader and registration.
 */

import { type ToolRegistry } from "@terrarium/contracts";
import { readFileTool, writeFileTool, deleteFileTool } from "./fs-tools.ts";
import { shellCommandTool } from "./shell-tool.ts";
import { gitStatusTool, gitCommitTool, gitPushTool } from "./git-tools.ts";
import { externalPublishTool, productionDeployTool, sendMessageTool } from "./external-tools.ts";

export * from "./fs-tools.ts";
export * from "./shell-tool.ts";
export * from "./git-tools.ts";
export * from "./external-tools.ts";

export const BUILTIN_TOOLS = [
  readFileTool,
  writeFileTool,
  deleteFileTool,
  shellCommandTool,
  gitStatusTool,
  gitCommitTool,
  gitPushTool,
  externalPublishTool,
  productionDeployTool,
  sendMessageTool,
] as const;

/**
 * Registers the full canonical suite of built-in tools into a registry.
 */
export function registerBuiltinTools(registry: ToolRegistry): void {
  for (const tool of BUILTIN_TOOLS) {
    registry.register(tool);
  }
}
