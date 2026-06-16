import { createHash } from "node:crypto";
import { canonicalJsonHash, writeJson } from "../shared/json.js";
import { assertRelativePosix, normalizePathSeparators } from "../shared/path.js";
import { nowIso } from "../shared/time.js";
export function addRuntimeEvidenceRun(db, input) {
    const now = nowIso();
    const normalized = {
        kind: input.kind,
        command: sanitizeText(sanitizeSource(input.command), 240),
        status: input.status,
        exitCode: input.exitCode,
        durationMs: Math.max(0, Math.trunc(input.durationMs)),
        outputSummary: sanitizeText(input.outputSummary, 500),
        createdAt: now
    };
    const result = db
        .prepare(`INSERT INTO runtime_evidence_runs(kind, command, status, exit_code, duration_ms, output_summary, created_at)
       VALUES (@kind, @command, @status, @exitCode, @durationMs, @outputSummary, @createdAt)`)
        .run(normalized);
    const runId = Number(result.lastInsertRowid);
    const itemIds = input.items.map((item) => addRuntimeEvidenceItem(db, runId, item, now));
    addEvidenceRecord(db, {
        kind: "runtime",
        source: `runtime:${runId}`,
        summary: `${normalized.kind} ${normalized.status}: ${normalized.outputSummary}`,
        runtimeRunId: runId,
        confidence: normalized.status === "passed" ? 0.8 : 0.9,
        score: normalized.status === "passed" ? 50 : 85,
        metadata: { kind: normalized.kind, status: normalized.status }
    });
    return { runId, itemIds };
}
export function listRuntimeEvidenceRuns(db, limit = 20) {
    return db
        .prepare(`SELECT id, kind, command, status, exit_code, duration_ms, output_summary, created_at
         FROM runtime_evidence_runs
         ORDER BY created_at DESC, id DESC
         LIMIT ?`)
        .all(Math.max(1, limit)).map(runtimeRunFromRow);
}
export function listRuntimeEvidenceItems(db, filter = {}) {
    const clauses = [];
    const params = {};
    if (filter.filePath) {
        clauses.push("file_path = @filePath");
        params.filePath = normalizeOptionalPath(filter.filePath);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.max(1, filter.limit ?? 50);
    return db
        .prepare(`SELECT id, run_id, kind, file_path, severity, message, start_line, end_line, fingerprint, created_at
         FROM runtime_evidence_items ${where}
         ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC, id DESC
         LIMIT ${limit}`)
        .all(params).map(runtimeItemFromRow);
}
export function addEvidenceRecord(db, input) {
    const now = nowIso();
    const params = normalizeEvidenceRecord(db, input, now);
    const result = db
        .prepare(`INSERT INTO evidence_records(
        kind, source, summary, file_path, symbol_fq_name, module_id, runtime_run_id, architecture_decision_id,
        confidence, score, status, stale_reason, metadata_json, created_at, updated_at
      )
      VALUES (
        @kind, @source, @summary, @filePath, @symbolFqName, @moduleId, @runtimeRunId, @architectureDecisionId,
        @confidence, @score, @status, @staleReason, @metadataJson, @createdAt, @updatedAt
      )`)
        .run(params);
    return Number(result.lastInsertRowid);
}
export function addEvidenceRecords(db, records) {
    return records.map((record) => addEvidenceRecord(db, record));
}
export function listEvidenceRecords(db, filter = {}) {
    const clauses = [];
    const params = {};
    if (filter.status) {
        clauses.push("status = @status");
        params.status = filter.status;
    }
    if (filter.kind) {
        clauses.push("kind = @kind");
        params.kind = filter.kind;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.max(1, filter.limit ?? 50);
    return db
        .prepare(`SELECT id, kind, source, summary, file_path, symbol_fq_name, module_id, runtime_run_id, architecture_decision_id,
                confidence, score, status, stale_reason, metadata_json, created_at, updated_at
         FROM evidence_records ${where}
         ORDER BY updated_at DESC, id DESC
         LIMIT ${limit}`)
        .all(params).map(evidenceFromRow);
}
export function markEvidenceStaleForRemovedFiles(db, filePaths, reason) {
    const normalized = [...new Set(filePaths.map(normalizeOptionalPath).filter((value) => Boolean(value)))];
    if (normalized.length === 0)
        return 0;
    const placeholders = normalized.map(() => "?").join(", ");
    const result = db
        .prepare(`UPDATE evidence_records SET status = 'stale', stale_reason = ?, updated_at = ? WHERE file_path IN (${placeholders}) AND status = 'active'`)
        .run(sanitizeText(reason, 240), nowIso(), ...normalized);
    return Number(result.changes);
}
export function upsertArchitectureDecision(db, input) {
    const now = nowIso();
    const params = {
        title: sanitizeText(input.title, 160),
        summary: sanitizeText(input.summary, 500),
        rationale: sanitizeText(input.rationale, 800),
        status: input.status ?? "active",
        moduleId: existingModuleId(db, input.moduleId),
        filePath: normalizeOptionalPath(input.filePath),
        symbolFqName: input.symbolFqName ? sanitizeText(input.symbolFqName, 240) : null,
        updatedAt: now,
        createdAt: now
    };
    db.prepare(`INSERT INTO architecture_decisions(title, summary, rationale, status, module_id, file_path, symbol_fq_name, created_at, updated_at)
     VALUES (@title, @summary, @rationale, @status, @moduleId, @filePath, @symbolFqName, @createdAt, @updatedAt)
     ON CONFLICT(title) DO UPDATE SET
       summary = excluded.summary,
       rationale = excluded.rationale,
       status = excluded.status,
       module_id = excluded.module_id,
       file_path = excluded.file_path,
       symbol_fq_name = excluded.symbol_fq_name,
       updated_at = excluded.updated_at`).run(params);
    const row = db.prepare("SELECT id FROM architecture_decisions WHERE title = ?").get(params.title);
    const evidenceId = addEvidenceRecord(db, {
        kind: "decision",
        source: "architecture_decision",
        summary: `${params.title}: ${params.summary}`,
        filePath: params.filePath,
        symbolFqName: params.symbolFqName,
        moduleId: params.moduleId,
        architectureDecisionId: row.id,
        confidence: 0.95,
        score: 90,
        status: params.status,
        metadata: { title: params.title }
    });
    db.prepare("UPDATE architecture_decisions SET invalidated_by_evidence_id = NULL WHERE id = ? AND status = 'active'").run(row.id);
    db.prepare("UPDATE evidence_records SET architecture_decision_id = ? WHERE id = ?").run(row.id, evidenceId);
    return row.id;
}
export function listArchitectureDecisions(db, filter = {}) {
    const clauses = [];
    const params = {};
    if (filter.status) {
        clauses.push("status = @status");
        params.status = filter.status;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.max(1, filter.limit ?? 50);
    return db
        .prepare(`SELECT id, title, summary, rationale, status, module_id, file_path, symbol_fq_name, superseded_by_id, invalidated_by_evidence_id, created_at, updated_at
         FROM architecture_decisions ${where}
         ORDER BY updated_at DESC, id DESC
         LIMIT ${limit}`)
        .all(params).map(decisionFromRow);
}
export function getArchitectureDecision(db, idOrTitle) {
    const row = typeof idOrTitle === "number"
        ? db
            .prepare(`SELECT id, title, summary, rationale, status, module_id, file_path, symbol_fq_name, superseded_by_id, invalidated_by_evidence_id, created_at, updated_at
             FROM architecture_decisions WHERE id = ?`)
            .get(idOrTitle)
        : db
            .prepare(`SELECT id, title, summary, rationale, status, module_id, file_path, symbol_fq_name, superseded_by_id, invalidated_by_evidence_id, created_at, updated_at
             FROM architecture_decisions WHERE title = ?`)
            .get(sanitizeText(idOrTitle, 160));
    return row ? decisionFromRow(row) : null;
}
export function setArchitectureDecisionStatus(db, id, status, reason) {
    const evidenceId = addEvidenceRecord(db, {
        kind: "decision",
        source: "architecture_decision",
        summary: sanitizeText(reason, 500),
        architectureDecisionId: id,
        confidence: status === "active" ? 0.8 : 0.95,
        score: status === "contradicted" ? 100 : status === "stale" ? 80 : 60,
        status,
        staleReason: status === "active" ? null : reason,
        metadata: { status }
    });
    db.prepare(`UPDATE architecture_decisions
     SET status = ?, invalidated_by_evidence_id = ?, updated_at = ?
     WHERE id = ?`).run(status, status === "active" ? null : evidenceId, nowIso(), id);
    return evidenceId;
}
export function addEvidenceFeedback(db, input) {
    const params = {
        evidenceId: input.evidenceId ?? null,
        evidenceKey: sanitizeText(input.evidenceKey, 240),
        signal: input.signal,
        weight: clampNumber(input.weight ?? defaultFeedbackWeight(input.signal), -10, 10),
        intent: `sha256:${hashParts([input.intent.trim()])}`,
        source: sanitizeSource(input.source),
        createdAt: nowIso()
    };
    const result = db
        .prepare(`INSERT INTO evidence_feedback(evidence_id, evidence_key, signal, weight, intent, source, created_at)
       VALUES (@evidenceId, @evidenceKey, @signal, @weight, @intent, @source, @createdAt)`)
        .run(params);
    return Number(result.lastInsertRowid);
}
export function listEvidenceFeedback(db, limit = 50) {
    return db
        .prepare(`SELECT id, evidence_id, evidence_key, signal, weight, intent, source, created_at
         FROM evidence_feedback
         ORDER BY created_at DESC, id DESC
         LIMIT ?`)
        .all(Math.max(1, limit)).map(feedbackFromRow);
}
export function getEvidenceFeedbackScores(db) {
    const rows = db.prepare("SELECT evidence_key, SUM(weight) AS score FROM evidence_feedback GROUP BY evidence_key").all();
    return new Map(rows.map((row) => [row.evidence_key, Number(row.score)]));
}
export function evidenceRecordFingerprint(input) {
    return canonicalJsonHash({
        kind: input.kind,
        source: sanitizeSource(input.source),
        summary: sanitizeText(input.summary, 500),
        filePath: normalizeOptionalPath(input.filePath),
        symbolFqName: input.symbolFqName ?? null,
        moduleId: input.moduleId ?? null,
        metadata: input.metadata ?? {}
    });
}
function addRuntimeEvidenceItem(db, runId, input, createdAt) {
    const params = normalizeRuntimeItem(runId, input, createdAt);
    const result = db
        .prepare(`INSERT INTO runtime_evidence_items(run_id, kind, file_path, severity, message, start_line, end_line, fingerprint, created_at)
       VALUES (@runId, @kind, @filePath, @severity, @message, @startLine, @endLine, @fingerprint, @createdAt)`)
        .run(params);
    addEvidenceRecord(db, {
        kind: input.kind === "diagnostic" ? "diagnostic" : "runtime",
        source: `runtime:${runId}`,
        summary: params.message,
        filePath: params.filePath,
        runtimeRunId: runId,
        confidence: params.severity === "error" ? 0.9 : 0.75,
        score: params.severity === "error" ? 90 : params.severity === "warning" ? 70 : 45,
        metadata: { itemKind: params.kind, severity: params.severity }
    });
    return Number(result.lastInsertRowid);
}
function normalizeEvidenceRecord(db, input, now) {
    return {
        kind: input.kind,
        source: sanitizeSource(input.source),
        summary: sanitizeText(input.summary, 500),
        filePath: normalizeOptionalPath(input.filePath),
        symbolFqName: input.symbolFqName ? sanitizeText(input.symbolFqName, 240) : null,
        moduleId: existingModuleId(db, input.moduleId),
        runtimeRunId: input.runtimeRunId ?? null,
        architectureDecisionId: input.architectureDecisionId ?? null,
        confidence: clampNumber(input.confidence, 0, 1),
        score: Math.max(0, input.score),
        status: input.status ?? "active",
        staleReason: input.staleReason ? sanitizeText(input.staleReason, 240) : null,
        metadataJson: writeJson(input.metadata ?? {}),
        createdAt: now,
        updatedAt: now
    };
}
function normalizeRuntimeItem(runId, input, createdAt) {
    const filePath = normalizeOptionalPath(input.filePath);
    const startLine = normalizeLine(input.startLine);
    const endLine = normalizeLine(input.endLine);
    const message = sanitizeText(input.message, 500);
    return {
        runId,
        kind: input.kind,
        filePath,
        severity: input.severity,
        message,
        startLine,
        endLine: endLine && startLine && endLine < startLine ? startLine : endLine,
        fingerprint: hashParts([String(runId), input.kind, filePath ?? "", input.severity, message, String(startLine ?? "")]),
        createdAt
    };
}
function sanitizeSource(value) {
    const normalized = sanitizeText(value, 240).replace(/[A-Za-z]:[\\/][^\s'")]+/g, "<path>").replaceAll("\\", "/");
    if (normalized.includes("/") && !normalized.startsWith("runtime:")) {
        return assertRelativePosix(normalized);
    }
    return normalized;
}
function normalizeOptionalPath(value) {
    if (!value)
        return null;
    return assertRelativePosix(normalizePathSeparators(value));
}
function existingModuleId(db, value) {
    if (!value)
        return null;
    const row = db.prepare("SELECT id FROM modules WHERE id = ?").get(value);
    return row?.id ?? null;
}
function sanitizeText(value, maxLength) {
    const normalized = value.replace(/\s+/g, " ").replace(/[A-Za-z]:[\\/][^\s'")]+/g, "<path>").replaceAll("\\", "/").trim();
    return normalized.length <= maxLength ? normalized : `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}
function normalizeLine(value) {
    if (!value || !Number.isFinite(value))
        return null;
    return Math.max(1, Math.trunc(value));
}
function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
function defaultFeedbackWeight(signal) {
    if (signal === "useful" || signal === "accepted" || signal === "opened")
        return 1;
    if (signal === "not_useful" || signal === "rejected")
        return -1;
    return 0;
}
function hashParts(parts) {
    return createHash("sha256").update(parts.join("\n")).digest("hex");
}
function runtimeRunFromRow(row) {
    return {
        id: row.id,
        kind: row.kind,
        command: row.command,
        status: row.status,
        exitCode: row.exit_code,
        durationMs: row.duration_ms,
        outputSummary: row.output_summary,
        createdAt: row.created_at
    };
}
function runtimeItemFromRow(row) {
    return {
        id: row.id,
        runId: row.run_id,
        kind: row.kind,
        filePath: row.file_path,
        severity: row.severity,
        message: row.message,
        startLine: row.start_line,
        endLine: row.end_line,
        fingerprint: row.fingerprint,
        createdAt: row.created_at
    };
}
function evidenceFromRow(row) {
    return {
        id: row.id,
        kind: row.kind,
        source: row.source,
        summary: row.summary,
        filePath: row.file_path,
        symbolFqName: row.symbol_fq_name,
        moduleId: row.module_id,
        runtimeRunId: row.runtime_run_id,
        architectureDecisionId: row.architecture_decision_id,
        confidence: row.confidence,
        score: row.score,
        status: row.status,
        staleReason: row.stale_reason,
        metadata: safeMetadata(row.metadata_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
function decisionFromRow(row) {
    return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        rationale: row.rationale,
        status: row.status,
        moduleId: row.module_id,
        filePath: row.file_path,
        symbolFqName: row.symbol_fq_name,
        supersededById: row.superseded_by_id,
        invalidatedByEvidenceId: row.invalidated_by_evidence_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
function feedbackFromRow(row) {
    return {
        id: row.id,
        evidenceId: row.evidence_id,
        evidenceKey: row.evidence_key,
        signal: row.signal,
        weight: row.weight,
        intent: row.intent,
        source: row.source,
        createdAt: row.created_at
    };
}
function safeMetadata(text) {
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}
//# sourceMappingURL=evidence-repository.js.map