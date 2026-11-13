/**
 * @terrarium/core - prompt/project-detector.ts
 *
 * Project Discovery, Root Directory Resolution, Manifest Analysis, and Context Packaging.
 * Contributed by A1 (Platform & Architecture) & A3 (Data, Security & Reliability).
 * Aligns with PROMPT 26 Phase C, G, and H.
 */

import path from "node:path";
import fs from "node:fs";
import { type PromptContextSource } from "@terrarium/contracts";

export interface ProjectInfo {
  readonly projectRoot: string;
  readonly projectName: string;
  readonly isGitRepo: boolean;
  readonly manifestType?: "bun_npm" | "cargo" | "python" | "go" | "generic";
  readonly manifestVersion?: string;
}

export interface AssembledContext {
  readonly sources: readonly PromptContextSource[];
  readonly totalChars: number;
  readonly fileCount: number;
  readonly textSnippet: string;
  readonly includedPaths: readonly string[];
}

const PROJECT_ROOT_MARKERS = [
  ".git",
  "package.json",
  "Cargo.toml",
  "pyproject.toml",
  "go.mod",
  "pom.xml",
  "Makefile",
];

/**
 * Traverses upwards from startDir to identify the true project root boundary.
 */
export function detectProjectRoot(startDir: string = process.cwd()): ProjectInfo {
  const resolvedStart = path.resolve(startDir);
  let current = resolvedStart;
  const root = path.parse(current).root;
  let foundMarker = false;

  while (current !== root) {
    const hasMarker = PROJECT_ROOT_MARKERS.some((marker) =>
      fs.existsSync(path.join(current, marker))
    );
    if (hasMarker) {
      foundMarker = true;
      break;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  if (!foundMarker && current === root) {
    foundMarker = PROJECT_ROOT_MARKERS.some((marker) =>
      fs.existsSync(path.join(current, marker))
    );
  }

  const effectiveRoot = foundMarker ? current : resolvedStart;
  const isGitRepo = fs.existsSync(path.join(effectiveRoot, ".git"));
  let manifestType: ProjectInfo["manifestType"] = undefined;
  let projectName = path.basename(effectiveRoot) || "unnamed";
  let manifestVersion: string | undefined;

  // Check package.json
  const pkgJsonPath = path.join(effectiveRoot, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      if (parsed.name) projectName = parsed.name;
      if (parsed.version) manifestVersion = parsed.version;
      manifestType = "bun_npm";
    } catch {}
  } else if (fs.existsSync(path.join(effectiveRoot, "Cargo.toml"))) {
    manifestType = "cargo";
  } else if (fs.existsSync(path.join(effectiveRoot, "pyproject.toml"))) {
    manifestType = "python";
  } else if (fs.existsSync(path.join(effectiveRoot, "go.mod"))) {
    manifestType = "go";
  } else if (foundMarker) {
    manifestType = "generic";
  }

  return {
    projectRoot: effectiveRoot,
    projectName,
    isGitRepo,
    manifestType,
    manifestVersion,
  };
}

/**
 * Safely packages requested context sources for inclusion in a prompt.
 * Rejects sensitive files (.env, .ssh, private keys) and enforces character bounds.
 */
export function assemblePromptContext(
  projectRoot: string,
  sources: readonly PromptContextSource[] = ["project_manifest"],
  maxChars = 8000
): AssembledContext {
  const chunks: string[] = [];
  const includedPaths: string[] = [];
  let currentChars = 0;

  for (const source of sources) {
    if (currentChars >= maxChars) break;

    if (source === "project_manifest") {
      const pkgPath = path.join(projectRoot, "package.json");
      if (fs.existsSync(pkgPath)) {
        try {
          const raw = fs.readFileSync(pkgPath, "utf8");
          const parsed = JSON.parse(raw);
          const summary = `[PROJECT MANIFEST: ${parsed.name ?? "unnamed"} v${parsed.version ?? "0.0.0"}]`;
          chunks.push(summary);
          includedPaths.push("package.json");
          currentChars += summary.length;
        } catch {}
      }
    } else if (source === "git_status") {
      try {
        const gitDir = path.join(projectRoot, ".git");
        if (fs.existsSync(gitDir)) {
          const summary = `[GIT REPOSITORY: root=${projectRoot}]`;
          chunks.push(summary);
          includedPaths.push(".git");
          currentChars += summary.length;
        }
      } catch {}
    } else if (source === "project_tree") {
      try {
        const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
        const visible = entries
          .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .slice(0, 25);
        const treeStr = `[WORKSPACE ROOTS: ${visible.join(", ")}]`;
        chunks.push(treeStr);
        currentChars += treeStr.length;
      } catch {}
    }
  }

  const textSnippet = chunks.join("\n\n");
  return {
    sources,
    totalChars: textSnippet.length,
    fileCount: includedPaths.length,
    textSnippet,
    includedPaths,
  };
}
