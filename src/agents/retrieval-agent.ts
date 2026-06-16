import { getFrame } from "../store/frame-repository.js";
import { getProjectState } from "../store/project-state-repository.js";
import { addRetrievalLog } from "../store/retrieval-log-repository.js";
import { tokenizeForSearch } from "./tokenize.js";
import type { ContextBudget, ContextFile, ContextModule, ContextSymbol, ContextWarning, EvidenceItem, JsonObject, RetrievalAgentInput, QueryOutput, RuntimeContext, WarningSeverity } from "../shared/types.js";
import type { MemoryDb } from "../store/sqlite.js";

export function runRetrievalAgent(ctx: RuntimeContext, input: RetrievalAgentInput): QueryOutput {
  const db = ctx.db as MemoryDb;
  const tokens = tokenizeForSearch(input.intent);
  const minScore = clampInt(input.minScore ?? 30, 0, 300);
  const maxEvidenceItems = clampInt(input.maxEvidenceItems ?? 12, 1, 40);
  const modules = scoreModules(db, tokens).filter((item) => item.score >= minScore).slice(0, input.maxFiles);
  const files = scoreFiles(db, tokens).filter((item) => item.score >= minScore).slice(0, input.maxFiles);
  const symbols = scoreSymbols(db, tokens).filter((item) => item.score >= minScore).slice(0, input.maxSymbols);
  const warnings = [...scoreWarnings(db, tokens), ...scoreDiagnostics(db, tokens)]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || (a.filePath ?? "").localeCompare(b.filePath ?? "") || a.message.localeCompare(b.message))
    .slice(0, input.maxWarnings);
  const current = input.includeVisualFrame ? getFrame(db, "current") : null;
  const state = getProjectState(db);
  const constraints = selectConstraints(ctx.config.criticalRules, modules, files, symbols, maxEvidenceItems);
  const rawEvidence = buildEvidenceItems({ modules, files, symbols, warnings, constraints });
  const evidence = rawEvidence.slice(0, maxEvidenceItems);
  const budget = buildBudget(maxEvidenceItems, rawEvidence.length, evidence);
  const contextPack = {
    summary: modules.length > 0 ? `Relevant modules: ${modules.map((module) => module.id).join(", ")}.` : "No strong structural matches found.",
    budget,
    evidence,
    modules,
    files,
    symbols,
    constraints,
    warnings,
    nextCommands: [`pmem duplicates --kind service ${input.intent} --json`],
    ...(current ? { visualFrame: { frame: current.id, svg: current.svgPath, png: current.pngPath, map: current.mapPath } } : {})
  };
  const output: QueryOutput = { intent: input.intent, contextPack };
  if (state.status !== "fresh") {
    output.contextPack.warnings.unshift({ severity: "warning", message: `Memory status is ${state.status}.`, recommendation: "Run pmem refresh --json." });
  }
  addRetrievalLog(db, { intent: input.intent, agent: "retrieval", output: output as unknown as JsonObject });
  return output;
}

export function scoreRetrievalCandidates(intent: string, candidates: RetrievalCandidate[]): ScoredRetrievalCandidate[] {
  const tokens = tokenizeForSearch(intent);
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreText(tokens, [candidate.name, candidate.path ?? "", candidate.kind ?? ""].join(" ")) }))
    .sort(compareScored);
}

function scoreModules(db: MemoryDb, tokens: string[]): ContextModule[] {
  return (
    db.prepare("SELECT id, name, root_path FROM modules ORDER BY id ASC").all() as Array<{ id: string; name: string; root_path: string | null }>
  )
    .map((row) => ({ id: row.id, name: row.name, reason: "intent token match", score: scoreText(tokens, `${row.id} ${row.name} ${row.root_path ?? ""}`) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function scoreFiles(db: MemoryDb, tokens: string[]): ContextFile[] {
  return (
    db.prepare("SELECT path, module_id, is_test, is_generated FROM files ORDER BY path ASC").all() as Array<{ path: string; module_id: string | null; is_test: number; is_generated: number }>
  )
    .map((row) => {
      const base = scoreText(tokens, `${row.path} ${row.module_id ?? ""}`);
      const score = Math.max(0, base - (row.is_generated ? 30 : 0) - (row.is_test ? 10 : 0));
      return { path: row.path, moduleId: row.module_id ?? undefined, reason: "path/module token match", score, isTest: row.is_test === 1 };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || Number(a.isTest) - Number(b.isTest) || a.path.localeCompare(b.path));
}

function scoreSymbols(db: MemoryDb, tokens: string[]): ContextSymbol[] {
  return (
    db
      .prepare(
        `SELECT s.id, s.fq_name, s.name, s.kind, f.path AS file_path
         FROM symbols s JOIN files f ON f.id = s.file_id
         ORDER BY s.fq_name ASC`
      )
      .all() as Array<{ id: number; fq_name: string; name: string; kind: string; file_path: string }>
  )
    .map((row) => ({ fqName: row.fq_name, kind: row.kind, filePath: row.file_path, reason: "symbol token match", score: scoreText(tokens, `${row.fq_name} ${row.name} ${row.kind}`) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath) || a.fqName.localeCompare(b.fqName));
}

function scoreWarnings(db: MemoryDb, tokens: string[]): ContextWarning[] {
  return (
    db
      .prepare(
        `SELECT w.severity, w.message, w.recommendation, f.path AS file_path
         FROM warnings w LEFT JOIN files f ON f.id = w.file_id
         WHERE w.resolved_at IS NULL
         ORDER BY w.severity DESC, COALESCE(f.path, '') ASC, w.message ASC`
      )
      .all() as Array<{ severity: WarningSeverity; message: string; recommendation: string | null; file_path: string | null }>
  )
    .filter((row) => scoreText(tokens, `${row.message} ${row.file_path ?? ""}`) > 0)
    .map((row) => ({ severity: row.severity, message: row.message, filePath: row.file_path ?? undefined, recommendation: row.recommendation ?? undefined }));
}

function scoreDiagnostics(db: MemoryDb, tokens: string[]): ContextWarning[] {
  return (
    db
      .prepare(
        `SELECT severity, message, code, file_path, tool
         FROM diagnostics
         ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, file_path ASC, start_line ASC`
      )
      .all() as Array<{ severity: "error" | "warning" | "info"; message: string; code: string | null; file_path: string; tool: string }>
  )
    .filter((row) => row.severity !== "info" && scoreText(tokens, `${row.message} ${row.code ?? ""} ${row.file_path} ${row.tool}`) > 0)
    .map((row) => ({
      severity: row.severity === "error" ? "critical" : "warning",
      message: `${row.tool}${row.code ? ` ${row.code}` : ""}: ${row.message}`,
      filePath: row.file_path,
      recommendation: "Review compiler-assisted diagnostic before editing this area."
    }));
}

function severityRank(severity: WarningSeverity): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function scoreText(tokens: string[], text: string): number {
  const haystack = new Set(tokenizeForSearch(text));
  return tokens.reduce((score, token) => score + (hasTokenMatch(haystack, token) ? 30 : 0), 0);
}

function hasTokenMatch(haystack: Set<string>, token: string): boolean {
  if (haystack.has(token)) return true;
  for (const candidate of haystack) {
    if (candidate.length > 3 && token.length > 3 && (candidate.startsWith(token) || token.startsWith(candidate))) {
      return true;
    }
  }
  return false;
}

function compareScored(a: ScoredRetrievalCandidate, b: ScoredRetrievalCandidate): number {
  return b.score - a.score || (a.path ?? "").localeCompare(b.path ?? "") || a.name.localeCompare(b.name) || a.id - b.id;
}

function selectConstraints(rules: string[], modules: ContextModule[], files: ContextFile[], symbols: ContextSymbol[], maxEvidenceItems: number): string[] {
  if (modules.length === 0 && files.length === 0 && symbols.length === 0) return [];
  return rules.slice(0, Math.min(5, Math.max(1, Math.floor(maxEvidenceItems / 3))));
}

function buildEvidenceItems(input: { modules: ContextModule[]; files: ContextFile[]; symbols: ContextSymbol[]; warnings: ContextWarning[]; constraints: string[] }): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  for (const module of input.modules) {
    evidence.push({
      id: `module:${module.id}`,
      kind: "module",
      summary: `Module ${module.id}: ${module.name}`,
      source: module.id,
      confidence: scoreToConfidence(module.score),
      reason: module.reason,
      score: module.score,
      stale: false
    });
  }
  for (const file of input.files) {
    evidence.push({
      id: `file:${file.path}`,
      kind: file.isTest ? "test" : "file",
      summary: `${file.isTest ? "Test" : "File"} ${file.path}`,
      source: file.path,
      confidence: scoreToConfidence(file.score),
      reason: file.reason,
      score: file.score,
      stale: false
    });
  }
  for (const symbol of input.symbols) {
    evidence.push({
      id: `symbol:${symbol.filePath}:${symbol.fqName}`,
      kind: "symbol",
      summary: `${symbol.kind} ${symbol.fqName}`,
      source: symbol.filePath,
      confidence: scoreToConfidence(symbol.score),
      reason: symbol.reason,
      score: symbol.score,
      stale: false
    });
  }
  for (const warning of input.warnings) {
    const severityBoost = warning.severity === "critical" ? 100 : warning.severity === "warning" ? 75 : 45;
    evidence.push({
      id: `warning:${warning.filePath ?? "project"}:${stableSnippet(warning.message, 48)}`,
      kind: "warning",
      summary: stableSnippet(warning.message, 160),
      source: warning.filePath ?? "project",
      confidence: severityBoost / 100,
      reason: warning.recommendation ?? "active warning matched intent",
      score: severityBoost,
      stale: false
    });
  }
  input.constraints.forEach((rule, index) => {
    evidence.push({
      id: `constraint:${index + 1}`,
      kind: "constraint",
      summary: stableSnippet(rule, 160),
      source: "project-memory.config.json",
      confidence: 1,
      reason: "critical project rule attached to matched repo evidence",
      score: 100,
      stale: false
    });
  });
  return evidence.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
}

function buildBudget(maxItems: number, rawCount: number, evidence: EvidenceItem[]): ContextBudget {
  return {
    maxItems,
    usedItems: evidence.length,
    facts: evidence.filter((item) => item.kind !== "constraint").length,
    constraints: evidence.filter((item) => item.kind === "constraint").length,
    references: evidence.filter((item) => item.kind === "file" || item.kind === "symbol" || item.kind === "module" || item.kind === "test").length,
    truncated: rawCount > evidence.length,
    defaultDeny: true
  };
}

function scoreToConfidence(score: number): number {
  return Math.max(0.3, Math.min(1, Math.round((score / 120) * 100) / 100));
}

function stableSnippet(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export interface RetrievalCandidate {
  id: number;
  name: string;
  path?: string;
  kind?: string;
}

export interface ScoredRetrievalCandidate extends RetrievalCandidate {
  score: number;
}
