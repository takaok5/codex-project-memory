import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdDuplicates } from "../../src/cli/commands/duplicates.js";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdQuery } from "../../src/cli/commands/query.js";
import { cmdRefresh } from "../../src/cli/commands/refresh.js";
import { cmdRender } from "../../src/cli/commands/render.js";

describe("query/duplicates/refresh CLI commands", () => {
  it("returns context, duplicate risk and changed-only refresh output", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-cli-p5-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      await cmdRender({ cwd: root, png: false });

      await expect(cmdQuery({ cwd: root, intent: "access subscription suspended", visual: true })).resolves.toMatchObject({
        ok: true,
        data: { contextPack: { visualFrame: { svg: ".codex/memory/current.svg" } } }
      });
      const duplicates = await cmdDuplicates({
        cwd: root,
        kind: "service",
        moduleId: "access",
        proposedName: "AccessValidationService",
        intent: "AccessValidationService / verifica diritto accesso"
      });
      expect(duplicates).toMatchObject({ ok: true, data: { risk: "high", verdict: "extend_existing_artifact" } });
      expect(duplicates.data?.matches[0]).toMatchObject({ name: "AccessService" });
      await expect(cmdRefresh({ cwd: root, render: false })).resolves.toMatchObject({
        ok: true,
        data: { changedOnly: true, render: { skipped: true }, state: { status: "stale" } },
        warnings: ["render_skipped: visual frame may be stale"]
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
