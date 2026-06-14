import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { PmemError } from "../../src/shared/errors.js";
import { ensureSchema, openMemoryDb } from "../../src/store/sqlite.js";
import { getProjectState, markMemoryDirty, markMemoryError, markMemoryFresh, setProjectStateValue } from "../../src/store/project-state-repository.js";

describe("project state repository", () => {
  it("reads defaults and updates status fields", () => {
    withDb((db) => {
      expect(getProjectState(db)).toMatchObject({ schemaVersion: "1", status: "fresh", memoryDirty: false });
      markMemoryDirty(db, "test");
      expect(getProjectState(db)).toMatchObject({ status: "dirty", memoryDirty: true, dirtyReason: "test" });
      markMemoryFresh(db, "2026-06-14T00:00:00.000Z");
      expect(getProjectState(db)).toMatchObject({ status: "fresh", memoryDirty: false, lastIndexedAt: "2026-06-14T00:00:00.000Z" });
      markMemoryError(db, { code: "CONFIG_ERROR", message: "bad config", recoverable: true });
      expect(getProjectState(db).lastError?.code).toBe("CONFIG_ERROR");
    });
  });

  it("rejects unknown keys", () => {
    withDb((db) => {
      expect(() => setProjectStateValue(db, "unknown", "x")).toThrow(PmemError);
    });
  });
});

function withDb(fn: (db: ReturnType<typeof openMemoryDb>) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), "pmem-state-"));
  try {
    const db = openMemoryDb(getMemoryPaths(root));
    try {
      ensureSchema(db);
      fn(db);
    } finally {
      db.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
