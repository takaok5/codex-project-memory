import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdDiff } from "../../src/cli/commands/diff.js";
import { cmdDoctor } from "../../src/cli/commands/doctor.js";
import { cmdDuplicates } from "../../src/cli/commands/duplicates.js";
import { cmdFrame } from "../../src/cli/commands/frame.js";
import { cmdHead } from "../../src/cli/commands/head.js";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdQuery } from "../../src/cli/commands/query.js";
import { cmdRefresh } from "../../src/cli/commands/refresh.js";
import { cmdRender } from "../../src/cli/commands/render.js";
import { cmdScan } from "../../src/cli/commands/scan.js";

describe("nest-basic e2e", () => {
  it("runs the final demo command order through CLI command handlers", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-e2e-fixture-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await expect(cmdInit({ cwd: root })).resolves.toMatchObject({ ok: true });
      await expect(cmdDoctor({ cwd: root })).resolves.toMatchObject({ ok: true, data: { overallStatus: "ok" } });
      await expect(cmdScan({ cwd: root })).resolves.toMatchObject({ ok: true, data: { files: { scanned: 8, included: 8 } } });
      await expect(cmdIndex({ cwd: root })).resolves.toMatchObject({ ok: true, data: { records: { modules: 5, routes: 2 } } });
      const render = await cmdRender({ cwd: root, png: false });
      expect(render.ok).toBe(true);
      expect(render.data?.frames.map((frame) => frame.frame)).toEqual(["current", "overview", "modules", "duplicates", "risks"]);
      await expect(cmdHead({ cwd: root })).resolves.toMatchObject({ ok: true, data: { currentFrame: { svg: ".codex/memory/current.svg", png: null } } });
      await expect(
        cmdQuery({ cwd: root, intent: "Aggiungi controllo che impedisca l'apertura del tornello se l'abbonamento e sospeso.", visual: true })
      ).resolves.toMatchObject({ ok: true, data: { contextPack: { visualFrame: { map: ".codex/memory/current.map.json" } } } });
      const duplicate = await cmdDuplicates({
        cwd: root,
        kind: "service",
        moduleId: "access",
        proposedName: "AccessValidationService",
        intent: "AccessValidationService / verifica diritto accesso"
      });
      expect(duplicate).toMatchObject({ ok: true, data: { risk: "high", verdict: "extend_existing_artifact" } });
      expect(duplicate.data?.matches[0]).toMatchObject({ name: "AccessService" });
      await expect(cmdFrame({ cwd: root, frame: "current" })).resolves.toMatchObject({ ok: true, data: { svg: ".codex/memory/current.svg" } });
      await expect(cmdRefresh({ cwd: root })).resolves.toMatchObject({ ok: true, data: { changedOnly: true } });
      await expect(cmdDiff({ cwd: root })).resolves.toMatchObject({ ok: true, data: { changedFiles: [] } });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
