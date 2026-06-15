export function replaceSymbolsForFile(db, fileId, symbols) {
    const insert = db.prepare(`INSERT INTO symbols(file_id, fq_name, name, kind, exported, start_line, end_line, signature, signature_hash, body_hash, summary)
     VALUES (@fileId, @fqName, @name, @kind, @exported, @startLine, @endLine, @signature, @signatureHash, @bodyHash, @summary)`);
    const uniqueSymbols = dedupeSymbols(fileId, symbols);
    db.transaction(() => {
        db.prepare("DELETE FROM symbols WHERE file_id = ?").run(fileId);
        for (const symbol of uniqueSymbols) {
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
    })();
}
function dedupeSymbols(fileId, symbols) {
    const byKey = new Map();
    for (const symbol of symbols) {
        const normalized = normalizeSymbol(fileId, symbol);
        const key = `${normalized.fqName}\0${normalized.kind}`;
        const existing = byKey.get(key);
        byKey.set(key, existing ? mergeDuplicateSymbol(existing, normalized) : normalized);
    }
    return [...byKey.values()].sort((a, b) => `${a.fqName}\0${a.kind}`.localeCompare(`${b.fqName}\0${b.kind}`));
}
function normalizeSymbol(fileId, symbol) {
    const startLine = symbol.startLine;
    const endLine = symbol.endLine && startLine && symbol.endLine < startLine ? startLine : symbol.endLine;
    return { ...symbol, fileId, startLine, endLine };
}
function mergeDuplicateSymbol(left, right) {
    const representative = preferredSymbol(left, right);
    const startLine = minDefined(left.startLine, right.startLine);
    const endLine = maxDefined(left.endLine, right.endLine);
    return {
        ...representative,
        exported: left.exported || right.exported,
        startLine,
        endLine: endLine && startLine && endLine < startLine ? startLine : endLine,
        signature: representative.signature ?? left.signature ?? right.signature,
        signatureHash: representative.signatureHash ?? left.signatureHash ?? right.signatureHash,
        bodyHash: representative.bodyHash ?? left.bodyHash ?? right.bodyHash,
        summary: left.summary ?? right.summary
    };
}
function preferredSymbol(left, right) {
    const leftSpan = span(left);
    const rightSpan = span(right);
    if (right.exported && !left.exported)
        return right;
    if (rightSpan > leftSpan)
        return right;
    if (leftSpan > rightSpan)
        return left;
    if ((right.startLine ?? Number.MAX_SAFE_INTEGER) < (left.startLine ?? Number.MAX_SAFE_INTEGER))
        return right;
    return left;
}
function span(symbol) {
    if (!symbol.startLine || !symbol.endLine)
        return 0;
    return symbol.endLine - symbol.startLine;
}
function minDefined(left, right) {
    if (left === undefined)
        return right;
    if (right === undefined)
        return left;
    return Math.min(left, right);
}
function maxDefined(left, right) {
    if (left === undefined)
        return right;
    if (right === undefined)
        return left;
    return Math.max(left, right);
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