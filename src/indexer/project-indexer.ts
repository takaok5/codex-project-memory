import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { PmemError } from "../shared/errors.js";
import { nowIso } from "../shared/time.js";
import type { ImportExportEdgeInput, IndexOptions, IndexResult, RouteRecordInput, RuntimeContext, SymbolRecord, WarningRecordInput } from "../shared/types.js";
import { getFileByPath, listFiles, removeFileRecordCascade, upsertFileRecord } from "../store/file-repository.js";
import { replaceEdgesForFile } from "../store/edge-repository.js";
import { upsertLanguageCapability } from "../store/language-capability-repository.js";
import { upsertInferredModule } from "../store/module-repository.js";
import { markMemoryFresh, setProjectStateValue } from "../store/project-state-repository.js";
import { replaceRoutesForFile } from "../store/route-repository.js";
import { searchSymbols, replaceSymbolsForFile } from "../store/symbol-repository.js";
import { replaceTestLinksForFile } from "../store/test-repository.js";
import { addWarning, listActiveWarnings, replaceWarningsForFile } from "../store/warning-repository.js";
import { scanProjectFiles } from "./scan.js";
import { inferModuleId } from "./module-inference.js";
import { buildLanguageCapability } from "./language.js";
import { resolveLanguageToolCapability } from "./language-tools.js";
import { indexScannedFile } from "./universal-indexer.js";
import { resolveSymbolEdges } from "./dependency-graph.js";
import { inferTestTargets } from "./test-adjacency.js";
import type { MemoryDb } from "../store/sqlite.js";

export async function indexProject(ctx: RuntimeContext, options: IndexOptions = {}): Promise<IndexResult> {
  if (!ctx.db) {
    throw new PmemError("DB_ERROR", "Index requires an open database.");
  }
  const db = ctx.db as MemoryDb;
  const scanned = await scanProjectFiles(ctx.projectRoot, ctx.config);
  const existing = listFiles(db);
  const scannedPaths = new Set(scanned.map((file) => file.path));
  let indexedFiles = 0;
  let skippedFiles = 0;
  let deletedFiles = 0;
  let warningCount = 0;
  const pendingImports: ImportExportEdgeInput[] = [];
  const pendingRoutes: Array<{ fileId: number; routes: RouteRecordInput[] }> = [];
  const touchedFileIds = new Set<number>();
  const capabilityByLanguage = new Map<string, ReturnType<typeof resolveLanguageToolCapability>>();

  for (const oldFile of existing) {
    if (!scannedPaths.has(oldFile.path)) {
      removeFileRecordCascade(db, oldFile.path);
      deletedFiles += 1;
    }
  }

  for (const scannedFile of scanned) {
    const moduleId = inferModuleId(scannedFile.path, ctx.config);
    upsertInferredModule(db, moduleId);
    const existingFile = getFileByPath(db, scannedFile.path);
    if (options.changedOnly && existingFile?.hash === scannedFile.hash) {
      skippedFiles += 1;
      continue;
    }
    const fileId = upsertFileRecord(db, {
      path: scannedFile.path,
      language: scannedFile.language,
      moduleId,
      hash: scannedFile.hash,
      sizeBytes: scannedFile.sizeBytes,
      lineCount: 0,
      isTest: scannedFile.isTest,
      isGenerated: scannedFile.isGenerated,
      lastIndexedAt: nowIso()
    });
    touchedFileIds.add(fileId);
    if (scannedFile.sizeBytes > ctx.config.scan.maxFileBytes) {
      const warning = fileTooLargeWarning(fileId, moduleId, scannedFile.path);
      const capability = buildLanguageCapability(scannedFile.language, {
        parser: "skipped",
        tier: "fallback",
        symbols: false,
        dependencies: false,
        tests: scannedFile.isTest,
        routes: false,
        diagnostics: false,
        toolStatus: "disabled",
        degradedReason: "file_too_large"
      });
      const resolvedCapability = resolveCapabilityForRun(ctx, capabilityByLanguage, scannedFile.language, capability);
      upsertFileRecord(db, {
        path: scannedFile.path,
        language: scannedFile.language,
        moduleId,
        hash: scannedFile.hash,
        sizeBytes: scannedFile.sizeBytes,
        lineCount: 0,
        isTest: scannedFile.isTest,
        isGenerated: scannedFile.isGenerated,
        lastIndexedAt: nowIso(),
        analysis: resolvedCapability
      });
      upsertLanguageCapability(db, resolvedCapability);
      replaceSymbolsForFile(db, fileId, []);
      replaceWarningsForFile(db, fileId, "indexer", [warning]);
      warningCount += 1;
      indexedFiles += 1;
      continue;
    }
    const ast = indexScannedFile(scannedFile.absPath, scannedFile, { fileId, moduleId });
    if (ast.capability) {
      const resolvedCapability = resolveCapabilityForRun(ctx, capabilityByLanguage, scannedFile.language, ast.capability);
      upsertFileRecord(db, { ...ast.file, id: fileId, analysis: resolvedCapability });
      upsertLanguageCapability(db, resolvedCapability);
    }
    replaceSymbolsForFile(db, fileId, ast.symbols);
    pendingImports.push(...ast.imports.map((item) => ({ ...item, fromFileId: fileId })));
    pendingRoutes.push({ fileId, routes: ast.routes });
    replaceWarningsForFile(db, fileId, "parser", ast.warnings.filter((warning) => warning.source === "parser"));
    warningCount += ast.warnings.length;
    indexedFiles += 1;
  }

  const filesAfterSymbols = listFiles(db);
  const symbolsAfterInsert = searchSymbols(db, {});

  for (const item of pendingRoutes) {
    const sourceFile = filesAfterSymbols.find((file) => file.id === item.fileId);
    const routes = item.routes.map((route) => {
      const handler = sourceFile ? symbolsAfterInsert.find((symbol) => symbol.fileId === sourceFile.id && `${symbol.fqName}`.endsWith(`.${handlerNameFromRoute(route.path)}`)) : undefined;
      return { ...route, handlerSymbolId: handler?.id, moduleId: sourceFile?.moduleId ?? undefined };
    });
    replaceRoutesForFile(db, item.fileId, routes);
  }

  for (const file of filesAfterSymbols.filter((item) => item.id && touchedFileIds.has(item.id))) {
    replaceEdgesForFile(db, file.id!, []);
  }
  const resolved = resolveSymbolEdges(db, pendingImports);
  const importsByFile = new Map<number, typeof resolved.edges>();
  for (const edge of resolved.edges) {
    const sourceFileId = sourceFileIdForEdge(symbolsAfterInsert, edge.fromSymbolId);
    if (!sourceFileId) continue;
    importsByFile.set(sourceFileId, [...(importsByFile.get(sourceFileId) ?? []), edge]);
  }
  for (const [fileId, edges] of importsByFile) {
    replaceEdgesForFile(db, fileId, edges);
  }
  for (const warning of resolved.warnings) {
    addWarning(db, warning);
  }

  const testLinks = inferTestTargets(filesAfterSymbols, searchSymbols(db, {}));
  for (const file of filesAfterSymbols.filter((item) => item.isTest && item.id)) {
    replaceTestLinksForFile(db, file.id!, testLinks.filter((link) => link.fileId === file.id));
  }

  markMemoryFresh(db, nowIso());
  setProjectStateValue(db, "indexer_version", "0.3.0");
  return {
    scannedFiles: scanned.length,
    indexedFiles,
    skippedFiles,
    deletedFiles,
    warningCount: listActiveWarnings(db).length,
    status: "fresh"
  };
}

function resolveCapabilityForRun(
  ctx: RuntimeContext,
  cache: Map<string, ReturnType<typeof resolveLanguageToolCapability>>,
  language: string | null,
  capability: NonNullable<ReturnType<typeof indexScannedFile>["capability"]>
): ReturnType<typeof resolveLanguageToolCapability> {
  const key = language ?? "unknown";
  const cached = cache.get(key);
  if (cached) {
    return { ...capability, tool: cached.tool, toolStatus: cached.toolStatus, diagnostics: cached.diagnostics, degradedReason: cached.degradedReason };
  }
  const resolved = resolveLanguageToolCapability(ctx, language, capability);
  cache.set(key, resolved);
  return resolved;
}

export async function indexChangedFiles(ctx: RuntimeContext): Promise<IndexResult> {
  return indexProject(ctx, { changedOnly: true });
}

function fileTooLargeWarning(fileId: number, moduleId: string, filePath: string): WarningRecordInput {
  return {
    warningType: "file_too_large",
    severity: "warning",
    fileId,
    moduleId,
    message: `File too large: ${filePath}`,
    source: "indexer",
    confidence: 1
  };
}

function sourceFileIdForEdge(symbols: SymbolRecord[], fromSymbolId: number): number | null {
  return symbols.find((symbol) => symbol.id === fromSymbolId)?.fileId ?? null;
}

function handlerNameFromRoute(routePath: string): string {
  const last = routePath.split("/").filter(Boolean).at(-1) ?? "";
  if (last === "open") return "open";
  if (last === "me") return "me";
  return last;
}
