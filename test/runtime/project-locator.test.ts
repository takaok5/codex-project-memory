import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findGitRoot, findProjectRoot } from "../../src/runtime/project-locator.js";

describe("project locator", () => {
  it("finds a .git root by walking parents", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-git-"));
    try {
      mkdirSync(path.join(root, ".git"));
      mkdirSync(path.join(root, "src", "nested"), { recursive: true });
      expect(findGitRoot(path.join(root, "src", "nested"))).toBe(root);
      expect(findProjectRoot(path.join(root, "src", "nested"))).toEqual({ root, method: "git", warnings: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("falls back to cwd when no git root exists", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-cwd-"));
    try {
      writeFileSync(path.join(root, "package.json"), "{}");
      const result = findProjectRoot(root);
      expect(result.root).toBe(root);
      expect(result.method).toBe("cwd");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
