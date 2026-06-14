const SUFFIXES = new Set(["service", "controller", "dto", "module", "repository"]);
export function tokenizeForSearch(value) {
    return unique(splitTokens(value).filter((token) => token.length >= 2));
}
export function tokenizeForDuplicate(value) {
    return unique(splitTokens(value).filter((token) => token.length >= 2 && !SUFFIXES.has(token)));
}
export function normalizeArtifactNameForDuplicate(value) {
    return tokenizeForDuplicate(value).join(" ");
}
function splitTokens(value) {
    return value
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter(Boolean);
}
function unique(tokens) {
    return [...new Set(tokens)].sort();
}
//# sourceMappingURL=tokenize.js.map