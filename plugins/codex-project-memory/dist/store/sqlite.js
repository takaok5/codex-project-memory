import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { PmemError } from "../shared/errors.js";
import { nowIso } from "../shared/time.js";
export function openMemoryDb(paths) {
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
    }
    catch (error) {
        throw new PmemError("DB_ERROR", "Project memory database error.", {
            details: { db: paths.dbRel, cause: error instanceof Error ? error.message : "unknown" }
        });
    }
}
export function ensureSchema(db) {
    try {
        db.transaction(() => {
            db.exec(SCHEMA_SQL);
            db.pragma("user_version = 1");
            const now = nowIso();
            const insert = db.prepare("INSERT OR IGNORE INTO project_state(key, value, updated_at) VALUES (?, ?, ?)");
            for (const [key, value] of Object.entries(DEFAULT_PROJECT_STATE)) {
                insert.run(key, value, now);
            }
        })();
    }
    catch (error) {
        throw new PmemError("DB_ERROR", "Project memory database error.", {
            details: { cause: error instanceof Error ? error.message : "unknown" }
        });
    }
}
export function withTransaction(db, fn) {
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
    "retrieval_logs"
];
export const FORBIDDEN_TABLES = ["features", "file_edges", "embeddings", "vectors", "source_chunks", "snapshot_records", "remote_sync", "team_memory"];
const DEFAULT_PROJECT_STATE = {
    schema_version: "1",
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
function loadSchemaSql() {
    const builtPath = new URL("./schema.sql", import.meta.url);
    if (existsSync(builtPath)) {
        return readFileSync(builtPath, "utf8");
    }
    return readFileSync(new URL("../../src/store/schema.sql", import.meta.url), "utf8");
}
const SCHEMA_SQL = loadSchemaSql();
//# sourceMappingURL=sqlite.js.map