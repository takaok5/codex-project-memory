export function replaceRoutesForFile(db, fileId, routes) {
    db.prepare("DELETE FROM routes WHERE file_id = ?").run(fileId);
    const insert = db.prepare("INSERT INTO routes(file_id, method, path, handler_symbol_id, module_id) VALUES (?, ?, ?, ?, ?)");
    for (const route of routes) {
        insert.run(fileId, route.method, route.path, route.handlerSymbolId ?? null, route.moduleId ?? null);
    }
}
export function listRoutes(db) {
    const rows = db.prepare("SELECT * FROM routes ORDER BY method ASC, path ASC").all();
    return rows.map((row) => ({
        id: row.id,
        fileId: row.file_id,
        method: row.method,
        path: row.path,
        handlerSymbolId: row.handler_symbol_id ?? undefined,
        moduleId: row.module_id ?? undefined
    }));
}
//# sourceMappingURL=route-repository.js.map