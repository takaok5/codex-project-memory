export function supportsLanguage(indexer, language) {
    if (!language)
        return indexer.languages === "*";
    return indexer.languages === "*" || indexer.languages.includes(language);
}
//# sourceMappingURL=language-indexer.js.map