import { getFrame } from "../store/frame-repository.js";
import { getProjectState } from "../store/project-state-repository.js";
import { addRetrievalLog } from "../store/retrieval-log-repository.js";
import { tokenizeForSearch } from "./tokenize.js";
export function runRetrievalAgent(ctx, input) {
    const db = ctx.db;
    const tokens = tokenizeForSearch(input.intent);
    const modules = scoreModules(db, tokens).slice(0, input.maxFiles);
    const files = scoreFiles(db, tokens).slice(0, input.maxFiles);
    const symbols = scoreSymbols(db, tokens).slice(0, input.maxSymbols);
    const warnings = [...scoreWarnings(db, tokens), ...scoreDiagnostics(db, tokens)]
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || (a.filePath ?? "").localeCompare(b.filePath ?? "") || a.message.localeCompare(b.message))
        .slice(0, input.maxWarnings);
    const current = input.includeVisualFrame ? getFrame(db, "current") : null;
    const state = getProjectState(db);
    const contextPack = {
        summary: modules.length > 0 ? `Relevant modules: ${modules.map((module) => module.id).join(", ")}.` : "No strong structural matches found.",
        modules,
        files,
        symbols,
        constraints: ctx.config.criticalRules.slice(0, 20),
        warnings,
        nextCommands: [`pmem duplicates --kind service ${input.intent} --json`],
        ...(current ? { visualFrame: { frame: current.id, svg: current.svgPath, png: current.pngPath, map: current.mapPath } } : {})
    };
    const output = { intent: input.intent, contextPack };
    addRetrievalLog(db, { intent: input.intent, agent: "retrieval", output: output });
    if (state.status !== "fresh") {
        output.contextPack.warnings.unshift({ severity: "warning", message: `Memory status is ${state.status}.`, recommendation: "Run pmem refresh --json." });
    }
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
function scoreFiles(db, tokens) {
    return db.prepare("SELECT path, module_id, is_test, is_generated FROM files ORDER BY path ASC").all()
        .map((row) => {
        const base = scoreText(tokens, `${row.path} ${row.module_id ?? ""}`);
        const score = Math.max(0, base - (row.is_generated ? 30 : 0) - (row.is_test ? 10 : 0));
        return { path: row.path, moduleId: row.module_id ?? undefined, reason: "path/module token match", score, isTest: row.is_test === 1 };
    })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || Number(a.isTest) - Number(b.isTest) || a.path.localeCompare(b.path));
}
function scoreSymbols(db, tokens) {
    return db
        .prepare(`SELECT s.id, s.fq_name, s.name, s.kind, f.path AS file_path
         FROM symbols s JOIN files f ON f.id = s.file_id
         ORDER BY s.fq_name ASC`)
        .all()
        .map((row) => ({ fqName: row.fq_name, kind: row.kind, filePath: row.file_path, reason: "symbol token match", score: scoreText(tokens, `${row.fq_name} ${row.name} ${row.kind}`) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath) || a.fqName.localeCompare(b.fqName));
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
//# sourceMappingURL=retrieval-agent.js.map