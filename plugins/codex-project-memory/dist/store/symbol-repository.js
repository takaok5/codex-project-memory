export function replaceSymbolsForFile(db, fileId, symbols) {
    db.prepare("DELETE FROM symbols WHERE file_id = ?").run(fileId);
    const insert = db.prepare(`INSERT INTO symbols(file_id, fq_name, name, kind, exported, start_line, end_line, signature, signature_hash, body_hash, summary)
     VALUES (@fileId, @fqName, @name, @kind, @exported, @startLine, @endLine, @signature, @signatureHash, @bodyHash, @summary)`);
    for (const symbol of symbols) {
        insert.run({
            fileId,
            fqName: symbol.fqName,
            name: symbol.name,
            kind: symbol.kind,
            exported: symbol.exported ? 1 : 0,
            startLine: symbol.startLine ?? null,
            endLine: symbol.endLine ?? null,
            signature: symbol.signature ?? null,
            signatureHash: symbol.signatureHash ?? null,
            bodyHash: symbol.bodyHash ?? null,
            summary: symbol.summary ?? null
        });
    }
}
export function searchSymbols(db, query) {
    const clauses = [];
    const params = {};
    if (query.query) {
        clauses.push("(s.name LIKE @query OR s.fq_name LIKE @query)");
        params.query = `%${query.query}%`;
    }
    if (query.moduleId) {
        clauses.push("f.module_id = @moduleId");
        params.moduleId = query.moduleId;
    }
    if (query.filePath) {
        clauses.push("f.path = @filePath");
        params.filePath = query.filePath;
    }
    if (query.kind) {
        clauses.push("s.kind = @kind");
        params.kind = query.kind;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = query.limit ? `LIMIT ${Math.max(1, query.limit)}` : "";
    const rows = db.prepare(`SELECT s.* FROM symbols s JOIN files f ON f.id = s.file_id ${where} ORDER BY s.fq_name ASC, s.id ASC ${limit}`).all(params);
    return rows.map(fromRow);
}
export function getSymbolById(db, id) {
    const row = db.prepare("SELECT * FROM symbols WHERE id = ?").get(id);
    return row ? fromRow(row) : null;
}
export function getSymbolByFileAndName(db, fileId, name) {
    const row = db.prepare("SELECT * FROM symbols WHERE file_id = ? AND (name = ? OR fq_name = ?) ORDER BY kind ASC LIMIT 1").get(fileId, name, name);
    return row ? fromRow(row) : null;
}
function fromRow(row) {
    return {
        id: row.id,
        fileId: row.file_id,
        fqName: row.fq_name,
        name: row.name,
        kind: row.kind,
        exported: row.exported === 1,
        startLine: row.start_line ?? undefined,
        endLine: row.end_line ?? undefined,
        signature: row.signature ?? undefined,
        signatureHash: row.signature_hash ?? undefined,
        bodyHash: row.body_hash ?? undefined,
        summary: row.summary ?? undefined
    };
}
//# sourceMappingURL=symbol-repository.js.map