import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdDiff } from "../../src/cli/commands/diff.js";
import { cmdFrame } from "../../src/cli/commands/frame.js";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdRender } from "../../src/cli/commands/render.js";

describe("render/frame/diff CLI commands", () => {
  it("exposes current frame metadata and does not render implicitly", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-cli-render-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      await expect(cmdFrame({ cwd: root, frame: "current" })).resolves.toMatchObject({ ok: false, error: { code: "FRAME_NOT_FOUND" } });
      const render = await cmdRender({ cwd: root, png: false });
      expect(render.ok).toBe(true);
      await expect(cmdRender({ cwd: root, frame: "overview", png: false })).resolves.toMatchObject({
        ok: true,
        data: { frames: [{ frame: "overview", svg: ".codex/memory/frames/overview.svg", png: null, map: ".codex/memory/frames/overview.map.json" }] }
      });
      await expect(cmdRender({ cwd: root, frame: "modules", png: false })).resolves.toMatchObject({
        ok: true,
        data: { frames: [{ frame: "modules", svg: ".codex/memory/frames/modules.svg", png: null, map: ".codex/memory/frames/modules.map.json" }] }
      });
      await expect(cmdFrame({ cwd: root, frame: "current" })).resolves.toMatchObject({
        ok: true,
        data: {
          frame: "current",
          svg: ".codex/memory/current.svg",
          png: null,
          map: ".codex/memory/current.map.json",
          summary: { warnings: 0 }
        }
      });
      await expect(cmdDiff({ cwd: root, from: "latest", to: "current" })).resolves.toMatchObject({
        ok: true,
        data: { changedFiles: [], addedFiles: [], removedFiles: [] }
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
