import { createHash } from "node:crypto";
import { assertRelativePosix, normalizePathSeparators } from "../shared/path.js";
import { nowIso } from "../shared/time.js";
export function replaceDiagnosticsForLanguages(db, languages, diagnostics) {
    if (languages.length > 0) {
        const placeholders = languages.map(() => "?").join(", ");
        db.prepare(`DELETE FROM diagnostics WHERE language IN (${placeholders})`).run(...languages);
    }
    for (const diagnostic of diagnostics) {
        addDiagnostic(db, diagnostic);
    }
}
export function replaceDiagnosticsForFile(db, filePath, diagnostics) {
    const normalizedPath = assertRelativePosix(normalizePathSeparators(filePath));
    db.prepare("DELETE FROM diagnostics WHERE file_path = ?").run(normalizedPath);
    for (const diagnostic of diagnostics) {
        addDiagnostic(db, diagnostic);
    }
}
export function addDiagnostic(db, diagnostic) {
    const normalized = normalizeDiagnostic(db, diagnostic);
    db.prepare(`INSERT OR REPLACE INTO diagnostics(
      file_id, language, file_path, severity, code, message, start_line, end_line, source, tool, confidence, fingerprint, created_at
    )
    VALUES (
      @fileId, @language, @filePath, @severity, @code, @message, @startLine, @endLine, @source, @tool, @confidence, @fingerprint, @createdAt
    )`).run(normalized);
    const row = db.prepare("SELECT id FROM diagnostics WHERE file_path = ? AND tool = ? AND fingerprint = ?").get(normalized.filePath, normalized.tool, normalized.fingerprint);
    return row.id;
}
export function listDiagnostics(db, filter = {}) {
    const clauses = [];
    const params = {};
    if (filter.language) {
        clauses.push("language = @language");
        params.language = filter.language;
    }
    if (filter.filePath) {
        clauses.push("file_path = @filePath");
        params.filePath = assertRelativePosix(normalizePathSeparators(filter.filePath));
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = filter.limit ? `LIMIT ${Math.max(1, filter.limit)}` : "";
    const rows = db
        .prepare(`SELECT id, file_id, language, file_path, severity, code, message, start_line, end_line, source, tool, confidence, fingerprint, created_at
       FROM diagnostics ${where}
       ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, file_path ASC, start_line ASC, message ASC ${limit}`)
        .all(params);
    return rows.map(fromRow);
}
export function diagnosticFingerprint(diagnostic) {
    return createHash("sha256")
        .update([
        diagnostic.language,
        normalizePathSeparators(diagnostic.filePath),
        sanitizeToolName(diagnostic.tool),
        diagnostic.code ?? "",
        diagnostic.startLine ?? "",
        sanitizeDiagnosticMessage(diagnostic.message)
    ].join("\n"))
        .digest("hex");
}
function normalizeDiagnostic(db, diagnostic) {
    const filePath = assertRelativePosix(normalizePathSeparators(diagnostic.filePath));
    const row = db.prepare("SELECT id FROM files WHERE path = ?").get(filePath);
    const startLine = normalizeLine(diagnostic.startLine);
    const endLine = normalizeLine(diagnostic.endLine);
    return {
        fileId: row?.id ?? null,
        language: diagnostic.language,
        filePath,
        severity: diagnostic.severity,
        code: diagnostic.code ? String(diagnostic.code).slice(0, 120) : null,
        message: sanitizeDiagnosticMessage(diagnostic.message),
        startLine,
        endLine: endLine && startLine && endLine < startLine ? startLine : endLine,
        source: diagnostic.source,
        tool: sanitizeToolName(diagnostic.tool),
        confidence: Math.max(0, Math.min(1, diagnostic.confidence)),
        fingerprint: diagnosticFingerprint({ ...diagnostic, filePath }),
        createdAt: nowIso()
    };
}
function normalizeLine(value) {
    if (!value || !Number.isFinite(value))
        return null;
    return Math.max(1, Math.trunc(value));
}
function truncateMessage(value) {
    return value.replace(/\s+/g, " ").trim().slice(0, 500);
}
function sanitizeDiagnosticMessage(value) {
    return truncateMessage(value)
        .replace(/[A-Za-z]:[\\/][^\s'")]+/g, "<path>")
        .replaceAll("\\", "/");
}
function sanitizeToolName(value) {
    const normalized = value.replaceAll("\\", "/");
    return (normalized.split("/").at(-1) ?? normalized).slice(0, 120);
}
function fromRow(row) {
    return {
        id: row.id,
        fileId: row.file_id,
        language: row.language,
        filePath: row.file_path,
        severity: row.severity,
        code: row.code,
        message: row.message,
        startLine: row.start_line,
        endLine: row.end_line,
        source: row.source,
        tool: row.tool,
        confidence: row.confidence,
        fingerprint: row.fingerprint,
        createdAt: row.created_at
    };
}
//# sourceMappingURL=diagnostic-repository.js.map