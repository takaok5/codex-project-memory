import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdHead } from "../../src/cli/commands/head.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { runPostToolUseHook } from "../../src/hooks/post-tool-use.js";

describe("PostToolUse hook", () => {
  it("marks memory dirty for relevant source changes", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-hook-ptu-"));
    try {
      await cmdInit({ cwd: root });
      await expect(runPostToolUseHook({ changedFiles: ["src/a.ts"] }, root)).resolves.toMatchObject({ ok: true, action: "marked_dirty" });
      await expect(cmdHead({ cwd: root })).resolves.toMatchObject({ data: { status: "dirty", memoryDirty: true } });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
