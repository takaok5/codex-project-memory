import { PmemError } from "../shared/errors.js";
import type { ResolvedSymbolEdgeInput, SymbolEdgeRecord } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";

export function replaceEdgesForFile(db: MemoryDb, fileId: number, edges: ResolvedSymbolEdgeInput[]): void {
  db.prepare("DELETE FROM symbol_edges WHERE source_file_id = ?").run(fileId);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO symbol_edges(source_file_id, from_symbol_id, to_symbol_id, edge_kind, confidence)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const edge of edges) {
    if (!edge.fromSymbolId || !edge.toSymbolId) {
      throw new PmemError("VALIDATION_ERROR", "Resolved symbol edge requires from/to ids.");
    }
    insert.run(fileId, edge.fromSymbolId, edge.toSymbolId, edge.edgeKind, edge.confidence);
  }
}

export function listEdgesForGraph(db: MemoryDb): SymbolEdgeRecord[] {
  const rows = db.prepare("SELECT * FROM symbol_edges ORDER BY source_file_id, from_symbol_id, to_symbol_id, edge_kind").all() as Array<{
    id: number;
    source_file_id: number;
    from_symbol_id: number;
    to_symbol_id: number;
    edge_kind: "import" | "export" | "dependency";
    confidence: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    sourceFileId: row.source_file_id,
    fromSymbolId: row.from_symbol_id,
    toSymbolId: row.to_symbol_id,
    edgeKind: row.edge_kind,
    confidence: row.confidence
  }));
}
