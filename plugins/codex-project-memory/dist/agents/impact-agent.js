export function runImpactAgent(ctx, input) {
    const db = ctx.db;
    const files = impactedFiles(input);
    const symbols = impactedSymbols(input);
    const tests = relevantTests(db, files.map((file) => file.path));
    const diagnostics = relevantDiagnostics(db, files.map((file) => file.path));
    const risks = [
        ...duplicateRisks(input.duplicates),
        ...diagnosticRisks(diagnostics),
        ...diffRisks(input.diff)
    ].slice(0, 10);
    const contracts = impactedContracts(db, files.map((file) => file.path));
    const blastRadius = classifyBlastRadius(files.length, symbols.length, tests.length, risks.length);
    return {
        summary: impactSummary(blastRadius, files.length, tests.length, risks.length),
        blastRadius,
        files: files.slice(0, 12),
        symbols: symbols.slice(0, 12),
        tests: tests.slice(0, 8),
        diagnostics: diagnostics.slice(0, 8),
        risks,
        contracts
    };
}
function impactedFiles(input) {
    const byPath = new Map();
    for (const file of input.query?.contextPack.files ?? []) {
        upsertFile(byPath, file.path, file.reason, file.score);
    }
    for (const symbol of input.query?.contextPack.symbols ?? []) {
        upsertFile(byPath, symbol.filePath, `symbol ${symbol.fqName}`, symbol.score);
    }
    for (const match of input.duplicates?.matches ?? []) {
        if (match.filePath)
            upsertFile(byPath, match.filePath, `duplicate candidate ${match.name}`, Math.round(match.similarity * 100));
    }
    for (const file of [...(input.diff?.changedFiles ?? []), ...(input.diff?.addedFiles ?? []), ...(input.diff?.removedFiles ?? [])]) {
        upsertFile(byPath, file, "snapshot diff", 80);
    }
    return [...byPath.values()].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}
function upsertFile(map, path, reason, score) {
    const existing = map.get(path);
    if (!existing || score > existing.score) {
        map.set(path, { path, reason, score });
    }
}
function impactedSymbols(input) {
    return [...(input.query?.contextPack.symbols ?? [])]
        .map((symbol) => ({ fqName: symbol.fqName, filePath: symbol.filePath, reason: symbol.reason }))
        .sort((a, b) => a.filePath.localeCompare(b.filePath) || a.fqName.localeCompare(b.fqName));
}
function relevantTests(db, filePaths) {
    if (filePaths.length === 0)
        return [];
    const placeholders = filePaths.map(() => "?").join(", ");
    const rows = db
        .prepare(`SELECT DISTINCT tf.path AS test_path, sf.path AS source_path
       FROM tests t
       JOIN files tf ON tf.id = t.file_id
       LEFT JOIN symbols s ON s.id = t.target_symbol_id
       LEFT JOIN files sf ON sf.id = s.file_id
       WHERE sf.path IN (${placeholders}) OR tf.path IN (${placeholders})
       ORDER BY tf.path ASC`)
        .all(...filePaths, ...filePaths);
    return rows.map((row) => ({ path: row.test_path, reason: row.source_path ? `adjacent to ${row.source_path}` : "test file impacted" }));
}
function relevantDiagnostics(db, filePaths) {
    if (filePaths.length === 0)
        return [];
    const placeholders = filePaths.map(() => "?").join(", ");
    return db
        .prepare(`SELECT severity, file_path, message, tool
       FROM diagnostics
       WHERE severity != 'info' AND file_path IN (${placeholders})
       ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, file_path ASC, start_line ASC
       LIMIT 20`)
        .all(...filePaths);
}
function duplicateRisks(duplicates) {
    if (!duplicates || duplicates.risk === "low")
        return [];
    return [{ level: duplicates.risk, message: duplicates.recommendation, source: "duplicate-sentinel" }];
}
function diagnosticRisks(diagnostics) {
    return diagnostics.slice(0, 5).map((diagnostic) => ({
        level: diagnostic.severity === "error" ? "high" : "medium",
        message: `${diagnostic.tool}: ${diagnostic.message}`,
        source: diagnostic.filePath
    }));
}
function diffRisks(diff) {
    if (!diff)
        return [];
    const count = diff.changedFiles.length + diff.addedFiles.length + diff.removedFiles.length;
    if (count >= 8)
        return [{ level: "medium", message: `${count} files changed in memory diff`, source: "diff" }];
    return [];
}
function impactedContracts(db, filePaths) {
    if (filePaths.length === 0)
        return [];
    const placeholders = filePaths.map(() => "?").join(", ");
    const routes = db
        .prepare(`SELECT r.method AS method, r.path AS path
       FROM routes r JOIN files f ON f.id = r.file_id
       WHERE f.path IN (${placeholders})
       ORDER BY method ASC, path ASC
       LIMIT 10`)
        .all(...filePaths);
    return routes.map((route) => `${route.method} ${route.path}`);
}
function classifyBlastRadius(fileCount, symbolCount, testCount, riskCount) {
    const score = fileCount + Math.ceil(symbolCount / 3) + Math.ceil(testCount / 2) + riskCount * 2;
    if (score === 0)
        return "none";
    if (score <= 4)
        return "low";
    if (score <= 10)
        return "medium";
    return "high";
}
function impactSummary(blastRadius, fileCount, testCount, riskCount) {
    if (blastRadius === "none")
        return "No concrete impact evidence found.";
    return `${blastRadius} impact: ${fileCount} file(s), ${testCount} related test(s), ${riskCount} risk signal(s).`;
}
//# sourceMappingURL=impact-agent.js.map