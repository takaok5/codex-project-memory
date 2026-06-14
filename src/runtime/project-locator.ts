import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { PmemError } from "../shared/errors.js";
import type { ProjectRootResult } from "../shared/types.js";

export function findProjectRoot(startDir = process.cwd()): ProjectRootResult {
  const resolved = path.resolve(startDir);
  const gitRoot = findGitRoot(resolved);
  if (gitRoot) {
    assertSafeProjectRoot(gitRoot);
    return { root: gitRoot, method: "git", warnings: [] };
  }

  assertSafeProjectRoot(resolved);
  return { root: resolved, method: "cwd", warnings: ["git_root_not_found: using cwd"] };
}

export function findGitRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const gitPath = path.join(current, ".git");
    if (existsSync(gitPath)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function assertSafeProjectRoot(root: string): void {
  const resolved = path.resolve(root);
  const parsed = path.parse(resolved);
  if (resolved === parsed.root) {
    throw new PmemError("SAFETY_ERROR", "Project root cannot be the filesystem root.");
  }
  if (resolved.endsWith(`${path.sep}.codex${path.sep}memory`) || resolved.endsWith(`${path.sep}.codex`)) {
    throw new PmemError("SAFETY_ERROR", "Project root cannot be inside Codex memory.");
  }
  try {
    if (!statSync(resolved).isDirectory()) {
      throw new PmemError("CONFIG_ERROR", "Project root is not a directory.");
    }
  } catch (error) {
    if (error instanceof PmemError) {
      throw error;
    }
    throw new PmemError("FS_ERROR", "Project root is not readable.", {
      details: { cause: error instanceof Error ? error.message : "unknown" }
    });
  }
}
