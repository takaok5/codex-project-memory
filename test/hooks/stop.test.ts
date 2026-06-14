import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdInit } from "../../src/cli/commands/init.js";
import { runStopHook } from "../../src/hooks/stop.js";

describe("Stop hook", () => {
  it("does not refresh when loop guard env is active", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-hook-stop-"));
    const old = process.env.PMEM_HOOK_RUNNING;
    try {
      await cmdInit({ cwd: root });
      process.env.PMEM_HOOK_RUNNING = "1";
      await expect(runStopHook({ changedFiles: ["src/a.ts"] }, root)).resolves.toMatchObject({ ok: true, action: "noop", warnings: ["hook_loop_guard_env"] });
    } finally {
      if (old === undefined) delete process.env.PMEM_HOOK_RUNNING;
      else process.env.PMEM_HOOK_RUNNING = old;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
