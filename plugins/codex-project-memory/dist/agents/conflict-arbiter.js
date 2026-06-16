export function runConflictArbiter(input) {
    const items = [];
    if (input.duplicates?.risk === "high") {
        items.push({
            severity: "critical",
            message: "New artifact request conflicts with a high-confidence duplicate candidate.",
            sources: ["duplicate-sentinel", ...input.duplicates.matches.map((match) => match.filePath ?? match.path ?? match.name).slice(0, 4)],
            resolution: "Extend the existing artifact instead of creating a new one."
        });
    }
    const acceptedSources = new Set(input.curation?.accepted.map((item) => item.source) ?? []);
    const staleAccepted = (input.curation?.stale ?? []).filter((item) => acceptedSources.has(item.source));
    for (const item of staleAccepted) {
        items.push({
            severity: "warning",
            message: "Writer gate accepted evidence that is also marked stale.",
            sources: [item.source],
            resolution: "Prefer the stale marker and refresh memory before persisting this fact."
        });
    }
    if ((input.query?.contextPack.budget.usedItems ?? 0) === 0 && input.impact?.blastRadius !== "none") {
        items.push({
            severity: "warning",
            message: "Impact assessor found change evidence but the context retriever returned no strong context evidence.",
            sources: ["impact-assessor", "evidence-retriever"],
            resolution: "Use diff/runtime evidence and avoid adding broad memory claims."
        });
    }
    const removed = new Set(input.diff?.removedFiles ?? []);
    for (const file of input.query?.contextPack.files ?? []) {
        if (removed.has(file.path)) {
            items.push({
                severity: "warning",
                message: "Retrieved file is removed in the current memory diff.",
                sources: [file.path],
                resolution: "Treat the file reference as stale and refresh/index before relying on it."
            });
        }
    }
    return {
        status: items.some((item) => item.severity === "critical") ? "conflict" : items.length > 0 ? "conflict" : "clear",
        items: items.slice(0, 8)
    };
}
//# sourceMappingURL=conflict-arbiter.js.map