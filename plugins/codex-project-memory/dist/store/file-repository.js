import { PmemError } from "../shared/errors.js";
import { safeJsonParse } from "../shared/json.js";
import { assertRelativePosix, normalizePathSeparators } from "../shared/path.js";
export function upsertFileRecord(db, file) {
    const normalizedPath = assertRelativePosix(normalizePathSeparators(file.path));
    if (!file.hash) {
        throw new PmemError("VALIDATION_ERROR", "File hash is required.");
    }
    try {
        db.prepare(`INSERT INTO files(path, language, module_id, hash, size_bytes, line_count, is_test, is_generated, last_indexed_at, analysis_json)
       VALUES (@path, @language, @moduleId, @hash, @sizeBytes, @lineCount, @isTest, @isGenerated, @lastIndexedAt, @analysisJson)
       ON CONFLICT(path) DO UPDATE SET
         language=excluded.language,
         module_id=excluded.module_id,
         hash=excluded.hash,
         size_bytes=excluded.size_bytes,
         line_count=excluded.line_count,
         is_test=excluded.is_test,
         is_generated=excluded.is_generated,
         last_indexed_at=excluded.last_indexed_at,
         analysis_json=excluded.analysis_json`).run({
            path: normalizedPath,
            language: file.language,
            moduleId: file.moduleId,
            hash: file.hash,
            sizeBytes: file.sizeBytes,
            lineCount: file.lineCount,
            isTest: file.isTest ? 1 : 0,
            isGenerated: file.isGenerated ? 1 : 0,
            lastIndexedAt: file.lastIndexedAt,
            analysisJson: JSON.stringify(file.analysis ?? {})
        });
        return db.prepare("SELECT id FROM files WHERE path = ?").get(normalizedPath).id;
    }
    catch (error) {
        throw new PmemError("DB_ERROR", "Project memory database error.", {
            details: { cause: error instanceof Error ? error.message : "unknown" }
        });
    }
}
export function listFiles(db, filter = {}) {
    const clauses = [];
    const params = {};
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
    const rows = db.prepare(`SELECT * FROM files ${where} ORDER BY path ASC ${limit}`).all(params);
    return rows.map(fromRow);
}
export function getFileByPath(db, path) {
    const row = db.prepare("SELECT * FROM files WHERE path = ?").get(assertRelativePosix(normalizePathSeparators(path)));
    return row ? fromRow(row) : null;
}
export function removeFileRecordCascade(db, path) {
    db.prepare("DELETE FROM files WHERE path = ?").run(assertRelativePosix(normalizePathSeparators(path)));
}
function fromRow(row) {
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
        lastIndexedAt: row.last_indexed_at,
        analysis: parseAnalysis(row.analysis_json)
    };
}
function parseAnalysis(value) {
    if (!value)
        return null;
    const parsed = safeJsonParse(value);
    return parsed.ok && parsed.value && typeof parsed.value === "object" ? parsed.value : null;
}
//# sourceMappingURL=file-repository.js.map