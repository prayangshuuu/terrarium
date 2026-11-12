/**
 * @terrarium/core - studio/diff-engine.ts
 *
 * Unified diff generator, parser, hunk extractor, and hash computation utilities.
 * Contributed by A1 (Platform & Architecture) & A5 (Product Interface Designer).
 */

import crypto from "node:crypto";
import { type CodeDiffHunk } from "@terrarium/contracts";

export function computeSha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Generates unified diff and hunks between original and proposed content.
 */
export function createUnifiedDiff(
  filePath: string,
  originalContent: string,
  proposedContent: string
): { diffUnified: string; hunks: readonly CodeDiffHunk[] } {
  const oldLines = originalContent.length === 0 ? [] : originalContent.split("\n");
  const newLines = proposedContent.length === 0 ? [] : proposedContent.split("\n");

  const hunks: CodeDiffHunk[] = [];
  const diffLines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
  ];

  // If identical
  if (originalContent === proposedContent) {
    return {
      diffUnified: diffLines.join("\n"),
      hunks: [],
    };
  }

  // Handle completely new file
  if (oldLines.length === 0) {
    const hunkLines = newLines.map((l) => `+${l}`);
    const header = `@@ -0,0 +1,${newLines.length} @@`;
    hunks.push({
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: newLines.length,
      header,
      lines: hunkLines,
    });
    diffLines.push(header);
    diffLines.push(...hunkLines);
    return {
      diffUnified: diffLines.join("\n"),
      hunks,
    };
  }

  // Handle completely deleted file
  if (newLines.length === 0) {
    const hunkLines = oldLines.map((l) => `-${l}`);
    const header = `@@ -1,${oldLines.length} +0,0 @@`;
    hunks.push({
      oldStart: 1,
      oldLines: oldLines.length,
      newStart: 0,
      newLines: 0,
      header,
      lines: hunkLines,
    });
    diffLines.push(header);
    diffLines.push(...hunkLines);
    return {
      diffUnified: diffLines.join("\n"),
      hunks,
    };
  }

  // Standard line-by-line diffing algorithm with simple hunk consolidation
  let oldIdx = 0;
  let newIdx = 0;
  let currentHunkLines: string[] = [];
  let hunkOldStart = 1;
  let hunkNewStart = 1;
  let hunkOldCount = 0;
  let hunkNewCount = 0;

  const flushHunk = () => {
    if (currentHunkLines.length > 0) {
      const header = `@@ -${hunkOldStart},${hunkOldCount} +${hunkNewStart},${hunkNewCount} @@`;
      hunks.push({
        oldStart: hunkOldStart,
        oldLines: hunkOldCount,
        newStart: hunkNewStart,
        newLines: hunkNewCount,
        header,
        lines: currentHunkLines,
      });
      diffLines.push(header);
      diffLines.push(...currentHunkLines);
      currentHunkLines = [];
      hunkOldCount = 0;
      hunkNewCount = 0;
    }
  };

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];

    if (oldLine === newLine) {
      // Unchanged line
      if (currentHunkLines.length > 0) {
        currentHunkLines.push(` ${oldLine}`);
        hunkOldCount++;
        hunkNewCount++;
      }
      oldIdx++;
      newIdx++;
    } else {
      // Line mismatch
      if (currentHunkLines.length === 0) {
        hunkOldStart = oldIdx + 1;
        hunkNewStart = newIdx + 1;
      }

      if (oldIdx < oldLines.length) {
        currentHunkLines.push(`-${oldLine}`);
        hunkOldCount++;
        oldIdx++;
      }
      if (newIdx < newLines.length) {
        currentHunkLines.push(`+${newLine}`);
        hunkNewCount++;
        newIdx++;
      }
    }
  }

  flushHunk();

  return {
    diffUnified: diffLines.join("\n"),
    hunks,
  };
}
