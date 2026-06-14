import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMemoryPaths, ensureMemoryDirectories } from "../../src/runtime/memory-paths.js";
import { toMemoryRelativePosix, toProjectRelativePosix } from "../../src/shared/path.js";

describe("memory paths", () => {
  it("builds exact v0.1 memory paths and creates directories", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-paths-"));
    try {
      const paths = getMemoryPaths(root);
      ensureMemoryDirectories(paths);

      expect(paths.memoryRootRel).toBe(".codex/memory");
      expect(paths.configRel).toBe(".codex/memory/project-memory.config.json");
      expect(paths.dbRel).toBe(".codex/memory/memory.db");
      expect(toProjectRelativePosix(paths.configAbs, root)).toBe(paths.configRel);
      expect(toMemoryRelativePosix(paths.currentSvgAbs, paths)).toBe(paths.currentSvgRel);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
