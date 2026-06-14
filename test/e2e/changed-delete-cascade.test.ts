import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cmdIndex } from "../../src/cli/commands/index.js";
import { cmdInit } from "../../src/cli/commands/init.js";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { openMemoryDb } from "../../src/store/sqlite.js";
import { searchSymbols } from "../../src/store/symbol-repository.js";

describe("changed/delete cascade e2e", () => {
  it("removes deleted files and stale symbols on changed index", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-e2e-delete-"));
    try {
      cpSync(path.resolve("test/fixtures/nest-basic"), root, { recursive: true });
      await cmdInit({ cwd: root });
      await cmdIndex({ cwd: root });
      rmSync(path.join(root, "src/auth/auth.service.ts"));
      await expect(cmdIndex({ cwd: root, changedOnly: true })).resolves.toMatchObject({ ok: true, data: { files: { deleted: 1 } } });
      const db = openMemoryDb(getMemoryPaths(root));
      try {
        expect(searchSymbols(db, {}).map((symbol) => symbol.fqName)).not.toContain("AuthService");
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
