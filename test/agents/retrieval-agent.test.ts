import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runRetrievalAgent } from "../../src/agents/retrieval-agent.js";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdRender } from "../../src/cli/commands/render.js";
import { resolveRuntimeContext } from "../../src/runtime/context.js";
import type { MemoryDb } from "../../src/store/sqlite.js";

describe("retrieval agent", () => {
  it("returns compact access/subscription context with optional visual frame", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-ret-agent-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      await cmdRender({ cwd: root, png: false });
      const ctx = resolveRuntimeContext({ cwd: root, openDb: true });
      try {
        const output = runRetrievalAgent(ctx, { intent: "access subscription suspended", maxFiles: 8, maxSymbols: 12, maxWarnings: 8, includeVisualFrame: true });
        expect(output.contextPack.budget).toMatchObject({ defaultDeny: true, maxItems: 12 });
        expect(output.contextPack.evidence.length).toBeGreaterThan(0);
        expect(output.contextPack.evidence.every((item) => item.source === item.source.replaceAll("\\", "/"))).toBe(true);
        expect(output.contextPack.modules.map((module) => module.id)).toContain("access");
        expect(output.contextPack.modules.map((module) => module.id)).toContain("subscriptions");
        expect(output.contextPack.files.map((file) => file.path)).toContain("src/access/access.service.ts");
        expect(output.contextPack.symbols.map((symbol) => symbol.fqName)).toContain("SubscriptionService.isSuspended");
        expect(output.contextPack.visualFrame).toMatchObject({ frame: "current", svg: ".codex/memory/current.svg", png: null });
        expect(JSON.stringify(output)).not.toContain(root);

        const denied = runRetrievalAgent(ctx, { intent: "zzzz qqqq", maxFiles: 8, maxSymbols: 12, maxWarnings: 8, includeVisualFrame: false });
        expect(denied.contextPack).toMatchObject({
          summary: "No strong structural matches found.",
          budget: { usedItems: 0, defaultDeny: true },
          evidence: [],
          constraints: []
        });
      } finally {
        (ctx.db as MemoryDb).close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
