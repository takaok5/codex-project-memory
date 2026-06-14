import path from "node:path";
import { normalizePathSeparators } from "../shared/path.js";
import { getFileByPath, listFiles } from "../store/file-repository.js";
import { searchSymbols } from "../store/symbol-repository.js";
const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", "/index.ts", "/index.tsx", "/index.js", "/index.jsx", "/index.mts", "/index.cts"];
export function resolveSymbolEdges(db, imports) {
    const edges = [];
    const warnings = [];
    const files = listFiles(db);
    const filePaths = new Set(files.map((file) => file.path));
    for (const item of imports) {
        const sourceFile = item.fromFileId ? files.find((file) => file.id === item.fromFileId) : undefined;
        if (!sourceFile || !item.sourceModule.startsWith(".")) {
            warnings.push(unresolvedWarning(sourceFile?.id, sourceFile?.moduleId ?? undefined, item.sourceModule));
            continue;
        }
        const targetPath = resolveTargetPath(sourceFile.path, item.sourceModule, filePaths);
        if (!targetPath) {
            warnings.push(unresolvedWarning(sourceFile.id, sourceFile.moduleId ?? undefined, item.sourceModule));
            continue;
        }
        const targetFile = getFileByPath(db, targetPath);
        if (!targetFile?.id) {
            warnings.push(unresolvedWarning(sourceFile.id, sourceFile.moduleId ?? undefined, item.sourceModule));
            continue;
        }
        const from = searchSymbols(db, { filePath: sourceFile.path }).find((symbol) => symbol.kind !== "method");
        const to = searchSymbols(db, { filePath: targetPath }).find((symbol) => symbol.name === item.importedName || symbol.fqName === item.importedName);
        if (!from?.id && sourceFile.isTest) {
            continue;
        }
        if (!from?.id || !to?.id) {
            warnings.push(unresolvedWarning(sourceFile.id, sourceFile.moduleId ?? undefined, item.sourceModule));
            continue;
        }
        edges.push({ fromSymbolId: from.id, toSymbolId: to.id, edgeKind: item.edgeKind, confidence: 1 });
    }
    return { edges, warnings };
}
function resolveTargetPath(sourceFilePath, sourceModule, filePaths) {
    const sourceDir = path.posix.dirname(sourceFilePath);
    const base = normalizePathSeparators(path.posix.normalize(path.posix.join(sourceDir, sourceModule)));
    for (const extension of EXTENSIONS) {
        const candidate = `${base}${extension}`;
        if (filePaths.has(candidate)) {
            return candidate;
        }
    }
    return null;
}
function unresolvedWarning(fileId, moduleId, sourceModule) {
    return {
        warningType: "unresolved_import",
        severity: "warning",
        fileId,
        moduleId,
        message: `Unresolved import: ${sourceModule}`,
        source: "indexer",
        confidence: 1
    };
}
//# sourceMappingURL=dependency-graph.js.map