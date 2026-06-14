import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdRender } from "../../src/cli/commands/render.js";

describe("current frame renderer", () => {
  it("writes deterministic svg, map and generated JSON without absolute paths", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-render-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });

      const first = await cmdRender({ cwd: root, png: false });
      expect(first.ok).toBe(true);
      expect(first.data?.frames[0]).toMatchObject({
        frame: "current",
        svg: ".codex/memory/current.svg",
        png: null,
        map: ".codex/memory/current.map.json"
      });
      expect(first.data?.frames.map((frame) => frame.frame)).toEqual(["current", "overview", "modules", "duplicates", "risks"]);
      expect(first.data?.generatedJson).toContain(".codex/memory/generated/graph.json");
      const svgPath = path.join(root, ".codex/memory/current.svg");
      const mapPath = path.join(root, ".codex/memory/current.map.json");
      expect(existsSync(svgPath)).toBe(true);
      expect(existsSync(mapPath)).toBe(true);
      const svg1 = readFileSync(svgPath, "utf8");
      const map = JSON.parse(readFileSync(mapPath, "utf8")) as { items: Array<{ id: string }> };
      expect(map.items.length).toBeGreaterThan(0);
      for (const item of map.items) {
        expect(svg1).toContain(`data-pmem-id="${item.id}"`);
      }

      const second = await cmdRender({ cwd: root, png: false });
      const svg2 = readFileSync(svgPath, "utf8");
      expect(second.data?.sourceHash).toBe(first.data?.sourceHash);
      expect(svg2).toBe(svg1);
      const publicOutput = JSON.stringify({ first, map });
      expect(publicOutput).not.toContain(root);
      expect(publicOutput).not.toContain("\\");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
