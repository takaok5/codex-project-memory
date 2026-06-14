import { PmemError } from "../shared/errors.js";
import { assertRelativePosix, normalizePathSeparators } from "../shared/path.js";
import type { FileFilter, IndexedFileRecord } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";

export function upsertFileRecord(db: MemoryDb, file: IndexedFileRecord): number {
  const normalizedPath = assertRelativePosix(normalizePathSeparators(file.path));
  if (!file.hash) {
    throw new PmemError("VALIDATION_ERROR", "File hash is required.");
  }
  try {
    db.prepare(
      `INSERT INTO files(path, language, module_id, hash, size_bytes, line_count, is_test, is_generated, last_indexed_at)
       VALUES (@path, @language, @moduleId, @hash, @sizeBytes, @lineCount, @isTest, @isGenerated, @lastIndexedAt)
       ON CONFLICT(path) DO UPDATE SET
         language=excluded.language,
         module_id=excluded.module_id,
         hash=excluded.hash,
         size_bytes=excluded.size_bytes,
         line_count=excluded.line_count,
         is_test=excluded.is_test,
         is_generated=excluded.is_generated,
         last_indexed_at=excluded.last_indexed_at`
    ).run({
      path: normalizedPath,
      language: file.language,
      moduleId: file.moduleId,
      hash: file.hash,
      sizeBytes: file.sizeBytes,
      lineCount: file.lineCount,
      isTest: file.isTest ? 1 : 0,
      isGenerated: file.isGenerated ? 1 : 0,
      lastIndexedAt: file.lastIndexedAt
    });
    return (db.prepare("SELECT id FROM files WHERE path = ?").get(normalizedPath) as { id: number }).id;
  } catch (error) {
    throw new PmemError("DB_ERROR", "Project memory database error.", {
      details: { cause: error instanceof Error ? error.message : "unknown" }
    });
  }
}

export function listFiles(db: MemoryDb, filter: FileFilter = {}): IndexedFileRecord[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.moduleId) {
    clauses.push("module_id = @moduleId");
    params.moduleId = filter.moduleId;
  }
  if (filter.language) {
    clauses.push("language = @language");
    params.language = filter.language;
  }
  if (filter.isTest !== undefined) {
    clauses.push("is_test = @isTest");
    params.isTest = filter.isTest ? 1 : 0;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ? `LIMIT ${Math.max(1, filter.limit)}` : "";
  const rows = db.prepare(`SELECT * FROM files ${where} ORDER BY path ASC ${limit}`).all(params) as DbFileRow[];
  return rows.map(fromRow);
}

export function getFileByPath(db: MemoryDb, path: string): IndexedFileRecord | null {
  const row = db.prepare("SELECT * FROM files WHERE path = ?").get(assertRelativePosix(normalizePathSeparators(path))) as DbFileRow | undefined;
  return row ? fromRow(row) : null;
}

export function removeFileRecordCascade(db: MemoryDb, path: string): void {
  db.prepare("DELETE FROM files WHERE path = ?").run(assertRelativePosix(normalizePathSeparators(path)));
}

interface DbFileRow {
  id: number;
  path: string;
  language: "typescript" | "javascript" | null;
  module_id: string | null;
  hash: string;
  size_bytes: number;
  line_count: number;
  is_test: number;
  is_generated: number;
  last_indexed_at: string;
}

function fromRow(row: DbFileRow): IndexedFileRecord {
  return {
    id: row.id,
    path: row.path,
    language: row.language,
    moduleId: row.module_id,
    hash: row.hash,
    sizeBytes: row.size_bytes,
    lineCount: row.line_count,
    isTest: row.is_test === 1,
    isGenerated: row.is_generated === 1,
    lastIndexedAt: row.last_indexed_at
  };
}
