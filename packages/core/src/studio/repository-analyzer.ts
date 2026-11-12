/**
 * @terrarium/core - studio/repository-analyzer.ts
 *
 * Repository inspection, language/framework detection, entry point discovery,
 * dependency extraction, and sensitive file mapping.
 * Contributed by A1 (Platform & Architecture) & A2 (Orchestration & AI Runtime).
 */

import path from "node:path";
import fs from "node:fs/promises";
import { type CodeAnalysisSummary } from "@terrarium/contracts";
import { CodeSecuritySandbox } from "./code-security-sandbox.ts";

export interface RepositoryAnalyzerOptions {
  readonly workspaceRoot: string;
  readonly maxFilesToScan?: number;
  readonly ignorePatterns?: readonly string[];
}

const EXT_TO_LANGUAGE: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript (React)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (React)",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".c": "C",
  ".cpp": "C++",
  ".cs": "C#",
  ".html": "HTML",
  ".css": "CSS",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".md": "Markdown",
  ".sh": "Shell",
};

const DEFAULT_IGNORE = [
  ".git",
  "node_modules",
  "dist",
  "build",
  ".gemini",
  "coverage",
  ".turbo",
  ".next",
];

export class RepositoryAnalyzer {
  private readonly workspaceRoot: string;
  private readonly maxFiles: number;
  private readonly ignoreList: readonly string[];
  private readonly sandbox: CodeSecuritySandbox;

  constructor(options: RepositoryAnalyzerOptions) {
    this.workspaceRoot = path.resolve(options.workspaceRoot);
    this.maxFiles = options.maxFilesToScan ?? 500;
    this.ignoreList = options.ignorePatterns ?? DEFAULT_IGNORE;
    this.sandbox = new CodeSecuritySandbox({ workspaceRoot: this.workspaceRoot });
  }

  public async analyze(): Promise<CodeAnalysisSummary> {
    const languageCounts: Record<string, number> = {};
    const sensitiveFiles: { path: string; reason: string; isProtected: boolean }[] = [];
    const frameworks = new Set<string>();
    const entryPoints: string[] = [];
    const testFrameworks = new Set<string>();
    const dependencies: { name: string; version: string; isDev: boolean }[] = [];
    let scannedFilesCount = 0;

    // Scan directory tree
    const scanDir = async (dir: string): Promise<void> => {
      if (scannedFilesCount >= this.maxFiles) return;

      let entries: string[] = [];
      try {
        entries = await fs.readdir(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (scannedFilesCount >= this.maxFiles) break;
        if (this.ignoreList.includes(entry)) continue;

        const fullPath = path.join(dir, entry);
        const relPath = path.relative(this.workspaceRoot, fullPath);

        let stat;
        try {
          stat = await fs.stat(fullPath);
        } catch {
          continue;
        }

        if (stat.isDirectory()) {
          await scanDir(fullPath);
        } else if (stat.isFile()) {
          scannedFilesCount++;
          const ext = path.extname(entry).toLowerCase();
          const lang = EXT_TO_LANGUAGE[ext];
          if (lang) {
            languageCounts[lang] = (languageCounts[lang] ?? 0) + 1;
          }

          // Protected / Sensitive files check
          const prot = this.sandbox.isProtectedFile(relPath);
          if (prot.protected) {
            sensitiveFiles.push({
              path: relPath,
              reason: prot.reason ?? "Credentials or secret configuration",
              isProtected: true,
            });
          }

          // Entry points heuristics
          if (
            relPath === "src/index.ts" ||
            relPath === "src/main.ts" ||
            relPath === "src/index.tsx" ||
            relPath === "apps/cli/src/index.tsx" ||
            relPath === "main.py" ||
            relPath === "app.py" ||
            relPath === "src/main.rs" ||
            relPath === "main.go"
          ) {
            entryPoints.push(relPath);
          }

          // Manifest analysis
          if (entry === "package.json") {
            try {
              const content = await fs.readFile(fullPath, "utf8");
              const pkg = JSON.parse(content);
              frameworks.add("Node.js / Bun");
              if (pkg.dependencies) {
                for (const [dep, ver] of Object.entries(pkg.dependencies)) {
                  dependencies.push({ name: dep, version: String(ver), isDev: false });
                  if (dep === "react") frameworks.add("React");
                  if (dep === "next") frameworks.add("Next.js");
                  if (dep === "express") frameworks.add("Express");
                  if (dep === "@opentui/core" || dep === "@opentui/react") frameworks.add("OpenTUI");
                }
              }
              if (pkg.devDependencies) {
                for (const [dep, ver] of Object.entries(pkg.devDependencies)) {
                  dependencies.push({ name: dep, version: String(ver), isDev: true });
                  if (dep === "vitest" || dep === "jest") testFrameworks.add(dep);
                  if (dep === "typescript") frameworks.add("TypeScript");
                }
              }
              if (pkg.scripts?.test?.includes("bun test")) {
                testFrameworks.add("bun:test");
              }
            } catch {}
          }

          if (entry === "Cargo.toml") {
            frameworks.add("Rust / Cargo");
            testFrameworks.add("cargo test");
          }
          if (entry === "pyproject.toml" || entry === "requirements.txt") {
            frameworks.add("Python");
            testFrameworks.add("pytest");
          }
        }
      }
    };

    await scanDir(this.workspaceRoot);

    // Compute language breakdown percentages
    const totalLangFiles = Object.values(languageCounts).reduce((a, b) => a + b, 0);
    const languages = Object.entries(languageCounts)
      .map(([name, count]) => ({
        name,
        filesCount: count,
        percentage: totalLangFiles > 0 ? Math.round((count / totalLangFiles) * 100) : 0,
      }))
      .sort((a, b) => b.filesCount - a.filesCount);

    // Inspect git branch and clean status
    let branch: string | undefined;
    let isClean = true;
    try {
      const proc = Bun.spawn(["git", "status", "--porcelain", "-b"], {
        cwd: this.workspaceRoot,
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      if (exitCode === 0) {
        const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
        const header = lines[0] ?? "";
        branch = header.replace(/^##\s*/, "").split("...")[0] || "main";
        isClean = lines.length <= 1;
      }
    } catch {
      // Non-git repo or git not found
    }

    if (testFrameworks.size === 0) {
      testFrameworks.add("bun:test");
    }

    return {
      repoPath: this.workspaceRoot,
      branch,
      isClean,
      languages,
      frameworks: Array.from(frameworks),
      entryPoints,
      dependencies: dependencies.slice(0, 30),
      testFrameworks: Array.from(testFrameworks),
      sensitiveFiles,
      analyzedAt: new Date().toISOString(),
    };
  }
}
