export function replaceTestLinksForFile(db, fileId, links) {
    db.prepare("DELETE FROM tests WHERE file_id = ?").run(fileId);
    const insert = db.prepare("INSERT INTO tests(file_id, target_symbol_id, test_kind, summary) VALUES (?, ?, ?, ?)");
    for (const link of links) {
        insert.run(fileId, link.targetSymbolId ?? null, link.testKind, link.summary ?? null);
    }
}
export function listTestLinksForSymbol(db, symbolId) {
    const rows = db.prepare("SELECT * FROM tests WHERE target_symbol_id = ? ORDER BY file_id ASC").all(symbolId);
    return rows.map((row) => ({
        fileId: row.file_id,
        targetSymbolId: row.target_symbol_id ?? undefined,
        testKind: row.test_kind,
        summary: row.summary ?? undefined
    }));
}
//# sourceMappingURL=test-repository.js.map