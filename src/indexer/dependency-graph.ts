import path from "node:path";
import { normalizePathSeparators } from "../shared/path.js";
import type { ImportExportEdgeInput, ResolvedSymbolEdgeInput, WarningRecordInput } from "../shared/types.js";
import { getFileByPath, listFiles } from "../store/file-repository.js";
import { searchSymbols } from "../store/symbol-repository.js";
import type { MemoryDb } from "../store/sqlite.js";

const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", "/index.ts", "/index.tsx", "/index.js", "/index.jsx", "/index.mts", "/index.cts"];

export function resolveSymbolEdges(db: MemoryDb, imports: ImportExportEdgeInput[]): { edges: ResolvedSymbolEdgeInput[]; warnings: WarningRecordInput[] } {
  const edges: ResolvedSymbolEdgeInput[] = [];
  const warnings: WarningRecordInput[] = [];
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

function resolveTargetPath(sourceFilePath: string, sourceModule: string, filePaths: Set<string>): string | null {
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

function unresolvedWarning(fileId: number | undefined, moduleId: string | undefined, sourceModule: string): WarningRecordInput {
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
