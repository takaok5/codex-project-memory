import { nowIso } from "../shared/time.js";
import type { ArtifactKind, DuplicateCandidate } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";

export interface DuplicateCandidateRecord {
  kind: ArtifactKind;
  leftFileId?: number;
  rightFileId?: number;
  leftSymbolId?: number;
  rightSymbolId?: number;
  similarity: number;
  reason: string;
}

export function replaceDuplicateCandidates(db: MemoryDb, candidates: DuplicateCandidateRecord[]): void {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM duplicate_candidates").run();
    const insert = db.prepare(
      `INSERT INTO duplicate_candidates(kind, left_symbol_id, right_symbol_id, left_file_id, right_file_id, similarity, reason, created_at)
       VALUES (@kind, @leftSymbolId, @rightSymbolId, @leftFileId, @rightFileId, @similarity, @reason, @createdAt)`
    );
    for (const candidate of candidates) {
      insert.run({
        kind: candidate.kind,
        leftSymbolId: candidate.leftSymbolId ?? null,
        rightSymbolId: candidate.rightSymbolId ?? candidate.leftSymbolId ?? null,
        leftFileId: candidate.leftFileId ?? null,
        rightFileId: candidate.rightFileId ?? candidate.leftFileId ?? null,
        similarity: clamp01(candidate.similarity),
        reason: candidate.reason,
        createdAt: nowIso()
      });
    }
  });
  tx();
}

export function listDuplicateCandidates(db: MemoryDb, limit = 20): DuplicateCandidate[] {
  return (
    db
      .prepare(
        `SELECT d.kind, d.left_symbol_id, d.left_file_id, d.similarity, d.reason, s.name, s.fq_name, f.path AS file_path, f.module_id
         FROM duplicate_candidates d
         LEFT JOIN symbols s ON s.id = d.left_symbol_id
         LEFT JOIN files f ON f.id = COALESCE(d.left_file_id, s.file_id)
         ORDER BY d.similarity DESC, COALESCE(f.path, '') ASC, COALESCE(s.name, '') ASC
         LIMIT ?`
      )
      .all(Math.max(1, limit)) as DuplicateRow[]
  ).map((row) => ({
    kind: row.kind as ArtifactKind,
    symbolId: row.left_symbol_id ?? undefined,
    fileId: row.left_file_id ?? undefined,
    name: row.name ?? row.file_path ?? "candidate",
    fqName: row.fq_name ?? undefined,
    filePath: row.file_path ?? undefined,
    moduleId: row.module_id ?? undefined,
    similarity: row.similarity,
    reason: row.reason ?? "candidate"
  }));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

interface DuplicateRow {
  kind: string;
  left_symbol_id: number | null;
  left_file_id: number | null;
  similarity: number;
  reason: string | null;
  name: string | null;
  fq_name: string | null;
  file_path: string | null;
  module_id: string | null;
}
