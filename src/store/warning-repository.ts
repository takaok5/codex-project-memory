import { createHash } from "node:crypto";
import { nowIso } from "../shared/time.js";
import type { WarningRecord, WarningRecordInput, WarningSource } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";

export function replaceWarningsForFile(db: MemoryDb, fileId: number, source: WarningSource, warnings: WarningRecordInput[]): void {
  db.prepare("UPDATE warnings SET resolved_at = ? WHERE file_id = ? AND source = ? AND resolved_at IS NULL").run(nowIso(), fileId, source);
  for (const warning of warnings) {
    addWarning(db, { ...warning, fileId, source });
  }
}

export function resolveWarningsForFile(db: MemoryDb, fileId: number, source?: WarningSource): void {
  if (source) {
    db.prepare("UPDATE warnings SET resolved_at = ? WHERE file_id = ? AND source = ? AND resolved_at IS NULL").run(nowIso(), fileId, source);
  } else {
    db.prepare("UPDATE warnings SET resolved_at = ? WHERE file_id = ? AND resolved_at IS NULL").run(nowIso(), fileId);
  }
}

export function addWarning(db: MemoryDb, warning: WarningRecordInput): number {
  const fingerprint = warningFingerprint(warning);
  const now = nowIso();
  db.prepare(
    `INSERT OR IGNORE INTO warnings(warning_type, severity, module_id, file_id, symbol_id, message, recommendation, source, confidence, fingerprint, created_at, resolved_at)
     VALUES (@warningType, @severity, @moduleId, @fileId, @symbolId, @message, @recommendation, @source, @confidence, @fingerprint, @createdAt, NULL)`
  ).run({
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
  const row = db.prepare("SELECT id FROM warnings WHERE source = ? AND fingerprint = ? AND resolved_at IS NULL ORDER BY id DESC LIMIT 1").get(warning.source, fingerprint) as { id: number };
  return row.id;
}

export function listActiveWarnings(db: MemoryDb, limit?: number): WarningRecord[] {
  const rows = db.prepare(`SELECT * FROM warnings WHERE resolved_at IS NULL ORDER BY severity DESC, created_at ASC, id ASC ${limit ? `LIMIT ${Math.max(1, limit)}` : ""}`).all() as WarningRow[];
  return rows.map(fromRow);
}

export function warningFingerprint(warning: WarningRecordInput): string {
  return createHash("sha256")
    .update([warning.warningType, warning.source, warning.moduleId ?? "", warning.fileId ?? "", warning.symbolId ?? "", warning.message].join("\n"))
    .digest("hex");
}

interface WarningRow {
  id: number;
  warning_type: string;
  severity: "info" | "warning" | "critical";
  module_id: string | null;
  file_id: number | null;
  symbol_id: number | null;
  message: string;
  recommendation: string | null;
  source: WarningSource;
  confidence: number;
  created_at: string;
  resolved_at: string | null;
}

function fromRow(row: WarningRow): WarningRecord {
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
