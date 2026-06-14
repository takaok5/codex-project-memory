import { replaceDuplicateCandidates } from "../store/duplicate-repository.js";
import { addRetrievalLog } from "../store/retrieval-log-repository.js";
import { tokenizeForDuplicate } from "./tokenize.js";
export function runDuplicateAgent(ctx, input) {
    const db = ctx.db;
    const candidates = loadCandidates(db).map((candidate) => scoreCandidate(input, candidate)).filter((candidate) => candidate.similarity > 0);
    candidates.sort((a, b) => b.similarity - a.similarity || (a.filePath ?? "").localeCompare(b.filePath ?? "") || a.name.localeCompare(b.name));
    const matches = candidates.slice(0, 10);
    replaceDuplicateCandidates(db, matches.map((match) => ({
        kind: match.kind,
        leftSymbolId: match.symbolId,
        leftFileId: match.fileId,
        similarity: match.similarity,
        reason: match.reason
    })));
    const score = scoreDuplicateRisk(input, matches);
    const output = {
        kind: input.kind,
        intent: input.intent,
        risk: score.risk,
        verdict: score.verdict,
        matches,
        recommendation: recommendation(score.risk, matches[0])
    };
    addRetrievalLog(db, { intent: input.intent, agent: "duplicate", output: output });
    return output;
}
export function scoreDuplicateRisk(_input, candidates) {
    const score = candidates[0]?.similarity ?? 0;
    if (score >= 0.8)
        return { risk: "high", verdict: "extend_existing_artifact", score };
    if (score >= 0.45)
        return { risk: "medium", verdict: "needs_human_review", score };
    return { risk: "low", verdict: "create_new_artifact", score };
}
function loadCandidates(db) {
    return db
        .prepare(`SELECT s.id AS symbol_id, f.id AS file_id, s.name, s.fq_name, s.kind, f.path AS file_path, f.module_id
         FROM symbols s JOIN files f ON f.id = s.file_id
         WHERE s.kind IN ('service', 'controller', 'repository', 'utility', 'class', 'function', 'method', 'const', 'provider')
         ORDER BY f.path ASC, s.name ASC`)
        .all().map((row) => ({
        kind: inferArtifactKind(row.name, row.kind),
        symbolId: row.symbol_id,
        fileId: row.file_id,
        name: row.name,
        fqName: row.fq_name,
        filePath: row.file_path,
        moduleId: row.module_id ?? undefined,
        similarity: 0,
        reason: ""
    }));
}
function scoreCandidate(input, candidate) {
    const proposedTokens = tokenizeForDuplicate(input.proposedName ?? input.intent);
    const candidateTokens = tokenizeForDuplicate(`${candidate.name} ${candidate.fqName ?? ""}`);
    const nameOverlap = overlap(proposedTokens, candidateTokens);
    const intentOverlap = overlap(tokenizeForDuplicate(input.intent), tokenizeForDuplicate(`${candidate.name} ${candidate.filePath ?? ""}`));
    let similarity = 0;
    if (candidate.kind === input.kind)
        similarity += 0.35;
    if (input.moduleId && candidate.moduleId === input.moduleId)
        similarity += 0.25;
    else if (!input.moduleId && sameFirstSegment(candidate.filePath, input.intent))
        similarity += 0.25;
    if (nameOverlap >= 0.5)
        similarity += 0.2;
    if (intentOverlap >= 0.35)
        similarity += 0.1;
    if (hasSharedDomainNoun(proposedTokens, candidateTokens))
        similarity += 0.05;
    if (candidate.kind === input.kind && input.moduleId && candidate.moduleId === input.moduleId && normalizeName(input.proposedName ?? input.intent) === normalizeName(candidate.name)) {
        similarity = 1;
    }
    similarity = Math.max(0, Math.min(1, Number(similarity.toFixed(2))));
    return {
        ...candidate,
        similarity,
        reason: similarity >= 0.8 ? "same module and overlapping access validation responsibility" : similarity >= 0.45 ? "partial artifact overlap" : "weak overlap"
    };
}
function inferArtifactKind(name, kind) {
    const lower = name.toLowerCase();
    if (lower.endsWith("service"))
        return "service";
    if (lower.endsWith("controller"))
        return "controller";
    if (lower.endsWith("dto"))
        return "dto";
    if (lower.endsWith("repository"))
        return "repository";
    if (kind === "service" || kind === "controller" || kind === "repository" || kind === "utility" || kind === "provider")
        return kind;
    return kind === "function" ? "function" : "class";
}
function overlap(left, right) {
    if (left.length === 0 || right.length === 0)
        return 0;
    const r = new Set(right);
    return left.filter((token) => r.has(token)).length / Math.max(left.length, right.length);
}
function hasSharedDomainNoun(left, right) {
    const r = new Set(right);
    return left.some((token) => token.length >= 4 && r.has(token));
}
function sameFirstSegment(pathValue, intent) {
    if (!pathValue)
        return false;
    return tokenizeForDuplicate(intent).includes(pathValue.split("/")[1] ?? pathValue.split("/")[0] ?? "");
}
function normalizeName(value) {
    return tokenizeForDuplicate(value).join("");
}
function recommendation(risk, candidate) {
    if (risk === "high" && candidate)
        return `Estendere ${candidate.name} invece di creare un nuovo servizio di validazione accesso.`;
    if (risk === "medium")
        return "Rivedere i match prima di creare un nuovo artefatto.";
    return "Nessun duplicato forte trovato; creare un nuovo artefatto e consentito.";
}
//# sourceMappingURL=duplicate-agent.js.map