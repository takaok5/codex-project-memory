import { createHash } from "node:crypto";
import { nowIso } from "../shared/time.js";
export function replaceWarningsForFile(db, fileId, source, warnings) {
    db.prepare("UPDATE warnings SET resolved_at = ? WHERE file_id = ? AND source = ? AND resolved_at IS NULL").run(nowIso(), fileId, source);
    for (const warning of warnings) {
        addWarning(db, { ...warning, fileId, source });
    }
}
export function resolveWarningsForFile(db, fileId, source) {
    if (source) {
        db.prepare("UPDATE warnings SET resolved_at = ? WHERE file_id = ? AND source = ? AND resolved_at IS NULL").run(nowIso(), fileId, source);
    }
    else {
        db.prepare("UPDATE warnings SET resolved_at = ? WHERE file_id = ? AND resolved_at IS NULL").run(nowIso(), fileId);
    }
}
export function addWarning(db, warning) {
    const fingerprint = warningFingerprint(warning);
    const now = nowIso();
    db.prepare(`INSERT OR IGNORE INTO warnings(warning_type, severity, module_id, file_id, symbol_id, message, recommendation, source, confidence, fingerprint, created_at, resolved_at)
     VALUES (@warningType, @severity, @moduleId, @fileId, @symbolId, @message, @recommendation, @source, @confidence, @fingerprint, @createdAt, NULL)`).run({
        warningType: warning.warningType,
        severity: warning.severity,
        moduleId: warning.moduleId ?? null,
        fileId: warning.fileId ?? null,
        symbolId: warning.symbolId ?? null,
        message: warning.message,
        recommendation: warning.recommendation ?? null,
        source: warning.source,
        confidence: warning.confidence,
        fingerprint,
        createdAt: now
    });
    const row = db.prepare("SELECT id FROM warnings WHERE source = ? AND fingerprint = ? AND resolved_at IS NULL ORDER BY id DESC LIMIT 1").get(warning.source, fingerprint);
    return row.id;
}
export function listActiveWarnings(db, limit) {
    const rows = db.prepare(`SELECT * FROM warnings WHERE resolved_at IS NULL ORDER BY severity DESC, created_at ASC, id ASC ${limit ? `LIMIT ${Math.max(1, limit)}` : ""}`).all();
    return rows.map(fromRow);
}
export function warningFingerprint(warning) {
    return createHash("sha256")
        .update([warning.warningType, warning.source, warning.moduleId ?? "", warning.fileId ?? "", warning.symbolId ?? "", warning.message].join("\n"))
        .digest("hex");
}
function fromRow(row) {
    return {
        id: row.id,
        warningType: row.warning_type,
        severity: row.severity,
        moduleId: row.module_id ?? undefined,
        fileId: row.file_id ?? undefined,
        symbolId: row.symbol_id ?? undefined,
        message: row.message,
        recommendation: row.recommendation ?? undefined,
        source: row.source,
        confidence: row.confidence,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at
    };
}
//# sourceMappingURL=warning-repository.js.map