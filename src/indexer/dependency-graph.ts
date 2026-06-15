import path from "node:path";
import { normalizePathSeparators } from "../shared/path.js";
import type { ImportExportEdgeInput, ResolvedSymbolEdgeInput, WarningRecordInput } from "../shared/types.js";
import { getFileByPath, listFiles } from "../store/file-repository.js";
import { searchSymbols } from "../store/symbol-repository.js";
import type { MemoryDb } from "../store/sqlite.js";

const EXTENSIONS = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".py",
  ".go",
  ".java",
  ".cs",
  ".php",
  ".rb",
  ".rs",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".kt",
  ".swift",
  ".dart",
  ".scala",
  ".r",
  ".lua",
  ".ex",
  ".clj",
  ".sql",
  ".html",
  ".css",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
  "/__init__.py",
  "/mod.rs"
];

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
  const normalizedModule = normalizeModuleSpecifier(sourceModule);
  const base = normalizePathSeparators(path.posix.normalize(path.posix.join(sourceDir, normalizedModule)));
  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (filePaths.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function normalizeModuleSpecifier(sourceModule: string): string {
  if (sourceModule.startsWith("./") || sourceModule.startsWith("../")) {
    return sourceModule;
  }
  if (sourceModule.startsWith(".")) {
    return `./${sourceModule.replace(/^\.+/, "").replaceAll(".", "/")}`;
  }
  return sourceModule.replaceAll("\\", "/");
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
