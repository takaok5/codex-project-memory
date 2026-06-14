import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdRender } from "../../src/cli/commands/render.js";
import { handleMemoryQuery } from "../../src/mcp/tools/query.js";

describe("memory.query tool", () => {
  it("returns typed context pack without CliResult wrapper", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-mcp-query-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      await cmdRender({ cwd: root, png: false });
      const output = await handleMemoryQuery({ intent: "access subscription suspended", includeVisualFrame: true }, { cwd: root });
      expect(output).not.toHaveProperty("ok");
      expect(output.contextPack.modules.map((module) => module.id)).toContain("access");
      expect(output.contextPack.visualFrame).toMatchObject({ svg: ".codex/memory/current.svg", png: null });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
