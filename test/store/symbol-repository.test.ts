import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { nowIso } from "../../src/shared/time.js";
import { upsertFileRecord } from "../../src/store/file-repository.js";
import { replaceSymbolsForFile, searchSymbols } from "../../src/store/symbol-repository.js";
import { ensureSchema, openMemoryDb } from "../../src/store/sqlite.js";

describe("symbol repository", () => {
  it("dedupes duplicate symbols for a file before insert", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-symbols-"));
    try {
      const db = openMemoryDb(getMemoryPaths(root));
      try {
        ensureSchema(db);
        const fileId = upsertFileRecord(db, {
          path: "src/service.ts",
          language: "typescript",
          moduleId: null,
          hash: "sha256:test",
          sizeBytes: 100,
          lineCount: 10,
          isTest: false,
          isGenerated: false,
          lastIndexedAt: nowIso()
        });

        expect(() =>
          replaceSymbolsForFile(db, fileId, [
            {
              fileId,
              fqName: "AccessService.canOpen",
              name: "canOpen",
              kind: "method",
              exported: false,
              startLine: 3,
              endLine: 3,
              signature: "canOpen(userId: string): boolean"
            },
            {
              fileId,
              fqName: "AccessService.canOpen",
              name: "canOpen",
              kind: "method",
              exported: true,
              startLine: 4,
              endLine: 9,
              signature: "canOpen(userId: string) { return true; }"
            },
            {
              fileId,
              fqName: "AccessService.canOpen",
              name: "canOpen",
              kind: "function",
              exported: false,
              startLine: 11,
              endLine: 11
            }
          ])
        ).not.toThrow();

        const symbols = searchSymbols(db, { filePath: "src/service.ts" });
        expect(symbols.map((symbol) => `${symbol.kind}:${symbol.fqName}`)).toEqual([
          "function:AccessService.canOpen",
          "method:AccessService.canOpen"
        ]);
        expect(symbols.find((symbol) => symbol.kind === "method")).toMatchObject({
          exported: true,
          startLine: 3,
          endLine: 9,
          signature: "canOpen(userId: string) { return true; }"
        });
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
