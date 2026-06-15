import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonHash, safeJsonParse, writeJsonFileAtomic } from "../shared/json.js";
import { nowIso } from "../shared/time.js";
import type { DiffOutput, FrameName, MemorySnapshot, RuntimeContext, SnapshotRef, WarningSeverity } from "../shared/types.js";
import { listDiagnostics } from "../store/diagnostic-repository.js";
import { listLanguageCapabilities } from "../store/language-capability-repository.js";
import type { MemoryDb } from "../store/sqlite.js";

export function rotateSnapshotsForWrite(ctx: RuntimeContext): void {
  const latest = snapshotAbs(ctx, "latest");
  if (existsSync(latest)) {
    renameSync(latest, snapshotAbs(ctx, "previous"));
  }
}

export function createMemorySnapshot(ctx: RuntimeContext, options: { ref?: "latest" | "previous"; write?: boolean } = {}): MemorySnapshot {
  const db = ctx.db as MemoryDb;
  const files = db
    .prepare("SELECT path, hash, module_id, language, analysis_json FROM files ORDER BY path ASC")
    .all()
    .map((row) => {
      const item = row as { path: string; hash: string; module_id: string | null; language: string | null; analysis_json: string };
      return { path: item.path, hash: item.hash, moduleId: item.module_id, language: item.language, tier: readTier(item.analysis_json) };
    });
  const symbols = db
    .prepare(
      `SELECT s.fq_name, s.kind, f.path AS file_path, s.signature_hash, s.body_hash
       FROM symbols s JOIN files f ON f.id = s.file_id
       ORDER BY s.fq_name ASC, f.path ASC`
    )
    .all()
    .map((row) => {
      const item = row as { fq_name: string; kind: string; file_path: string; signature_hash: string | null; body_hash: string | null };
      return {
        fqName: item.fq_name,
        kind: item.kind,
        filePath: item.file_path,
        signatureHash: item.signature_hash ?? undefined,
        bodyHash: item.body_hash ?? undefined
      };
    });
  const warnings = db
    .prepare(
      `SELECT w.warning_type, w.severity, f.path AS file_path, w.fingerprint
       FROM warnings w LEFT JOIN files f ON f.id = w.file_id
       WHERE w.resolved_at IS NULL
       ORDER BY w.warning_type ASC, COALESCE(f.path, '') ASC, w.fingerprint ASC`
    )
    .all()
    .map((row) => {
      const item = row as { warning_type: string; severity: string; file_path: string | null; fingerprint: string };
      return { warningType: item.warning_type, severity: item.severity as WarningSeverity, filePath: item.file_path ?? undefined, fingerprint: item.fingerprint };
    });
  const frames = db
    .prepare("SELECT id, svg_path, png_path, map_path, source_hash FROM frames ORDER BY CASE id WHEN 'current' THEN 0 WHEN 'overview' THEN 1 WHEN 'modules' THEN 2 WHEN 'duplicates' THEN 3 ELSE 4 END")
    .all()
    .map((row) => {
      const item = row as { id: string; svg_path: string; png_path: string | null; map_path: string; source_hash: string };
      return { id: item.id as FrameName, svgPath: item.svg_path, pngPath: item.png_path, mapPath: item.map_path, sourceHash: item.source_hash };
    });
  const diagnostics = listDiagnostics(db, { limit: 500 }).map((diagnostic) => ({
    language: diagnostic.language,
    filePath: diagnostic.filePath,
    severity: diagnostic.severity,
    code: diagnostic.code,
    fingerprint: diagnostic.fingerprint
  }));
  const snapshot: MemorySnapshot = {
    version: 1,
    createdAt: nowIso(),
    schemaVersion: "3",
    configHash: canonicalJsonHash(ctx.config),
    languageCapabilities: listLanguageCapabilities(db).map((item) => ({ ...item })),
    diagnostics,
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

export function readMemorySnapshot(ctx: RuntimeContext, ref: SnapshotRef): { snapshot: MemorySnapshot | null; warning?: string } {
  if (ref === "current") {
    return { snapshot: createMemorySnapshot(ctx, { write: false }) };
  }
  const abs = snapshotAbs(ctx, ref);
  if (!existsSync(abs)) {
    return { snapshot: null, warning: `snapshot_missing: ${ref}` };
  }
  const parsed = safeJsonParse<MemorySnapshot>(readFileSync(abs, "utf8"));
  if (!parsed.ok) {
    return { snapshot: null, warning: `snapshot_invalid: ${ref}` };
  }
  return { snapshot: parsed.value };
}

export function diffMemorySnapshots(from: MemorySnapshot | null, to: MemorySnapshot | null): Omit<DiffOutput, "from" | "to"> {
  if (!from || !to) {
    return emptyDiff();
  }
  const fromFiles = new Map(from.files.map((file) => [String(file.path), String(file.hash)]));
  const toFiles = new Map(to.files.map((file) => [String(file.path), String(file.hash)]));
  const changedFiles = [...toFiles.keys()].filter((path) => fromFiles.has(path) && fromFiles.get(path) !== toFiles.get(path)).sort();
  const addedFiles = [...toFiles.keys()].filter((path) => !fromFiles.has(path)).sort();
  const removedFiles = [...fromFiles.keys()].filter((path) => !toFiles.has(path)).sort();
  const moduleByFile = new Map(to.files.map((file) => [String(file.path), String(file.moduleId ?? "")]));
  const changedModules = [...new Set([...changedFiles, ...addedFiles, ...removedFiles].map((path) => moduleByFile.get(path)).filter(Boolean) as string[])].sort();
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

function emptyDiff(): Omit<DiffOutput, "from" | "to"> {
  return { changedFiles: [], addedFiles: [], removedFiles: [], changedModules: [], addedSymbols: [], removedSymbols: [], changedWarnings: { added: [], resolved: [] } };
}

function warningKey(warning: Record<string, unknown>): string {
  return `${warning.warningType ?? ""}:${warning.filePath ?? ""}:${warning.fingerprint ?? ""}`;
}

function readTier(analysisJson: string): "deep" | "structural" | "fallback" | null {
  try {
    const parsed = JSON.parse(analysisJson) as { tier?: unknown };
    return parsed.tier === "deep" || parsed.tier === "structural" || parsed.tier === "fallback" ? parsed.tier : null;
  } catch {
    return null;
  }
}

function snapshotAbs(ctx: RuntimeContext, ref: SnapshotRef): string {
  const name = ref === "previous" || ref === "latest" ? `${ref}.snapshot.json` : String(ref).replaceAll("\\", "/");
  return join(ctx.memoryPaths.snapshotsDirAbs, name);
}
