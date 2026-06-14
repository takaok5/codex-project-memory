import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdRender } from "../../src/cli/commands/render.js";
import { handleMemoryDiff } from "../../src/mcp/tools/diff.js";
import { handleMemoryDuplicates } from "../../src/mcp/tools/duplicates.js";
import { handleMemoryFrame } from "../../src/mcp/tools/frame.js";
import { handleMemoryHead } from "../../src/mcp/tools/head.js";
import { handleMemoryQuery } from "../../src/mcp/tools/query.js";
import { handleMemoryRefresh } from "../../src/mcp/tools/refresh.js";

describe("MCP sequence e2e", () => {
  it("runs head/query/duplicates/frame/refresh/diff with typed outputs", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-e2e-mcp-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await expect(handleMemoryHead({}, { cwd: root })).resolves.toMatchObject({ status: "not_initialized" });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      await cmdRender({ cwd: root, png: false });
      await expect(handleMemoryHead({}, { cwd: root })).resolves.toMatchObject({ status: "fresh", visualFrame: { svg: ".codex/memory/current.svg" } });
      await expect(handleMemoryQuery({ intent: "access subscription suspended", includeVisualFrame: true }, { cwd: root })).resolves.toMatchObject({
        contextPack: { visualFrame: { map: ".codex/memory/current.map.json" } }
      });
      await expect(
        handleMemoryDuplicates({ kind: "service", moduleId: "access", proposedName: "AccessValidationService", intent: "AccessValidationService / verifica diritto accesso" }, { cwd: root })
      ).resolves.toMatchObject({ risk: "high", verdict: "extend_existing_artifact" });
      await expect(handleMemoryFrame({ frame: "current" }, { cwd: root })).resolves.toMatchObject({ frame: "current" });
      await expect(handleMemoryRefresh({ render: false }, { cwd: root })).resolves.toMatchObject({ status: "stale" });
      await expect(handleMemoryDiff({}, { cwd: root })).resolves.toMatchObject({ changedFiles: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
