import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdRender } from "../../src/cli/commands/render.js";

describe("PNG nullable e2e", () => {
  it("keeps render successful when PNG export is disabled", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-e2e-png-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      const render = await cmdRender({ cwd: root, png: false });
      expect(render.ok).toBe(true);
      expect(render.data?.frames.every((frame) => frame.png === null)).toBe(true);
      expect(render.warnings.some((warning) => warning.startsWith("png_export_failed"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
