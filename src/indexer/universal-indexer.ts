import { readFileSync } from "node:fs";
import { hashContent } from "./hash.js";
import { indexFileAst } from "./ast-indexer.js";
import { buildLanguageCapability } from "./language.js";
import type { ArtifactKind, AstIndexOptions, AstIndexResult, ImportExportEdgeInput, ScannedFile, SymbolRecord, WarningRecordInput } from "../shared/types.js";

interface ExtractedSymbol {
  name: string;
  fqName?: string;
  kind: SymbolRecord["kind"];
  line: number;
  exported?: boolean;
  signature?: string;
}

interface ExtractedRoute {
  method: string;
  path: string;
}

export function indexScannedFile(absPath: string, file: ScannedFile, options: AstIndexOptions): AstIndexResult {
  if (file.language === "typescript" || file.language === "javascript") {
    return indexFileAst(absPath, file, options);
  }
  return indexFallbackFile(absPath, file, options);
}

function indexFallbackFile(absPath: string, file: ScannedFile, options: AstIndexOptions): AstIndexResult {
  const indexedFile = {
    path: file.path,
    language: file.language,
    moduleId: options.moduleId,
    hash: file.hash,
    sizeBytes: file.sizeBytes,
    lineCount: 0,
    isTest: file.isTest,
    isGenerated: file.isGenerated,
    lastIndexedAt: new Date().toISOString()
  };
  try {
    const content = readFileSync(absPath, "utf8");
    const lines = content.split(/\r?\n/);
    indexedFile.lineCount = lines.length;
    const symbols = uniqueSymbols(extractSymbols(file.language, lines), options.fileId);
    const imports = extractImports(file.language, lines);
    const routes = extractRoutes(file.language, lines).map((route) => ({ ...route, moduleId: options.moduleId ?? undefined }));
    const hasStructure = symbols.length > 0 || imports.length > 0 || routes.length > 0;
    return {
      file: { ...indexedFile, analysis: undefined },
      symbols,
      imports,
      routes,
      testLinks: [],
      warnings: [],
      capability: buildLanguageCapability(file.language, {
        parser: `pattern:${file.language ?? "unknown"}`,
        tier: hasStructure ? "structural" : "fallback",
        symbols: symbols.length > 0,
        dependencies: imports.length > 0,
        tests: true,
        routes: routes.length > 0,
        diagnostics: false,
        degradedReason: hasStructure ? null : "no_structural_patterns_matched"
      })
    };
  } catch (error) {
    const warning: WarningRecordInput = {
      warningType: "parse_error",
      severity: "warning",
      moduleId: options.moduleId ?? undefined,
      fileId: options.fileId,
      message: `Failed to parse ${file.path}: ${error instanceof Error ? error.message : "unknown"}`,
      source: "parser",
      confidence: 1
    };
    return {
      file: indexedFile,
      symbols: [],
      imports: [],
      routes: [],
      testLinks: [],
      warnings: [warning],
      capability: buildLanguageCapability(file.language, {
        parser: "pattern",
        tier: "fallback",
        symbols: false,
        dependencies: false,
        tests: false,
        routes: false,
        diagnostics: false,
        toolStatus: "failed",
        degradedReason: "read_or_parse_error"
      })
    };
  }
}

function extractSymbols(language: string | null, lines: string[]): ExtractedSymbol[] {
  switch (language) {
    case "python":
      return regexSymbols(lines, [
        [/^\s*class\s+([A-Za-z_]\w*)\b/, "class"],
        [/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/, "function"]
      ]);
    case "go":
      return regexSymbols(lines, [
        [/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(/, "function"],
        [/^\s*type\s+([A-Za-z_]\w*)\s+struct\b/, "class"],
        [/^\s*type\s+([A-Za-z_]\w*)\s+interface\b/, "interface"]
      ]);
    case "java":
    case "kotlin":
    case "scala":
      return regexSymbols(lines, [
        [/^\s*(?:public|private|protected|internal|abstract|final|open|data|sealed|static|\s)*class\s+([A-Za-z_]\w*)\b/, "class"],
        [/^\s*(?:public|private|protected|internal|abstract|sealed|\s)*interface\s+([A-Za-z_]\w*)\b/, "interface"],
        [/^\s*(?:public|private|protected|internal|static|final|suspend|\s)*(?:fun|void|[A-Za-z_][\w<>, ?.[\]]+)\s+([A-Za-z_]\w*)\s*\(/, "function"]
      ]);
    case "csharp":
      return regexSymbols(lines, [
        [/^\s*(?:public|private|protected|internal|abstract|sealed|static|partial|\s)*class\s+([A-Za-z_]\w*)\b/, "class"],
        [/^\s*(?:public|private|protected|internal|\s)*interface\s+([A-Za-z_]\w*)\b/, "interface"],
        [/^\s*(?:public|private|protected|internal|static|async|virtual|override|\s)+[A-Za-z_][\w<>, ?.[\]]+\s+([A-Za-z_]\w*)\s*\(/, "function"]
      ]);
    case "php":
      return regexSymbols(lines, [
        [/^\s*(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)\b/, "class"],
        [/^\s*interface\s+([A-Za-z_]\w*)\b/, "interface"],
        [/^\s*(?:public|private|protected)?\s*function\s+([A-Za-z_]\w*)\s*\(/, "function"]
      ]);
    case "ruby":
      return regexSymbols(lines, [
        [/^\s*class\s+([A-Z]\w*)\b/, "class"],
        [/^\s*module\s+([A-Z]\w*)\b/, "module"],
        [/^\s*def\s+([A-Za-z_]\w*[!?=]?)\b/, "function"]
      ]);
    case "rust":
      return regexSymbols(lines, [
        [/^\s*(?:pub\s+)?(?:struct|enum)\s+([A-Za-z_]\w*)\b/, "class"],
        [/^\s*(?:pub\s+)?trait\s+([A-Za-z_]\w*)\b/, "interface"],
        [/^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)\s*\(/, "function"]
      ]);
    case "c":
    case "cpp":
    case "objective-c":
      return regexSymbols(lines, [
        [/^\s*(?:class|struct)\s+([A-Za-z_]\w*)\b/, "class"],
        [/^\s*(?:template\s*<[^>]+>\s*)?(?:[A-Za-z_][\w:*<>,\s&]+)\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*\{?$/, "function"]
      ]);
    case "swift":
      return regexSymbols(lines, [
        [/^\s*(?:public|private|internal|open|final|\s)*class\s+([A-Za-z_]\w*)\b/, "class"],
        [/^\s*(?:public|private|internal|open|\s)*protocol\s+([A-Za-z_]\w*)\b/, "interface"],
        [/^\s*(?:public|private|internal|static|\s)*func\s+([A-Za-z_]\w*)\s*\(/, "function"]
      ]);
    case "dart":
      return regexSymbols(lines, [
        [/^\s*class\s+([A-Za-z_]\w*)\b/, "class"],
        [/^\s*(?:Future<[^>]+>|[A-Za-z_][\w<>?]*)\s+([A-Za-z_]\w*)\s*\(/, "function"]
      ]);
    case "r":
      return regexSymbols(lines, [[/^\s*([A-Za-z.][\w.]*)\s*<-\s*function\s*\(/, "function"]]);
    case "lua":
      return regexSymbols(lines, [[/^\s*function\s+([A-Za-z_][\w.:]*)\s*\(/, "function"]]);
    case "elixir":
      return regexSymbols(lines, [
        [/^\s*defmodule\s+([A-Za-z_][\w.?!]*)\s+do\b/, "module"],
        [/^\s*defp?\s+([A-Za-z_][\w_?!]*)\s*(?:\(|do\b)/, "function"]
      ]);
    case "clojure":
      return regexSymbols(lines, [
        [/^\s*\(ns\s+([^) \n]+)/, "module"],
        [/^\s*\(defn?-?\s+([^) \n]+)/, "function"]
      ]);
    case "shell":
    case "powershell":
      return regexSymbols(lines, [
        [/^\s*([A-Za-z_][\w-]*)\s*\(\)\s*\{/, "function"],
        [/^\s*function\s+([A-Za-z_][\w-]*)\b/, "function"]
      ]);
    case "sql":
      return regexSymbols(lines, [
        [/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][\w."]*)/i, "table"],
        [/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([A-Za-z_][\w."]*)/i, "function"]
      ]);
    case "html":
      return regexSymbols(lines, [[/^\s*<([a-z][a-z0-9-]*)\b/i, "feature"]]);
    case "css":
      return regexSymbols(lines, [[/^\s*([.#][A-Za-z_-][\w-]*)\s*\{/, "feature"]]);
    default:
      return regexSymbols(lines, [[/^\s*(?:class|function|def|fn|func)\s+([A-Za-z_]\w*)\b/, "function"]]);
  }
}

function regexSymbols(lines: string[], patterns: Array<[RegExp, SymbolRecord["kind"]]>): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const [pattern, kind] of patterns) {
      const match = pattern.exec(line);
      const name = match?.[1]?.replaceAll('"', "");
      if (!name) continue;
      symbols.push({ name, kind: refineKind(name, kind), line: index + 1, exported: isLikelyExported(line), signature: line.trim().slice(0, 500) });
      break;
    }
  }
  return symbols;
}

function uniqueSymbols(items: ExtractedSymbol[], fileId: number): SymbolRecord[] {
  const seen = new Set<string>();
  return items
    .map((item) => {
      const base = `${item.fqName ?? item.name}:${item.kind}`;
      const fqName = seen.has(base) ? `${item.fqName ?? item.name}@${item.line}` : item.fqName ?? item.name;
      seen.add(base);
      const signature = item.signature ?? item.name;
      return {
        fileId,
        fqName,
        name: item.name,
        kind: coerceKind(item.kind),
        exported: Boolean(item.exported),
        startLine: item.line,
        endLine: item.line,
        signature,
        signatureHash: hashContent(signature),
        bodyHash: hashContent(signature)
      };
    })
    .sort((a, b) => a.fqName.localeCompare(b.fqName));
}

function extractImports(language: string | null, lines: string[]): ImportExportEdgeInput[] {
  const edges: ImportExportEdgeInput[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const sourceModule = importSource(language, trimmed);
    if (!sourceModule || !isLocalDependency(sourceModule)) continue;
    edges.push({
      importedName: importedNameFromSource(sourceModule),
      sourceModule,
      edgeKind: "import",
      resolved: false
    });
  }
  return edges;
}

function importSource(language: string | null, line: string): string | null {
  const patterns: RegExp[] =
    language === "python"
      ? [/^from\s+([.\w/]+)\s+import\s+/, /^import\s+([.\w/]+)/]
      : language === "go"
        ? [/^"([^"]+)"$/, /^import\s+"([^"]+)"/]
        : language === "java" || language === "kotlin" || language === "scala"
          ? [/^import\s+([\w.]+);?/]
          : language === "csharp"
            ? [/^using\s+([\w.]+);/]
            : language === "php"
              ? [/^use\s+([^;]+);/]
              : language === "ruby"
                ? [/^require(?:_relative)?\s+["']([^"']+)["']/]
                : language === "rust"
                  ? [/^use\s+([^;]+);/, /^mod\s+([A-Za-z_]\w*);/]
                  : language === "c" || language === "cpp" || language === "objective-c"
                    ? [/^#include\s+["<]([^">]+)[">]/]
                    : language === "swift" || language === "dart"
                      ? [/^import\s+["']?([^"';]+)["']?;?/]
                      : language === "shell"
                        ? [/^(?:source|\.)\s+(.+)$/]
                        : [/^import\s+["']([^"']+)["']/];
  for (const pattern of patterns) {
    const match = pattern.exec(line);
    if (match?.[1]) {
      return match[1].replaceAll("\\", "/");
    }
  }
  return null;
}

function extractRoutes(language: string | null, lines: string[]): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const route = routeFromLine(language, trimmed);
    if (route) routes.push(route);
  }
  return routes.sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}

function routeFromLine(language: string | null, line: string): ExtractedRoute | null {
  if (language === "python") {
    const fastApi = /^@(?:app|router)\.(get|post|put|patch|delete)\(["']([^"']+)["']/.exec(line);
    if (fastApi) return { method: fastApi[1]!.toUpperCase(), path: fastApi[2]! };
    const flask = /^@(?:app|blueprint)\.route\(["']([^"']+)["'](?:,\s*methods=\[["']([A-Z]+)["']\])?/.exec(line);
    if (flask) return { method: flask[2] ?? "GET", path: flask[1]! };
  }
  if (language === "go") {
    const handle = /http\.HandleFunc\(["']([^"']+)["']/.exec(line);
    if (handle) return { method: "ANY", path: handle[1]! };
    const gin = /\.(GET|POST|PUT|PATCH|DELETE)\(["']([^"']+)["']/.exec(line);
    if (gin) return { method: gin[1]!, path: gin[2]! };
  }
  if (language === "java" || language === "kotlin") {
    const spring = /@(Get|Post|Put|Patch|Delete|Request)Mapping\(["']?([^"')]+)["']?/.exec(line);
    if (spring) return { method: spring[1]!.replace("Request", "ANY").replace("Get", "GET").replace("Post", "POST").replace("Put", "PUT").replace("Patch", "PATCH").replace("Delete", "DELETE"), path: spring[2]! };
  }
  if (language === "csharp") {
    const asp = /\[Http(Get|Post|Put|Patch|Delete)(?:\(["']([^"']+)["']\))?\]/.exec(line);
    if (asp) return { method: asp[1]!.toUpperCase(), path: asp[2] ? `/${asp[2]}`.replaceAll("//", "/") : "/" };
  }
  if (language === "ruby") {
    const rails = /^(get|post|put|patch|delete)\s+["']([^"']+)["']/.exec(line);
    if (rails) return { method: rails[1]!.toUpperCase(), path: rails[2]! };
  }
  if (language === "php") {
    const route = /#\[Route\(["']([^"']+)["'](?:,\s*methods:\s*\[["']([A-Z]+)["']\])?/.exec(line);
    if (route) return { method: route[2] ?? "ANY", path: route[1]! };
  }
  return null;
}

function isLocalDependency(sourceModule: string): boolean {
  return sourceModule.startsWith(".") || sourceModule.startsWith("/") || sourceModule.includes("/") || sourceModule.endsWith(".h");
}

function importedNameFromSource(sourceModule: string): string {
  return sourceModule.split("/").filter(Boolean).at(-1)?.replace(/\.[^.]+$/, "") || sourceModule.replaceAll(".", "");
}

function isLikelyExported(line: string): boolean {
  return /\b(export|public|pub|defmodule)\b/.test(line) || /^\s*(class|def|func|function|fn)\b/.test(line);
}

function refineKind(name: string, kind: SymbolRecord["kind"]): SymbolRecord["kind"] {
  if (kind !== "class") return kind;
  if (name.endsWith("Service")) return "service";
  if (name.endsWith("Controller")) return "controller";
  if (name.endsWith("Repository")) return "repository";
  return "class";
}

function coerceKind(kind: SymbolRecord["kind"]): ArtifactKind | "class" | "function" | "method" | "const" | "provider" {
  return kind;
}
