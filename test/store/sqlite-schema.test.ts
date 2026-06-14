import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { ensureSchema, FORBIDDEN_TABLES, openMemoryDb, REQUIRED_TABLES } from "../../src/store/sqlite.js";

describe("sqlite schema", () => {
  it("creates schema v1 with foreign keys and no forbidden tables", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-db-"));
    try {
      const paths = getMemoryPaths(root);
      const db = openMemoryDb(paths);
      try {
        ensureSchema(db);
        expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
        expect(db.pragma("user_version", { simple: true })).toBe(1);
        const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((row) => row.name);
        expect(REQUIRED_TABLES.every((table) => tables.includes(table))).toBe(true);
        expect(FORBIDDEN_TABLES.some((table) => tables.includes(table))).toBe(false);
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
