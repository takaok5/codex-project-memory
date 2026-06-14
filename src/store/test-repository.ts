import type { TestLinkRecord } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";

export function replaceTestLinksForFile(db: MemoryDb, fileId: number, links: TestLinkRecord[]): void {
  db.prepare("DELETE FROM tests WHERE file_id = ?").run(fileId);
  const insert = db.prepare("INSERT INTO tests(file_id, target_symbol_id, test_kind, summary) VALUES (?, ?, ?, ?)");
  for (const link of links) {
    insert.run(fileId, link.targetSymbolId ?? null, link.testKind, link.summary ?? null);
  }
}

export function listTestLinksForSymbol(db: MemoryDb, symbolId: number): TestLinkRecord[] {
  const rows = db.prepare("SELECT * FROM tests WHERE target_symbol_id = ? ORDER BY file_id ASC").all(symbolId) as Array<{
    file_id: number;
    target_symbol_id: number | null;
    test_kind: "unit" | "integration" | "e2e" | "unknown";
    summary: string | null;
  }>;
  return rows.map((row) => ({
    fileId: row.file_id,
    targetSymbolId: row.target_symbol_id ?? undefined,
    testKind: row.test_kind,
    summary: row.summary ?? undefined
  }));
}
