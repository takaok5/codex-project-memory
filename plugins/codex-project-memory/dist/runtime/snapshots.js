import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonHash, safeJsonParse, writeJsonFileAtomic } from "../shared/json.js";
import { nowIso } from "../shared/time.js";
export function rotateSnapshotsForWrite(ctx) {
    const latest = snapshotAbs(ctx, "latest");
    if (existsSync(latest)) {
        renameSync(latest, snapshotAbs(ctx, "previous"));
    }
}
export function createMemorySnapshot(ctx, options = {}) {
    const db = ctx.db;
    const files = db
        .prepare("SELECT path, hash, module_id FROM files ORDER BY path ASC")
        .all()
        .map((row) => {
        const item = row;
        return { path: item.path, hash: item.hash, moduleId: item.module_id };
    });
    const symbols = db
        .prepare(`SELECT s.fq_name, s.kind, f.path AS file_path, s.signature_hash, s.body_hash
       FROM symbols s JOIN files f ON f.id = s.file_id
       ORDER BY s.fq_name ASC, f.path ASC`)
        .all()
        .map((row) => {
        const item = row;
        return {
            fqName: item.fq_name,
            kind: item.kind,
            filePath: item.file_path,
            signatureHash: item.signature_hash ?? undefined,
            bodyHash: item.body_hash ?? undefined
        };
    });
    const warnings = db
        .prepare(`SELECT w.warning_type, w.severity, f.path AS file_path, w.fingerprint
       FROM warnings w LEFT JOIN files f ON f.id = w.file_id
       WHERE w.resolved_at IS NULL
       ORDER BY w.warning_type ASC, COALESCE(f.path, '') ASC, w.fingerprint ASC`)
        .all()
        .map((row) => {
        const item = row;
        return { warningType: item.warning_type, severity: item.severity, filePath: item.file_path ?? undefined, fingerprint: item.fingerprint };
    });
    const frames = db
        .prepare("SELECT id, svg_path, png_path, map_path, source_hash FROM frames ORDER BY CASE id WHEN 'current' THEN 0 WHEN 'overview' THEN 1 WHEN 'modules' THEN 2 WHEN 'duplicates' THEN 3 ELSE 4 END")
        .all()
        .map((row) => {
        const item = row;
        return { id: item.id, svgPath: item.svg_path, pngPath: item.png_path, mapPath: item.map_path, sourceHash: item.source_hash };
    });
    const snapshot = {
        version: 1,
        createdAt: nowIso(),
        schemaVersion: "1",
        configHash: canonicalJsonHash(ctx.config),
        files,
        symbols,
        warnings,
        frames
    };
    if (options.write !== false) {
        writeJsonFileAtomic(snapshotAbs(ctx, options.ref ?? "latest"), snapshot);
    }
    return snapshot;
}
export function readMemorySnapshot(ctx, ref) {
    if (ref === "current") {
        return { snapshot: createMemorySnapshot(ctx, { write: false }) };
    }
    const abs = snapshotAbs(ctx, ref);
    if (!existsSync(abs)) {
        return { snapshot: null, warning: `snapshot_missing: ${ref}` };
    }
    const parsed = safeJsonParse(readFileSync(abs, "utf8"));
    if (!parsed.ok) {
        return { snapshot: null, warning: `snapshot_invalid: ${ref}` };
    }
    return { snapshot: parsed.value };
}
export function diffMemorySnapshots(from, to) {
    if (!from || !to) {
        return emptyDiff();
    }
    const fromFiles = new Map(from.files.map((file) => [String(file.path), String(file.hash)]));
    const toFiles = new Map(to.files.map((file) => [String(file.path), String(file.hash)]));
    const changedFiles = [...toFiles.keys()].filter((path) => fromFiles.has(path) && fromFiles.get(path) !== toFiles.get(path)).sort();
    const addedFiles = [...toFiles.keys()].filter((path) => !fromFiles.has(path)).sort();
    const removedFiles = [...fromFiles.keys()].filter((path) => !toFiles.has(path)).sort();
    const moduleByFile = new Map(to.files.map((file) => [String(file.path), String(file.moduleId ?? "")]));
    const changedModules = [...new Set([...changedFiles, ...addedFiles, ...removedFiles].map((path) => moduleByFile.get(path)).filter(Boolean))].sort();
    const fromSymbols = new Set(from.symbols.map((symbol) => String(symbol.fqName)));
    const toSymbols = new Set(to.symbols.map((symbol) => String(symbol.fqName)));
    const fromWarnings = new Set(from.warnings.map(warningKey));
    const toWarnings = new Set(to.warnings.map(warningKey));
    return {
        changedFiles,
        addedFiles,
        removedFiles,
        changedModules,
        addedSymbols: [...toSymbols].filter((symbol) => !fromSymbols.has(symbol)).sort(),
        removedSymbols: [...fromSymbols].filter((symbol) => !toSymbols.has(symbol)).sort(),
        changedWarnings: {
            added: [...toWarnings].filter((warning) => !fromWarnings.has(warning)).sort(),
            resolved: [...fromWarnings].filter((warning) => !toWarnings.has(warning)).sort()
        }
    };
}
function emptyDiff() {
    return { changedFiles: [], addedFiles: [], removedFiles: [], changedModules: [], addedSymbols: [], removedSymbols: [], changedWarnings: { added: [], resolved: [] } };
}
function warningKey(warning) {
    return `${warning.warningType ?? ""}:${warning.filePath ?? ""}:${warning.fingerprint ?? ""}`;
}
function snapshotAbs(ctx, ref) {
    const name = ref === "previous" || ref === "latest" ? `${ref}.snapshot.json` : String(ref).replaceAll("\\", "/");
    return join(ctx.memoryPaths.snapshotsDirAbs, name);
}
//# sourceMappingURL=snapshots.js.map