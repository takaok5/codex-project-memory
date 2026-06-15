import type { LanguageCapability, LanguageId, LanguageToolStatus, ProjectMemoryConfig } from "../shared/types.js";

export interface LanguageMetadata {
  id: LanguageId;
  displayName: string;
  extensions: string[];
  filenames?: string[];
  topLanguage: boolean;
  analyzer?: string;
}

const LANGUAGES: LanguageMetadata[] = [
  language("typescript", "TypeScript", [".ts", ".tsx", ".mts", ".cts"], { analyzer: "typescript-language-server" }),
  language("javascript", "JavaScript", [".js", ".jsx", ".mjs", ".cjs"], { analyzer: "typescript-language-server" }),
  language("python", "Python", [".py", ".pyi", ".pyw"], { analyzer: "pyright" }),
  language("go", "Go", [".go"], { analyzer: "gopls" }),
  language("java", "Java", [".java"], { analyzer: "jdtls" }),
  language("csharp", "C#", [".cs", ".csx"], { analyzer: "omnisharp" }),
  language("php", "PHP", [".php", ".phtml"]),
  language("ruby", "Ruby", [".rb", ".rake"], { filenames: ["Gemfile", "Rakefile"] }),
  language("rust", "Rust", [".rs"], { analyzer: "rust-analyzer" }),
  language("c", "C", [".c", ".h"], { analyzer: "clangd" }),
  language("cpp", "C++", [".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx"], { analyzer: "clangd" }),
  language("kotlin", "Kotlin", [".kt", ".kts"]),
  language("swift", "Swift", [".swift"]),
  language("shell", "Shell", [".sh", ".bash", ".zsh", ".fish", ".ksh"], { filenames: [".bashrc", ".zshrc"] }),
  language("dart", "Dart", [".dart"]),
  language("scala", "Scala", [".scala", ".sc"]),
  language("r", "R", [".r", ".R"]),
  language("lua", "Lua", [".lua"], { analyzer: "lua-language-server" }),
  language("elixir", "Elixir", [".ex", ".exs"]),
  language("clojure", "Clojure", [".clj", ".cljs", ".cljc", ".edn"], { analyzer: "clojure-lsp" }),
  language("sql", "SQL", [".sql"]),
  language("html", "HTML", [".html", ".htm"], { analyzer: "vscode-html-language-server" }),
  language("css", "CSS", [".css", ".scss", ".sass", ".less"], { analyzer: "vscode-css-language-server" }),
  language("objective-c", "Objective-C", [".m", ".mm"]),
  language("perl", "Perl", [".pl", ".pm", ".t"]),
  language("haskell", "Haskell", [".hs", ".lhs"]),
  language("erlang", "Erlang", [".erl", ".hrl"]),
  language("fsharp", "F#", [".fs", ".fsi", ".fsx"]),
  language("ocaml", "OCaml", [".ml", ".mli"]),
  language("zig", "Zig", [".zig"]),
  language("nim", "Nim", [".nim"]),
  language("julia", "Julia", [".jl"]),
  language("powershell", "PowerShell", [".ps1", ".psm1", ".psd1"]),
  language("make", "Make", [".mk", ".mak"], { filenames: ["Makefile", "makefile", "GNUmakefile"] }),
  language("dockerfile", "Dockerfile", [], { filenames: ["Dockerfile", "Containerfile"] })
];

const EXTENSION_INDEX = new Map<string, LanguageMetadata>();
const FILENAME_INDEX = new Map<string, LanguageMetadata>();

for (const item of LANGUAGES) {
  for (const extension of item.extensions) {
    EXTENSION_INDEX.set(extension.toLowerCase(), item);
  }
  for (const filename of item.filenames ?? []) {
    FILENAME_INDEX.set(filename.toLowerCase(), item);
  }
}

export function classifyLanguage(filePath: string): LanguageId | null {
  return getLanguageMetadata(filePath)?.id ?? null;
}

export function getLanguageMetadata(filePathOrLanguage: string): LanguageMetadata | null {
  const normalized = filePathOrLanguage.replaceAll("\\", "/");
  const fileName = normalized.split("/").at(-1) ?? normalized;
  const byName = FILENAME_INDEX.get(fileName.toLowerCase());
  if (byName) return byName;
  const direct = LANGUAGES.find((item) => item.id === filePathOrLanguage);
  if (direct) return direct;
  const extension = extensionOf(fileName);
  return extension ? EXTENSION_INDEX.get(extension.toLowerCase()) ?? null : null;
}

export function listKnownLanguages(): LanguageMetadata[] {
  return [...LANGUAGES].sort((a, b) => a.id.localeCompare(b.id));
}

export function isLanguageEnabled(language: LanguageId | null, config: ProjectMemoryConfig): boolean {
  if (!language) return false;
  const enabled = new Set(config.scan.languages.map((item) => item.toLowerCase()));
  return enabled.has("*") || enabled.has(language.toLowerCase());
}

export function buildLanguageCapability(
  language: LanguageId | null,
  options: {
    parser: string;
    tier: LanguageCapability["tier"];
    symbols: boolean;
    dependencies: boolean;
    tests: boolean;
    routes: boolean;
    diagnostics?: boolean;
    toolStatus?: LanguageToolStatus;
    degradedReason?: string | null;
  }
): LanguageCapability {
  const metadata = language ? getLanguageMetadata(language) : null;
  return {
    language: language ?? "unknown",
    displayName: metadata?.displayName ?? "Unknown",
    tier: options.tier,
    parser: options.parser,
    symbols: options.symbols,
    dependencies: options.dependencies,
    tests: options.tests,
    routes: options.routes,
    diagnostics: options.diagnostics ?? false,
    tool: metadata?.analyzer ?? null,
    toolStatus: options.toolStatus ?? (metadata?.analyzer ? "missing" : "unsupported"),
    degradedReason: options.degradedReason ?? null
  };
}

export function isTopLanguage(language: LanguageId | null): boolean {
  return Boolean(language && getLanguageMetadata(language)?.topLanguage);
}

export function isTestFile(filePath: string): boolean {
  const path = filePath.replaceAll("\\", "/");
  return (
    /(^|\/)(test|tests|__tests__|spec|specs)\//i.test(path) ||
    /\.(spec|test|e2e|integration)\.[^.]+$/i.test(path) ||
    /(_test\.go|Test\.java|Tests?\.cs|_spec\.rb|_test\.rb|Test\.php)$/i.test(path)
  );
}

export function isGeneratedFile(filePath: string): boolean {
  const path = filePath.replaceAll("\\", "/").toLowerCase();
  const fileName = path.split("/").at(-1) ?? path;
  return (
    path.includes("/generated/") ||
    path.includes("/gen/") ||
    path.includes("/vendor/") ||
    fileName.endsWith(".generated.ts") ||
    fileName.endsWith(".generated.js") ||
    fileName.endsWith(".generated.py") ||
    fileName.endsWith(".gen.ts") ||
    fileName.endsWith(".gen.go") ||
    fileName.endsWith(".pb.go") ||
    fileName.endsWith(".designer.cs") ||
    fileName.endsWith(".g.cs") ||
    fileName.endsWith(".min.js") ||
    fileName.endsWith(".min.css") ||
    fileName.endsWith(".d.ts")
  );
}

function language(
  id: LanguageId,
  displayName: string,
  extensions: string[],
  options: { filenames?: string[]; analyzer?: string; topLanguage?: boolean } = {}
): LanguageMetadata {
  return { id, displayName, extensions, filenames: options.filenames, analyzer: options.analyzer, topLanguage: options.topLanguage ?? true };
}

function extensionOf(fileName: string): string | null {
  const match = /\.[^.]+$/.exec(fileName);
  return match?.[0] ?? null;
}
