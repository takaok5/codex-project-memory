import { nowIso } from "../shared/time.js";
export function upsertLanguageCapability(db, capability) {
    db.prepare(`INSERT INTO language_capabilities(
      language, display_name, tier, parser, symbols, dependencies, tests, routes, diagnostics, tool, tool_status, degraded_reason, updated_at
    )
    VALUES (
      @language, @displayName, @tier, @parser, @symbols, @dependencies, @tests, @routes, @diagnostics, @tool, @toolStatus, @degradedReason, @updatedAt
    )
    ON CONFLICT(language) DO UPDATE SET
      display_name=excluded.display_name,
      tier=CASE
        WHEN language_capabilities.tier = 'deep' OR excluded.tier = 'deep' THEN 'deep'
        WHEN language_capabilities.tier = 'structural' OR excluded.tier = 'structural' THEN 'structural'
        ELSE 'fallback'
      END,
      parser=excluded.parser,
      symbols=MAX(language_capabilities.symbols, excluded.symbols),
      dependencies=MAX(language_capabilities.dependencies, excluded.dependencies),
      tests=MAX(language_capabilities.tests, excluded.tests),
      routes=MAX(language_capabilities.routes, excluded.routes),
      diagnostics=MAX(language_capabilities.diagnostics, excluded.diagnostics),
      tool=excluded.tool,
      tool_status=CASE
        WHEN language_capabilities.tool_status = 'available' OR excluded.tool_status = 'available' THEN 'available'
        WHEN language_capabilities.tool_status = 'failed' OR excluded.tool_status = 'failed' THEN 'failed'
        WHEN language_capabilities.tool_status = 'disabled' OR excluded.tool_status = 'disabled' THEN 'disabled'
        WHEN language_capabilities.tool_status = 'missing' OR excluded.tool_status = 'missing' THEN 'missing'
        ELSE excluded.tool_status
      END,
      degraded_reason=COALESCE(language_capabilities.degraded_reason, excluded.degraded_reason),
      updated_at=excluded.updated_at`).run(toParams(capability));
}
export function listLanguageCapabilities(db) {
    return db.prepare("SELECT * FROM language_capabilities ORDER BY language ASC").all().map((row) => ({
        language: row.language,
        displayName: row.display_name,
        tier: row.tier,
        parser: row.parser,
        symbols: row.symbols === 1,
        dependencies: row.dependencies === 1,
        tests: row.tests === 1,
        routes: row.routes === 1,
        diagnostics: row.diagnostics === 1,
        tool: row.tool,
        toolStatus: row.tool_status,
        degradedReason: row.degraded_reason
    }));
}
function toParams(capability) {
    return {
        language: capability.language,
        displayName: capability.displayName,
        tier: capability.tier,
        parser: capability.parser,
        symbols: capability.symbols ? 1 : 0,
        dependencies: capability.dependencies ? 1 : 0,
        tests: capability.tests ? 1 : 0,
        routes: capability.routes ? 1 : 0,
        diagnostics: capability.diagnostics ? 1 : 0,
        tool: capability.tool,
        toolStatus: capability.toolStatus,
        degradedReason: capability.degradedReason,
        updatedAt: nowIso()
    };
}
//# sourceMappingURL=language-capability-repository.js.map