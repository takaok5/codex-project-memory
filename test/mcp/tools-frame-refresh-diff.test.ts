import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdRender } from "../../src/cli/commands/render.js";
import { handleMemoryDiff } from "../../src/mcp/tools/diff.js";
import { handleMemoryFrame } from "../../src/mcp/tools/frame.js";
import { handleMemoryRefresh } from "../../src/mcp/tools/refresh.js";

describe("memory.frame/refresh/diff tools", () => {
  it("returns typed frame, refresh and diff outputs", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-mcp-frd-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      await cmdRender({ cwd: root, png: false });
      await expect(handleMemoryFrame({ frame: "current" }, { cwd: root })).resolves.toMatchObject({
        frame: "current",
        svg: ".codex/memory/current.svg",
        png: null,
        warnings: ["png_missing"]
      });
      await expect(handleMemoryRefresh({ render: false }, { cwd: root })).resolves.toMatchObject({
        status: "stale",
        changedOnly: true,
        visualFrame: null,
        warnings: ["render_skipped: visual frame may be stale"]
      });
      await expect(handleMemoryDiff({}, { cwd: root })).resolves.toMatchObject({
        changedFiles: [],
        newWarnings: [],
        resolvedWarnings: []
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
