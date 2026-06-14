import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { nowIso } from "../../src/shared/time.js";
import { getFileByPath, listFiles, removeFileRecordCascade, upsertFileRecord } from "../../src/store/file-repository.js";
import { ensureSchema, openMemoryDb } from "../../src/store/sqlite.js";

describe("file repository", () => {
  it("upserts, lists, looks up and deletes files", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-files-"));
    try {
      const db = openMemoryDb(getMemoryPaths(root));
      try {
        ensureSchema(db);
        const id = upsertFileRecord(db, {
          path: "src/example.ts",
          language: "typescript",
          moduleId: null,
          hash: "sha256:test",
          sizeBytes: 12,
          lineCount: 1,
          isTest: false,
          isGenerated: false,
          lastIndexedAt: nowIso()
        });
        expect(id).toBeGreaterThan(0);
        expect(getFileByPath(db, "src\\example.ts")?.path).toBe("src/example.ts");
        expect(listFiles(db)).toHaveLength(1);
        removeFileRecordCascade(db, "src/example.ts");
        expect(listFiles(db)).toHaveLength(0);
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
