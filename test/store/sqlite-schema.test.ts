import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMemoryPaths } from "../../src/runtime/memory-paths.js";
import { ensureSchema, FORBIDDEN_TABLES, openMemoryDb, REQUIRED_TABLES } from "../../src/store/sqlite.js";
import { addWarning } from "../../src/store/warning-repository.js";

describe("sqlite schema", () => {
  it("creates schema v3 with foreign keys, diagnostics and no forbidden tables", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-db-"));
    try {
      const paths = getMemoryPaths(root);
      const db = openMemoryDb(paths);
      try {
        ensureSchema(db);
        expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
        expect(db.pragma("user_version", { simple: true })).toBe(3);
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

  it("migrates v1 files language check to v3 open language ids and diagnostics", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-db-v1-"));
    try {
      const paths = getMemoryPaths(root);
      const db = openMemoryDb(paths);
      try {
        db.exec(`
          CREATE TABLE project_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE modules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owns_json TEXT NOT NULL DEFAULT '[]',
            must_not_json TEXT NOT NULL DEFAULT '[]',
            dependencies_json TEXT NOT NULL DEFAULT '[]',
            risk_level TEXT NOT NULL DEFAULT 'normal',
            updated_at TEXT NOT NULL
          );
          CREATE TABLE files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            language TEXT CHECK (language IS NULL OR language IN ('typescript', 'javascript')),
            module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
            hash TEXT NOT NULL,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            line_count INTEGER NOT NULL DEFAULT 0,
            is_test INTEGER NOT NULL DEFAULT 0,
            is_generated INTEGER NOT NULL DEFAULT 0,
            last_indexed_at TEXT NOT NULL
          );
          PRAGMA user_version = 1;
        `);
        ensureSchema(db);
        expect(db.pragma("user_version", { simple: true })).toBe(3);
        expect(() =>
          db
            .prepare("INSERT INTO files(path, language, hash, last_indexed_at, analysis_json) VALUES (?, ?, ?, ?, ?)")
            .run("src/app.py", "python", "hash", "2026-01-01T00:00:00.000Z", "{}")
        ).not.toThrow();
        expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='diagnostics'").get()).toBeTruthy();
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("migrates v2 databases to v3 without losing indexed files", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-db-v2-"));
    try {
      const paths = getMemoryPaths(root);
      const db = openMemoryDb(paths);
      try {
        db.exec(`
          CREATE TABLE project_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
          INSERT INTO project_state(key, value, updated_at) VALUES ('schema_version', '2', '2026-01-01T00:00:00.000Z');
          CREATE TABLE modules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owns_json TEXT NOT NULL DEFAULT '[]',
            must_not_json TEXT NOT NULL DEFAULT '[]',
            dependencies_json TEXT NOT NULL DEFAULT '[]',
            risk_level TEXT NOT NULL DEFAULT 'normal',
            updated_at TEXT NOT NULL
          );
          CREATE TABLE files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            language TEXT,
            module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
            hash TEXT NOT NULL,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            line_count INTEGER NOT NULL DEFAULT 0,
            is_test INTEGER NOT NULL DEFAULT 0,
            is_generated INTEGER NOT NULL DEFAULT 0,
            last_indexed_at TEXT NOT NULL,
            analysis_json TEXT NOT NULL DEFAULT '{}'
          );
          INSERT INTO files(path, language, hash, last_indexed_at, analysis_json) VALUES ('src/app.py', 'python', 'hash', '2026-01-01T00:00:00.000Z', '{}');
          PRAGMA user_version = 2;
        `);
        ensureSchema(db);
        expect(db.pragma("user_version", { simple: true })).toBe(3);
        expect((db.prepare("SELECT COUNT(*) AS count FROM files").get() as { count: number }).count).toBe(1);
        expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='diagnostics'").get()).toBeTruthy();
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("migrates old warning source constraints to accept diagnostics", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pmem-db-v2-warnings-"));
    try {
      const paths = getMemoryPaths(root);
      const db = openMemoryDb(paths);
      try {
        db.exec(`
          CREATE TABLE project_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
          INSERT INTO project_state(key, value, updated_at) VALUES ('schema_version', '2', '2026-01-01T00:00:00.000Z');
          CREATE TABLE modules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owns_json TEXT NOT NULL DEFAULT '[]',
            must_not_json TEXT NOT NULL DEFAULT '[]',
            dependencies_json TEXT NOT NULL DEFAULT '[]',
            risk_level TEXT NOT NULL DEFAULT 'normal',
            updated_at TEXT NOT NULL
          );
          CREATE TABLE files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            language TEXT,
            module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
            hash TEXT NOT NULL,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            line_count INTEGER NOT NULL DEFAULT 0,
            is_test INTEGER NOT NULL DEFAULT 0,
            is_generated INTEGER NOT NULL DEFAULT 0,
            last_indexed_at TEXT NOT NULL,
            analysis_json TEXT NOT NULL DEFAULT '{}'
          );
          INSERT INTO files(path, language, hash, last_indexed_at, analysis_json) VALUES ('src/app.ts', 'typescript', 'hash', '2026-01-01T00:00:00.000Z', '{}');
          CREATE TABLE warnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            warning_type TEXT NOT NULL,
            severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
            module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
            file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
            symbol_id INTEGER,
            message TEXT NOT NULL,
            recommendation TEXT,
            source TEXT NOT NULL DEFAULT 'inferred' CHECK (source IN ('parser', 'indexer', 'renderer', 'agent', 'mcp', 'config', 'inferred')),
            confidence REAL NOT NULL DEFAULT 1.0,
            fingerprint TEXT NOT NULL,
            created_at TEXT NOT NULL,
            resolved_at TEXT
          );
          PRAGMA user_version = 2;
        `);
        ensureSchema(db);
        expect(() =>
          addWarning(db, {
            warningType: "compiler_diagnostic",
            severity: "critical",
            fileId: 1,
            message: "tsc TS2322: type mismatch",
            source: "diagnostic",
            confidence: 0.9
          })
        ).not.toThrow();
      } finally {
        db.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
