export function runMemoryCurator(input) {
    const accepted = [];
    const rejected = [];
    const stale = [];
    for (const file of input.query?.contextPack.files ?? []) {
        if (file.score >= 60) {
            accepted.push({ kind: "file", summary: `Relevant file: ${file.path}`, source: file.path });
        }
        else {
            rejected.push({ reason: "weak file evidence score", source: file.path });
        }
    }
    if (input.duplicates?.risk === "high") {
        accepted.push({ kind: "duplicate", summary: input.duplicates.recommendation, source: "duplicate-sentinel" });
    }
    if (input.impact && input.impact.blastRadius !== "none") {
        accepted.push({ kind: "decision", summary: input.impact.summary, source: "impact-assessor" });
    }
    for (const removed of input.diff?.removedFiles ?? []) {
        stale.push({ kind: "file", source: removed, reason: "removed in memory diff" });
    }
    if (accepted.length === 0) {
        rejected.push({ reason: "no durable, verifiable memory candidate", source: input.phase });
    }
    return {
        mode: "writer_gate",
        accepted: accepted.slice(0, 8),
        rejected: rejected.slice(0, 8),
        stale: stale.slice(0, 8),
        rules: [
            "no raw transcript persistence",
            "persist only evidence tied to file, symbol, module, diagnostic or decision",
            "mark removed files as stale",
            "prefer repo/runtime evidence over conversational memory"
        ]
    };
}
//# sourceMappingURL=memory-curator.js.map