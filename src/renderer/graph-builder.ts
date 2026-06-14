import { getProjectState } from "../store/project-state-repository.js";
import type { JsonObject, NormalizedGraph, RuntimeContext } from "../shared/types.js";
import type { MemoryDb } from "../store/sqlite.js";

export function buildNormalizedGraph(ctx: RuntimeContext): NormalizedGraph {
  const db = ctx.db as MemoryDb;
  const state = getProjectState(db);
  const modules = (db.prepare("SELECT * FROM modules ORDER BY id ASC").all() as ModuleRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    rootPath: row.root_path,
    summary: row.summary,
    owns: parseJsonArray(row.owns_json),
    mustNot: parseJsonArray(row.must_not_json),
    dependencies: parseJsonArray(row.dependencies_json),
    riskLevel: row.risk_level
  }));
  const files = (db.prepare("SELECT id, path, language, module_id, hash, size_bytes, line_count, is_test, is_generated FROM files ORDER BY path ASC").all() as FileRow[]).map(
    (row) => ({
      id: row.id,
      path: row.path,
      language: row.language,
      moduleId: row.module_id,
      hash: row.hash,
      sizeBytes: row.size_bytes,
      lineCount: row.line_count,
      isTest: row.is_test === 1,
      isGenerated: row.is_generated === 1
    })
  );
  const symbols = (
    db
      .prepare(
        `SELECT s.id, s.fq_name, s.name, s.kind, s.exported, s.start_line, s.end_line, s.signature_hash, s.body_hash, f.path AS file_path, f.module_id
         FROM symbols s JOIN files f ON f.id = s.file_id
         ORDER BY s.fq_name ASC, f.path ASC, s.kind ASC`
      )
      .all() as SymbolRow[]
  ).map((row) => ({
    id: row.id,
    fqName: row.fq_name,
    name: row.name,
    kind: row.kind,
    exported: row.exported === 1,
    filePath: row.file_path,
    moduleId: row.module_id,
    startLine: row.start_line,
    endLine: row.end_line,
    signatureHash: row.signature_hash,
    bodyHash: row.body_hash
  }));
  const routes = (
    db
      .prepare(
        `SELECT r.id, r.method, r.path, r.module_id, f.path AS file_path, s.fq_name AS handler
         FROM routes r JOIN files f ON f.id = r.file_id
         LEFT JOIN symbols s ON s.id = r.handler_symbol_id
         ORDER BY r.method ASC, r.path ASC, f.path ASC`
      )
      .all() as RouteRow[]
  ).map((row) => ({
    id: row.id,
    method: row.method,
    path: row.path,
    moduleId: row.module_id,
    filePath: row.file_path,
    handler: row.handler
  }));
  const warnings = (
    db
      .prepare(
        `SELECT w.id, w.warning_type, w.severity, w.module_id, w.message, w.source, w.fingerprint, f.path AS file_path, s.fq_name AS symbol
         FROM warnings w
         LEFT JOIN files f ON f.id = w.file_id
         LEFT JOIN symbols s ON s.id = w.symbol_id
         WHERE w.resolved_at IS NULL
         ORDER BY w.severity DESC, COALESCE(f.path, '') ASC, w.message ASC, w.id ASC`
      )
      .all() as WarningRow[]
  ).map((row) => ({
    id: row.id,
    warningType: row.warning_type,
    severity: row.severity,
    moduleId: row.module_id,
    filePath: row.file_path,
    symbol: row.symbol,
    message: row.message,
    source: row.source,
    fingerprint: row.fingerprint
  }));
  const edges = (
    db
      .prepare(
        `SELECT e.id, e.edge_kind, e.confidence, fs.path AS source_file, from_s.fq_name AS from_symbol, to_s.fq_name AS to_symbol
         FROM symbol_edges e
         JOIN files fs ON fs.id = e.source_file_id
         JOIN symbols from_s ON from_s.id = e.from_symbol_id
         JOIN symbols to_s ON to_s.id = e.to_symbol_id
         ORDER BY from_s.fq_name ASC, to_s.fq_name ASC, e.edge_kind ASC`
      )
      .all() as EdgeRow[]
  ).map((row) => ({
    id: row.id,
    kind: row.edge_kind,
    confidence: row.confidence,
    sourceFile: row.source_file,
    from: row.from_symbol,
    to: row.to_symbol
  }));
  const duplicateCandidates = (
    db
      .prepare(
        `SELECT id, kind, similarity, reason
         FROM duplicate_candidates
         ORDER BY similarity DESC, kind ASC, id ASC`
      )
      .all() as DuplicateRow[]
  ).map((row) => ({
    id: row.id,
    kind: row.kind,
    similarity: row.similarity,
    reason: row.reason
  }));

  return canonicalizeGraph({
    version: 1,
    project: { name: ctx.config.projectName, status: state.status },
    modules,
    files,
    symbols,
    routes,
    warnings,
    duplicateCandidates,
    edges,
    criticalRules: [...ctx.config.criticalRules].sort()
  });
}

export function canonicalizeGraph(graph: NormalizedGraph): NormalizedGraph {
  return {
    version: 1,
    project: graph.project,
    modules: sortBy(graph.modules, ["id"]),
    files: sortBy(graph.files, ["path"]),
    symbols: sortBy(graph.symbols, ["fqName", "filePath", "kind"]),
    routes: sortBy(graph.routes, ["method", "path", "filePath"]),
    warnings: sortBy(graph.warnings, ["severity", "filePath", "message", "id"]),
    duplicateCandidates: sortBy(graph.duplicateCandidates, ["similarity", "kind", "id"], true),
    edges: sortBy(graph.edges, ["from", "to", "kind"]),
    criticalRules: [...graph.criticalRules].sort()
  };
}

function sortBy<T extends JsonObject>(rows: T[], keys: string[], descFirst = false): T[] {
  return [...rows].sort((a, b) => {
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]!;
      const direction = descFirst && index === 0 ? -1 : 1;
      const av = String(a[key] ?? "");
      const bv = String(b[key] ?? "");
      if (av < bv) return -1 * direction;
      if (av > bv) return 1 * direction;
    }
    return 0;
  });
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).sort() : [];
  } catch {
    return [];
  }
}

interface ModuleRow {
  id: string;
  name: string;
  root_path: string | null;
  summary: string | null;
  owns_json: string;
  must_not_json: string;
  dependencies_json: string;
  risk_level: string;
}

interface FileRow {
  id: number;
  path: string;
  language: string | null;
  module_id: string | null;
  hash: string;
  size_bytes: number;
  line_count: number;
  is_test: number;
  is_generated: number;
}

interface SymbolRow {
  id: number;
  fq_name: string;
  name: string;
  kind: string;
  exported: number;
  start_line: number | null;
  end_line: number | null;
  signature_hash: string | null;
  body_hash: string | null;
  file_path: string;
  module_id: string | null;
}

interface RouteRow {
  id: number;
  method: string;
  path: string;
  module_id: string | null;
  file_path: string;
  handler: string | null;
}

interface WarningRow {
  id: number;
  warning_type: string;
  severity: string;
  module_id: string | null;
  file_path: string | null;
  symbol: string | null;
  message: string;
  source: string;
  fingerprint: string;
}

interface EdgeRow {
  id: number;
  edge_kind: string;
  confidence: number;
  source_file: string;
  from_symbol: string;
  to_symbol: string;
}

interface DuplicateRow {
  id: number;
  kind: string;
  similarity: number;
  reason: string | null;
}
