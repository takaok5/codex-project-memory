import { mkdtempSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { cmdScan } from "../../src/cli/commands/scan.js";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { listEdgesForGraph } from "../../src/store/edge-repository.js";
import { listFiles } from "../../src/store/file-repository.js";
import { listModules } from "../../src/store/module-repository.js";
import { listRoutes } from "../../src/store/route-repository.js";
import { searchSymbols } from "../../src/store/symbol-repository.js";
import { openMemoryDb } from "../../src/store/sqlite.js";
import { listActiveWarnings } from "../../src/store/warning-repository.js";

describe("project indexer fixture", () => {
  it("indexes nest-basic golden structure and changed-only keeps edges", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-fixture-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await expect(cmdScan({ cwd: root })).resolves.toMatchObject({ ok: true, data: { files: { scanned: 8, included: 8 } } });
      await expect(cmdIndex({ cwd: root })).resolves.toMatchObject({
        ok: true,
        data: {
          files: { scanned: 8, indexed: 8, deleted: 0, failed: 0 },
          records: { modules: 5, symbols: 20, symbolEdges: 7, routes: 2, warningsActive: 3 }
        }
      });
      await expect(cmdIndex({ cwd: root, changedOnly: true })).resolves.toMatchObject({
        ok: true,
        data: { files: { skippedUnchanged: 8 }, records: { symbolEdges: 7, warningsActive: 3 } }
      });

      const db = openMemoryDb(getMemoryPaths(root));
      try {
        expect(listFiles(db).map((file) => file.path)).toEqual([
          "src/access/access.controller.ts",
          "src/access/access.service.spec.ts",
          "src/access/access.service.ts",
          "src/audit/audit.service.ts",
          "src/auth/auth.controller.ts",
          "src/auth/auth.service.ts",
          "src/subscriptions/subscription.service.ts",
          "src/turnstile/turnstile.service.ts"
        ]);
        expect(listModules(db).map((module) => module.id)).toEqual(["access", "audit", "auth", "subscriptions", "turnstile"]);
        expect(searchSymbols(db, {}).map((symbol) => symbol.fqName)).toContain("AccessService.canOpen");
        expect(listRoutes(db).map((route) => `${route.method} ${route.path}`)).toEqual(["GET /auth/me", "POST /access/open"]);
        expect(listEdgesForGraph(db)).toHaveLength(7);
        expect(listActiveWarnings(db).map((warning) => warning.message).sort()).toEqual(["Unresolved import: @nestjs/common", "Unresolved import: @nestjs/common", "Unresolved import: vitest"]);
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
