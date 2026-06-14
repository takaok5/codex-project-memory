import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractChangedFilesFromHookEvent, isHookLoopGuardActive, resolveHookRuntimeContext, withHookLoopGuard } from "../../src/hooks/shared.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import type { MemoryDb } from "../../src/store/sqlite.js";

describe("hook shared helpers", () => {
  it("extracts and filters changed files", () => {
    expect(
      extractChangedFilesFromHookEvent({
        tool: { output: { filesWritten: ["src/a.ts", ".codex/memory/current.svg", "node_modules/x.js", "../bad.ts", "dist/out.js"] } }
      }).files
    ).toEqual(["src/a.ts"]);
    expect(extractChangedFilesFromHookEvent({ unknown: true }).warnings).toContain("hook_event_unrecognized");
  });

  it("uses loop guard lock", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-hook-shared-"));
    try {
      await cmdInit({ cwd: root });
      const ctx = resolveHookRuntimeContext(root);
      expect(ctx).toBeTruthy();
      await withHookLoopGuard(ctx!, async () => {
        expect(isHookLoopGuardActive(ctx!)).toMatchObject({ active: true });
      });
      (ctx!.db as MemoryDb).close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
