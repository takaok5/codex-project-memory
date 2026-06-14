import { PmemError, toErrorPayload } from "../shared/errors.js";
import { safeJsonParse, writeJson } from "../shared/json.js";
import { nowIso } from "../shared/time.js";
import type { ErrorPayload, MemoryStatus, ProjectState } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";

const ALLOWED_KEYS = new Set([
  "schema_version",
  "project_name",
  "memory_status",
  "memory_dirty",
  "dirty_reason",
  "last_indexed_at",
  "last_rendered_at",
  "config_hash",
  "indexer_version",
  "renderer_version",
  "last_error"
]);

export function getProjectState(db: MemoryDb): ProjectState {
  try {
    const rows = db.prepare("SELECT key, value FROM project_state").all() as Array<{ key: string; value: string }>;
    const state = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return {
      schemaVersion: state.schema_version || null,
      status: parseStatus(state.memory_status),
      projectName: state.project_name || null,
      lastIndexedAt: state.last_indexed_at || null,
      lastRenderedAt: state.last_rendered_at || null,
      memoryDirty: state.memory_dirty === "true",
      dirtyReason: state.dirty_reason ?? "",
      lastError: parseLastError(state.last_error)
    };
  } catch (error) {
    throw new PmemError("DB_ERROR", "Project memory database error.", {
      details: { cause: error instanceof Error ? error.message : "unknown" }
    });
  }
}

export function setProjectStateValue(db: MemoryDb, key: string, value: string): void {
  if (!ALLOWED_KEYS.has(key)) {
    throw new PmemError("VALIDATION_ERROR", "Unknown project_state key.");
  }
  try {
    db.prepare(
      "INSERT INTO project_state(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at"
    ).run(key, value, nowIso());
  } catch (error) {
    throw new PmemError("DB_ERROR", "Project memory database error.", {
      details: { cause: error instanceof Error ? error.message : "unknown" }
    });
  }
}

export function markMemoryDirty(db: MemoryDb, reason: string): void {
  const tx = db.transaction(() => {
    setProjectStateValue(db, "memory_status", "dirty");
    setProjectStateValue(db, "memory_dirty", "true");
    setProjectStateValue(db, "dirty_reason", reason);
  });
  tx();
}

export function markMemoryFresh(db: MemoryDb, indexedAt?: string): void {
  const tx = db.transaction(() => {
    setProjectStateValue(db, "memory_status", "fresh");
    setProjectStateValue(db, "memory_dirty", "false");
    setProjectStateValue(db, "dirty_reason", "");
    if (indexedAt) {
      setProjectStateValue(db, "last_indexed_at", indexedAt);
    }
  });
  tx();
}

export function markMemoryError(db: MemoryDb, error: ErrorPayload): void {
  const tx = db.transaction(() => {
    setProjectStateValue(db, "memory_status", "error");
    setProjectStateValue(db, "last_error", writeJson(error));
  });
  tx();
}

function parseStatus(value: string | undefined): MemoryStatus {
  const allowed: MemoryStatus[] = ["not_initialized", "initializing", "fresh", "stale", "dirty", "error"];
  return allowed.includes(value as MemoryStatus) ? (value as MemoryStatus) : "not_initialized";
}

function parseLastError(value: string | undefined): ErrorPayload | null {
  if (!value) {
    return null;
  }
  const parsed = safeJsonParse<ErrorPayload>(value);
  return parsed.ok ? parsed.value : toErrorPayload(new Error(value));
}
