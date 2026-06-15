import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { findProjectRoot } from "../../runtime/project-locator.js";
import { getMemoryPaths } from "../../runtime/memory-paths.js";
import { loadProjectConfig } from "../../runtime/config-loader.js";
import { getProjectState } from "../../store/project-state-repository.js";
import { listDiagnostics } from "../../store/diagnostic-repository.js";
import { listLanguageCapabilities } from "../../store/language-capability-repository.js";
import { FORBIDDEN_TABLES, REQUIRED_TABLES } from "../../store/sqlite.js";
import { toErrorPayload } from "../../shared/errors.js";
export async function cmdDoctor(options) {
    try {
        const root = findProjectRoot(options.cwd).root;
        const paths = getMemoryPaths(root);
        const checks = [];
        const memoryRootExists = existsSync(paths.memoryRootAbs);
        checks.push({
            id: "memory_root",
            status: memoryRootExists ? "ok" : "skipped",
            message: memoryRootExists ? ".codex/memory exists" : ".codex/memory is not initialized"
        });
        let configOk = false;
        if (existsSync(paths.configAbs)) {
            try {
                loadProjectConfig(paths);
                configOk = true;
                checks.push({ id: "config", status: "ok", message: "config schemaVersion=1" });
            }
            catch (error) {
                checks.push({ id: "config", status: "error", message: toErrorPayload(error).message });
            }
        }
        else {
            checks.push({ id: "config", status: "skipped", message: "config missing" });
        }
        let state = emptyState();
        let userVersion = null;
        let schemaVersion = null;
        let foreignKeysEnabled = null;
        let requiredTablesPresent = false;
        let forbiddenTables = [];
        let availableFrames = [];
        let current = null;
        let diagnosticsCount = 0;
        let failedTools = [];
        let languageCapabilities = [];
        let languageToolsCachePath = ".codex/memory/cache/language-tools";
        let lockedTools = [];
        if (existsSync(paths.dbAbs)) {
            try {
                const db = new Database(paths.dbAbs, { readonly: true, fileMustExist: true });
                try {
                    db.pragma("foreign_keys = ON");
                    foreignKeysEnabled = db.pragma("foreign_keys", { simple: true }) === 1;
                    userVersion = Number(db.pragma("user_version", { simple: true }));
                    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
                    requiredTablesPresent = REQUIRED_TABLES.every((table) => tables.includes(table));
                    forbiddenTables = tables.filter((table) => FORBIDDEN_TABLES.includes(table));
                    if (requiredTablesPresent) {
                        state = getProjectState(db);
                        schemaVersion = state.schemaVersion;
                        const frameRows = db.prepare("SELECT id, svg_path, png_path, map_path, source_hash, generated_at FROM frames ORDER BY id").all();
                        availableFrames = frameRows.map((row) => row.id);
                        diagnosticsCount = listDiagnostics(db, { limit: 100000 }).length;
                        languageCapabilities = listLanguageCapabilities(db);
                        failedTools = languageCapabilities
                            .filter((capability) => capability.toolStatus === "failed")
                            .map((capability) => capability.tool ?? capability.language)
                            .sort();
                        const currentRow = frameRows.find((row) => row.id === "current");
                        current = currentRow
                            ? {
                                frame: currentRow.id,
                                svg: currentRow.svg_path,
                                png: currentRow.png_path,
                                map: currentRow.map_path,
                                sourceHash: currentRow.source_hash,
                                generatedAt: currentRow.generated_at
                            }
                            : null;
                    }
                    checks.push({ id: "sqlite_open", status: "ok", message: "memory.db open" });
                    checks.push({ id: "sqlite_foreign_keys", status: foreignKeysEnabled ? "ok" : "error", message: foreignKeysEnabled ? "PRAGMA foreign_keys=ON" : "PRAGMA foreign_keys=OFF" });
                    checks.push({ id: "sqlite_user_version", status: userVersion === 3 ? "ok" : "error", message: `PRAGMA user_version=${userVersion}` });
                    checks.push({
                        id: "sqlite_forbidden_tables",
                        status: forbiddenTables.length ? "warning" : "ok",
                        message: forbiddenTables.length ? `forbidden tables present: ${forbiddenTables.join(", ")}` : "no forbidden v0.1 tables"
                    });
                }
                finally {
                    db.close();
                }
            }
            catch (error) {
                checks.push({ id: "sqlite_open", status: "error", message: toErrorPayload(error).message });
            }
        }
        else {
            checks.push({ id: "sqlite_open", status: "skipped", message: "memory.db missing" });
        }
        checks.push({ id: "frame_svg", status: current ? "ok" : "skipped", message: current ? "current.svg present" : "current.svg not rendered yet" });
        checks.push({ id: "frame_map", status: current ? "ok" : "skipped", message: current ? "current.map.json present" : "current.map.json not rendered yet" });
        checks.push({ id: "frame_png", status: "skipped", message: "current.png is optional" });
        checks.push({ id: "language_tools_cache", status: "ok", message: "language tool cache is project-local" });
        if (configOk) {
            try {
                languageToolsCachePath = loadProjectConfig(paths).languageTools?.cachePath ?? languageToolsCachePath;
                const lockPathRel = `${languageToolsCachePath.replaceAll("\\", "/").replace(/\/$/, "")}/pmem-language-tools.lock.json`;
                const lockPathAbs = join(root, ...lockPathRel.split("/"));
                if (existsSync(lockPathAbs)) {
                    const lock = JSON.parse(readFileSync(lockPathAbs, "utf8"));
                    lockedTools = Object.keys(lock.tools ?? {}).sort();
                }
            }
            catch {
                lockedTools = [];
            }
        }
        const initialized = memoryRootExists || configOk || existsSync(paths.dbAbs);
        const diagnosticsCapability = buildDiagnosticsCapability(initialized, diagnosticsCount, languageCapabilities, failedTools);
        checks.push({
            id: "diagnostics",
            status: diagnosticsCapability.status === "not_initialized" ? "skipped" : diagnosticsCapability.status === "degraded" ? "warning" : "ok",
            message: diagnosticsCapability.message,
            details: {
                hardGate: diagnosticsCapability.hardGate,
                status: diagnosticsCapability.status,
                degradedLanguages: diagnosticsCapability.degradedLanguages,
                failedTools: diagnosticsCapability.failedTools,
                diagnosticsStored: diagnosticsCapability.diagnosticsStored
            }
        });
        const anyError = checks.some((check) => check.status === "error");
        const anyWarning = checks.some((check) => check.status === "warning");
        const overallStatus = !initialized ? "not_initialized" : anyError ? "error" : anyWarning ? "warning" : "ok";
        return {
            ok: true,
            data: {
                overallStatus,
                memoryRoot: paths.memoryRootRel,
                state: {
                    status: initialized ? state.status : "not_initialized",
                    schemaVersion,
                    lastIndexedAt: state.lastIndexedAt,
                    lastRenderedAt: state.lastRenderedAt,
                    memoryDirty: state.memoryDirty,
                    dirtyReason: state.dirtyReason,
                    lastError: state.lastError
                },
                checks,
                schema: { userVersion, schemaVersion, foreignKeysEnabled, requiredTablesPresent, forbiddenTables },
                frames: { current, available: availableFrames },
                capabilities: {
                    diagnostics: diagnosticsCapability
                },
                languageTools: {
                    cachePath: languageToolsCachePath,
                    lockfile: `${languageToolsCachePath.replaceAll("\\", "/").replace(/\/$/, "")}/pmem-language-tools.lock.json`,
                    lockedTools,
                    failedTools,
                    diagnostics: diagnosticsCount
                }
            },
            warnings: []
        };
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
function buildDiagnosticsCapability(initialized, diagnosticsStored, languageCapabilities, failedTools) {
    if (!initialized) {
        return {
            status: "not_initialized",
            hardGate: false,
            message: "diagnostics unavailable before init",
            diagnosticsStored,
            degradedLanguages: [],
            failedTools
        };
    }
    const degradedLanguages = languageCapabilities
        .filter((capability) => Boolean(capability.degradedReason) || (Boolean(capability.tool) && capability.toolStatus !== "available"))
        .map((capability) => capability.language)
        .sort();
    if (degradedLanguages.length > 0 || failedTools.length > 0) {
        return {
            status: "degraded",
            hardGate: false,
            message: `compiler-assisted diagnostics degraded for ${degradedLanguages.length} language${degradedLanguages.length === 1 ? "" : "s"}; not a hard gate`,
            diagnosticsStored,
            degradedLanguages,
            failedTools
        };
    }
    return {
        status: "ok",
        hardGate: false,
        message: languageCapabilities.length > 0 ? `${diagnosticsStored} diagnostics stored` : "no indexed language diagnostics yet",
        diagnosticsStored,
        degradedLanguages: [],
        failedTools: []
    };
}
function emptyState() {
    return {
        schemaVersion: null,
        status: "not_initialized",
        projectName: null,
        lastIndexedAt: null,
        lastRenderedAt: null,
        memoryDirty: false,
        dirtyReason: "",
        lastError: null
    };
}
//# sourceMappingURL=doctor.js.map