import { tokenizeForSearch } from "./tokenize.js";
export function routeIntent(input) {
    const tokens = new Set(tokenizeForSearch(input.intent));
    const intentKind = classifyIntent(input.phase, tokens, input.artifact);
    const modules = mentionedModules(input.intent);
    const files = mentionedFiles(input.intent);
    const agents = agentsFor(intentKind, input.phase, Boolean(input.artifact));
    const budget = budgetFor(intentKind, input.phase);
    return {
        intentKind,
        phase: input.phase,
        scope: {
            modules,
            files,
            artifactKind: input.artifact?.kind ?? null
        },
        budget,
        agents,
        minConfidence: intentKind === "planning" || intentKind === "handoff" ? 0.65 : 0.75,
        defaultDeny: true,
        reason: routeReason(intentKind, input.phase, agents)
    };
}
function classifyIntent(phase, tokens, artifact) {
    if (phase === "pre_create" || artifact)
        return "pre_create";
    if (phase === "post_change")
        return "post_change";
    if (phase === "review")
        return "review";
    if (phase === "orient")
        return "architecture";
    if (hasAny(tokens, ["debug", "fix", "errore", "error", "failing", "failure", "bug", "crash"]))
        return "debug";
    if (hasAny(tokens, ["review", "audit", "controlla", "verifica"]))
        return "review";
    if (hasAny(tokens, ["diagnostic", "diagnostics", "compiler", "typecheck", "lint"]))
        return "diagnostics";
    if (hasAny(tokens, ["architettura", "architecture", "module", "moduli", "map"]))
        return "architecture";
    if (hasAny(tokens, ["handoff", "resume", "riprendi", "contesto"]))
        return "handoff";
    if (hasAny(tokens, ["piano", "plan", "design", "progetta", "definisci"]))
        return "planning";
    return "implementation";
}
function hasAny(tokens, values) {
    return values.some((value) => tokens.has(value));
}
function mentionedModules(intent) {
    const matches = intent.match(/\b[a-z][a-z0-9_-]{2,}\b/g) ?? [];
    return [...new Set(matches.filter((item) => ["access", "auth", "audit", "subscriptions", "turnstile", "cli", "mcp", "store", "indexer", "agents"].includes(item)))].sort();
}
function mentionedFiles(intent) {
    const matches = intent.match(/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+/g) ?? [];
    return [...new Set(matches.map((item) => item.replaceAll("\\", "/")))].sort();
}
function agentsFor(intentKind, phase, hasArtifact) {
    const agents = ["intent-router", "evidence-retriever"];
    if (hasArtifact || phase === "pre_create")
        agents.push("duplicate-sentinel");
    if (intentKind !== "handoff" && phase !== "orient")
        agents.push("impact-assessor");
    if (phase === "post_change" || phase === "review")
        agents.push("runtime-evidence-importer");
    if (phase !== "orient")
        agents.push("memory-curator", "conflict-arbiter");
    agents.push("context-compressor");
    return agents;
}
function budgetFor(intentKind, phase) {
    if (phase === "review" || intentKind === "debug") {
        return { maxEvidenceItems: 16, maxFiles: 8, maxSymbols: 12, maxWarnings: 8 };
    }
    if (phase === "post_change") {
        return { maxEvidenceItems: 14, maxFiles: 6, maxSymbols: 10, maxWarnings: 8 };
    }
    if (intentKind === "planning" || intentKind === "architecture") {
        return { maxEvidenceItems: 12, maxFiles: 6, maxSymbols: 8, maxWarnings: 5 };
    }
    return { maxEvidenceItems: 10, maxFiles: 5, maxSymbols: 8, maxWarnings: 5 };
}
function routeReason(intentKind, phase, agents) {
    return `${phase}:${intentKind}; ${agents.join(" -> ")}`;
}
//# sourceMappingURL=intent-router.js.map