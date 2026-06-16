import { getFrame } from "../store/frame-repository.js";
import { getProjectState } from "../store/project-state-repository.js";
import { addRetrievalLog } from "../store/retrieval-log-repository.js";
import { getEvidenceFeedbackScores, listArchitectureDecisions, listRuntimeEvidenceItems } from "../store/evidence-repository.js";
import { tokenizeForSearch } from "./tokenize.js";
export function runRetrievalAgent(ctx, input) {
    const db = ctx.db;
    const tokens = tokenizeForSearch(input.intent);
    const minScore = clampInt(input.minScore ?? 30, 0, 300);
    const maxEvidenceItems = clampInt(input.maxEvidenceItems ?? 12, 1, 40);
    const feedback = getEvidenceFeedbackScores(db);
    const modules = scoreModules(db, tokens).map((item) => applyFeedback(item, `module:${item.id}`, feedback)).filter((item) => item.score >= minScore).slice(0, input.maxFiles);
    const files = scoreFiles(db, tokens, input.diff).map((item) => applyFeedback(item, `file:${item.path}`, feedback)).filter((item) => item.score >= minScore).slice(0, input.maxFiles);
    const symbols = scoreSymbols(db, tokens, input.diff).map((item) => applyFeedback(item, `symbol:${item.filePath}:${item.fqName}`, feedback)).filter((item) => item.score >= minScore).slice(0, input.maxSymbols);
    const decisions = scoreDecisions(db, tokens, feedback).filter((item) => item.score >= minScore).slice(0, 6);
    const warnings = [...scoreWarnings(db, tokens), ...scoreDiagnostics(db, tokens), ...scoreRuntimeEvidence(db, tokens)]
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || (a.filePath ?? "").localeCompare(b.filePath ?? "") || a.message.localeCompare(b.message))
        .slice(0, input.maxWarnings);
    const current = input.includeVisualFrame ? getFrame(db, "current") : null;
    const state = getProjectState(db);
    const constraints = selectConstraints(ctx.config.criticalRules, modules, files, symbols, maxEvidenceItems);
    const rawEvidence = buildEvidenceItems({ modules, files, symbols, decisions, warnings, constraints });
    const evidence = rawEvidence.slice(0, maxEvidenceItems);
    const budget = buildBudget(maxEvidenceItems, rawEvidence.length, evidence);
    const contextPack = {
        summary: modules.length > 0 ? `Relevant modules: ${modules.map((module) => module.id).join(", ")}.` : "No strong structural matches found.",
        budget,
        evidence,
        modules,
        files,
        symbols,
        decisions,
        constraints,
        warnings,
        nextCommands: [`pmem duplicates --kind service ${input.intent} --json`],
        ...(current ? { visualFrame: { frame: current.id, svg: current.svgPath, png: current.pngPath, map: current.mapPath } } : {})
    };
    const output = { intent: input.intent, contextPack };
    if (state.status !== "fresh") {
        output.contextPack.warnings.unshift({ severity: "warning", message: `Memory status is ${state.status}.`, recommendation: "Run pmem refresh --json." });
    }
    addRetrievalLog(db, { intent: input.intent, agent: "retrieval", output: output });
    return output;
}
export function scoreRetrievalCandidates(intent, candidates) {
    const tokens = tokenizeForSearch(intent);
    return candidates
        .map((candidate) => ({ ...candidate, score: scoreText(tokens, [candidate.name, candidate.path ?? "", candidate.kind ?? ""].join(" ")) }))
        .sort(compareScored);
}
function scoreModules(db, tokens) {
    return db.prepare("SELECT id, name, root_path FROM modules ORDER BY id ASC").all()
        .map((row) => ({ id: row.id, name: row.name, reason: "intent token match", score: scoreText(tokens, `${row.id} ${row.name} ${row.root_path ?? ""}`) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
function scoreFiles(db, tokens, diff = emptyDiffInput()) {
    return db.prepare("SELECT path, module_id, is_test, is_generated FROM files ORDER BY path ASC").all()
        .map((row) => {
        const base = scoreText(tokens, `${row.path} ${row.module_id ?? ""}`);
        const diffBonus = diff.changedFiles.includes(row.path) || diff.addedFiles.includes(row.path) ? 35 : 0;
        const score = Math.max(0, base + (base > 0 ? diffBonus : 0) - (row.is_generated ? 30 : 0) - (row.is_test ? 10 : 0));
        return { path: row.path, moduleId: row.module_id ?? undefined, reason: "path/module token match", score, isTest: row.is_test === 1 };
    })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || Number(a.isTest) - Number(b.isTest) || a.path.localeCompare(b.path));
}
function scoreSymbols(db, tokens, diff = emptyDiffInput()) {
    return db
        .prepare(`SELECT s.id, s.fq_name, s.name, s.kind, f.path AS file_path
         FROM symbols s JOIN files f ON f.id = s.file_id
         ORDER BY s.fq_name ASC`)
        .all()
        .map((row) => {
        const base = scoreText(tokens, `${row.fq_name} ${row.name} ${row.kind}`);
        const diffBonus = diff.changedFiles.includes(row.file_path) || diff.addedFiles.includes(row.file_path) ? 25 : 0;
        const kindBonus = hasTokenMatch(new Set(tokens), row.kind) ? 25 : 0;
        return { fqName: row.fq_name, kind: row.kind, filePath: row.file_path, reason: "symbol token match", score: base + (base > 0 ? diffBonus + kindBonus : 0) };
    })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath) || a.fqName.localeCompare(b.fqName));
}
function scoreDecisions(db, tokens, feedback) {
    return listArchitectureDecisions(db, { limit: 30 })
        .map((decision) => {
        const base = scoreText(tokens, `${decision.title} ${decision.summary} ${decision.rationale} ${decision.moduleId ?? ""} ${decision.filePath ?? ""} ${decision.symbolFqName ?? ""}`);
        const stalePenalty = decision.status === "active" ? 0 : -30;
        const score = Math.max(0, base + stalePenalty + feedbackDelta(feedback, `decision:${decision.id}`, `decision:${decision.title}`));
        return {
            id: decision.id,
            title: decision.title,
            status: decision.status,
            summary: decision.summary,
            source: decision.filePath ?? decision.moduleId ?? "architecture_decision",
            reason: decision.status === "active" ? "architecture decision token match" : `architecture decision is ${decision.status}`,
            score
        };
    })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
function scoreWarnings(db, tokens) {
    return db
        .prepare(`SELECT w.severity, w.message, w.recommendation, f.path AS file_path
         FROM warnings w LEFT JOIN files f ON f.id = w.file_id
         WHERE w.resolved_at IS NULL
         ORDER BY w.severity DESC, COALESCE(f.path, '') ASC, w.message ASC`)
        .all()
        .filter((row) => scoreText(tokens, `${row.message} ${row.file_path ?? ""}`) > 0)
        .map((row) => ({ severity: row.severity, message: row.message, filePath: row.file_path ?? undefined, recommendation: row.recommendation ?? undefined }));
}
function scoreDiagnostics(db, tokens) {
    return db
        .prepare(`SELECT severity, message, code, file_path, tool
         FROM diagnostics
         ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, file_path ASC, start_line ASC`)
        .all()
        .filter((row) => row.severity !== "info" && scoreText(tokens, `${row.message} ${row.code ?? ""} ${row.file_path} ${row.tool}`) > 0)
        .map((row) => ({
        severity: row.severity === "error" ? "critical" : "warning",
        message: `${row.tool}${row.code ? ` ${row.code}` : ""}: ${row.message}`,
        filePath: row.file_path,
        recommendation: "Review compiler-assisted diagnostic before editing this area."
    }));
}
function scoreRuntimeEvidence(db, tokens) {
    return listRuntimeEvidenceItems(db, { limit: 50 })
        .filter((row) => scoreText(tokens, `${row.message} ${row.filePath ?? ""} ${row.kind}`) > 0)
        .map((row) => ({
        severity: row.severity === "error" ? "critical" : row.severity === "warning" ? "warning" : "info",
        message: `runtime ${row.kind}: ${row.message}`,
        filePath: row.filePath ?? undefined,
        recommendation: "Use runtime evidence before changing this area."
    }));
}
function severityRank(severity) {
    if (severity === "critical")
        return 0;
    if (severity === "warning")
        return 1;
    return 2;
}
function scoreText(tokens, text) {
    const haystack = new Set(tokenizeForSearch(text));
    return tokens.reduce((score, token) => score + (hasTokenMatch(haystack, token) ? 30 : 0), 0);
}
function hasTokenMatch(haystack, token) {
    if (haystack.has(token))
        return true;
    for (const candidate of haystack) {
        if (candidate.length > 3 && token.length > 3 && (candidate.startsWith(token) || token.startsWith(candidate))) {
            return true;
        }
    }
    return false;
}
function compareScored(a, b) {
    return b.score - a.score || (a.path ?? "").localeCompare(b.path ?? "") || a.name.localeCompare(b.name) || a.id - b.id;
}
function selectConstraints(rules, modules, files, symbols, maxEvidenceItems) {
    if (modules.length === 0 && files.length === 0 && symbols.length === 0)
        return [];
    return rules.slice(0, Math.min(5, Math.max(1, Math.floor(maxEvidenceItems / 3))));
}
function buildEvidenceItems(input) {
    const evidence = [];
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
    for (const decision of input.decisions) {
        evidence.push({
            id: `decision:${decision.id}`,
            kind: "decision",
            summary: decision.summary,
            source: decision.source,
            confidence: decision.status === "active" ? 0.9 : 0.55,
            reason: decision.reason,
            score: decision.score,
            stale: decision.status !== "active"
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
function applyFeedback(item, key, feedback) {
    return { ...item, score: Math.max(0, item.score + feedbackDelta(feedback, key)) };
}
function feedbackDelta(feedback, ...keys) {
    const raw = keys.reduce((sum, key) => sum + (feedback.get(key) ?? 0), 0);
    return Math.max(-45, Math.min(45, raw * 12));
}
function emptyDiffInput() {
    return { from: "previous", to: "current", changedFiles: [], addedFiles: [], removedFiles: [], changedModules: [], addedSymbols: [], removedSymbols: [], changedWarnings: { added: [], resolved: [] } };
}
function buildBudget(maxItems, rawCount, evidence) {
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
function scoreToConfidence(score) {
    return Math.max(0.3, Math.min(1, Math.round((score / 120) * 100) / 100));
}
function stableSnippet(value, maxLength) {
    const text = value.replace(/\s+/g, " ").trim();
    return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}
function clampInt(value, min, max) {
    return Math.max(min, Math.min(max, Math.trunc(value)));
}
//# sourceMappingURL=retrieval-agent.js.map