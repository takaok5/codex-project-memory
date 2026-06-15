import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { PmemError } from "../shared/errors.js";
import { nowIso } from "../shared/time.js";
import type { MemoryPaths } from "../shared/types.js";

export type MemoryDb = Database.Database;

export function openMemoryDb(paths: MemoryPaths): MemoryDb {
  try {
    mkdirSync(dirname(paths.dbAbs), { recursive: true });
    const db = new Database(paths.dbAbs);
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    const foreignKeys = db.pragma("foreign_keys", { simple: true });
    if (foreignKeys !== 1) {
      throw new Error("PRAGMA foreign_keys did not enable");
    }
    return db;
  } catch (error) {
    throw new PmemError("DB_ERROR", "Project memory database error.", {
      details: { db: paths.dbRel, cause: error instanceof Error ? error.message : "unknown" }
    });
  }
}

export function ensureSchema(db: MemoryDb): void {
  try {
    const currentVersion = Number(db.pragma("user_version", { simple: true }) ?? 0);
    if ((currentVersion > 0 && currentVersion < 2) || (tableExists(db, "files") && !columnExists(db, "files", "analysis_json"))) {
      migrateToV2(db);
    }
    if (currentVersion > 0 && currentVersion < 3) {
      migrateToV3(db);
    }
    db.transaction(() => {
      db.exec(SCHEMA_SQL);
      db.pragma("user_version = 3");
      const now = nowIso();
      const insert = db.prepare("INSERT OR IGNORE INTO project_state(key, value, updated_at) VALUES (?, ?, ?)");
      for (const [key, value] of Object.entries(DEFAULT_PROJECT_STATE)) {
        insert.run(key, value, now);
      }
      db.prepare("UPDATE project_state SET value = ?, updated_at = ? WHERE key = ?").run("3", now, "schema_version");
    })();
  } catch (error) {
    throw new PmemError("DB_ERROR", "Project memory database error.", {
      details: { cause: error instanceof Error ? error.message : "unknown" }
    });
  }
}

function migrateToV3(db: MemoryDb): void {
  if (!tableExists(db, "warnings") || warningsSourceSupportsDiagnostic(db)) {
    return;
  }
  const previousForeignKeys = db.pragma("foreign_keys", { simple: true });
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE warnings_v3 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          warning_type TEXT NOT NULL,
          severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
          module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
          file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
          symbol_id INTEGER REFERENCES symbols(id) ON DELETE SET NULL,
          message TEXT NOT NULL,
          recommendation TEXT,
          source TEXT NOT NULL DEFAULT 'inferred' CHECK (source IN ('parser', 'indexer', 'renderer', 'agent', 'mcp', 'config', 'inferred', 'diagnostic')),
          confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
          fingerprint TEXT NOT NULL,
          created_at TEXT NOT NULL,
          resolved_at TEXT
        );
        INSERT INTO warnings_v3(id, warning_type, severity, module_id, file_id, symbol_id, message, recommendation, source, confidence, fingerprint, created_at, resolved_at)
          SELECT id, warning_type, severity, module_id, file_id, symbol_id, message, recommendation, source, confidence, fingerprint, created_at, resolved_at FROM warnings;
        DROP TABLE warnings;
        ALTER TABLE warnings_v3 RENAME TO warnings;
      `);
    })();
  } finally {
    db.pragma(`foreign_keys = ${previousForeignKeys === 1 ? "ON" : "OFF"}`);
  }
}

function migrateToV2(db: MemoryDb): void {
  if (!tableExists(db, "files") || columnExists(db, "files", "analysis_json")) {
    return;
  }
  const previousForeignKeys = db.pragma("foreign_keys", { simple: true });
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE files_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL UNIQUE,
          language TEXT,
          module_id TEXT REFERENCES modules(id) ON UPDATE CASCADE ON DELETE SET NULL,
          hash TEXT NOT NULL CHECK (length(hash) > 0),
          size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
          line_count INTEGER NOT NULL DEFAULT 0 CHECK (line_count >= 0),
          is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1)),
          is_generated INTEGER NOT NULL DEFAULT 0 CHECK (is_generated IN (0, 1)),
          last_indexed_at TEXT NOT NULL,
          analysis_json TEXT NOT NULL DEFAULT '{}',
          CHECK (path NOT LIKE '/%'),
          CHECK (path NOT LIKE '%\\%')
        );
        INSERT INTO files_v2(id, path, language, module_id, hash, size_bytes, line_count, is_test, is_generated, last_indexed_at, analysis_json)
          SELECT id, path, language, module_id, hash, size_bytes, line_count, is_test, is_generated, last_indexed_at, '{}' FROM files;
        DROP TABLE files;
        ALTER TABLE files_v2 RENAME TO files;
      `);
    })();
  } finally {
    db.pragma(`foreign_keys = ${previousForeignKeys === 1 ? "ON" : "OFF"}`);
  }
}

function tableExists(db: MemoryDb, tableName: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function columnExists(db: MemoryDb, tableName: string, columnName: string): boolean {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).some((column) => column.name === columnName);
}

function warningsSourceSupportsDiagnostic(db: MemoryDb): boolean {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'warnings'").get() as { sql?: string } | undefined;
  return Boolean(row?.sql?.includes("'diagnostic'"));
}

export function withTransaction<T>(db: MemoryDb, fn: () => T): T {
  return db.transaction(fn)();
}

export const REQUIRED_TABLES = [
  "project_state",
  "modules",
  "files",
  "symbols",
  "symbol_edges",
  "routes",
  "tests",
  "warnings",
  "duplicate_candidates",
  "frames",
  "retrieval_logs",
  "language_capabilities",
  "diagnostics"
];

export const FORBIDDEN_TABLES = ["features", "file_edges", "embeddings", "vectors", "source_chunks", "snapshot_records", "remote_sync", "team_memory"];

const DEFAULT_PROJECT_STATE: Record<string, string> = {
  schema_version: "3",
  memory_status: "fresh",
  memory_dirty: "false",
  dirty_reason: "",
  last_indexed_at: "",
  last_rendered_at: "",
  config_hash: "",
  indexer_version: "",
  renderer_version: "",
  last_error: ""
};

function loadSchemaSql(): string {
  const builtPath = new URL("./schema.sql", import.meta.url);
  if (existsSync(builtPath)) {
    return readFileSync(builtPath, "utf8");
  }
  return readFileSync(new URL("../../src/store/schema.sql", import.meta.url), "utf8");
}

const SCHEMA_SQL = loadSchemaSql();
