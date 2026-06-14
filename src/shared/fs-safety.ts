import path from "node:path";
import { PmemError } from "./errors.js";
import type { MemoryPaths } from "./types.js";

export function assertInsideProjectRoot(absPath: string, projectRoot: string): void {
  assertInside(absPath, projectRoot, "Path is outside project root.");
}

export function assertInsideMemoryRoot(absPath: string, paths: MemoryPaths): void {
  assertInside(absPath, paths.memoryRootAbs, "Path is outside memory root.");
}

function assertInside(absPath: string, root: string, message: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(absPath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PmemError("SAFETY_ERROR", message);
  }
}
