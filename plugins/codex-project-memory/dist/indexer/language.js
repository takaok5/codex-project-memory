import * as linguistLanguages from "linguist-languages";
const TOP_LANGUAGE_IDS = new Set([
    "typescript",
    "javascript",
    "python",
    "go",
    "java",
    "csharp",
    "php",
    "ruby",
    "rust",
    "c",
    "cpp",
    "kotlin",
    "swift",
    "shell",
    "dart",
    "scala",
    "r",
    "lua",
    "elixir",
    "clojure",
    "sql",
    "html",
    "css"
]);
const ANALYZERS = {
    typescript: "typescript-language-server",
    javascript: "typescript-language-server",
    python: "pyright",
    go: "gopls",
    java: "jdtls",
    csharp: "omnisharp",
    rust: "rust-analyzer",
    c: "clangd",
    cpp: "clangd",
    lua: "lua-language-server",
    clojure: "clojure-lsp",
    html: "vscode-html-language-server",
    css: "vscode-css-language-server",
    php: "intelephense",
    shell: "bash-language-server",
    dockerfile: "docker-langserver"
};
const EXCLUDED_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".rst", ".adoc"]);
const ID_OVERRIDES = {
    "C#": "csharp",
    "C++": "cpp",
    "F#": "fsharp",
    "Objective-C": "objective-c",
    "Objective-C++": "objective-cpp",
    "PowerShell": "powershell",
    "Makefile": "make",
    "Dockerfile": "dockerfile",
    "TypeScript": "typescript",
    "TSX": "typescript",
    "JavaScript": "javascript",
    "Glimmer JS": "javascript",
    "Glimmer TS": "typescript",
    "HTML+PHP": "html",
    "HTML+ERB": "html",
    "HTML+EEX": "html",
    "HTML+Razor": "html",
    "SCSS": "css",
    "Sass": "css",
    "Less": "css"
};
const MANUAL_OVERRIDES = [
    language("typescript", "TypeScript", [".ts", ".tsx", ".mts", ".cts"], { analyzer: ANALYZERS.typescript, detector: "pmem-override" }),
    language("javascript", "JavaScript", [".js", ".jsx", ".mjs", ".cjs"], { analyzer: ANALYZERS.javascript, detector: "pmem-override" }),
    language("python", "Python", [".py", ".pyi", ".pyw"], { filenames: ["SConscript", "SConstruct"], analyzer: ANALYZERS.python, detector: "pmem-override" }),
    language("go", "Go", [".go"], { analyzer: ANALYZERS.go, detector: "pmem-override" }),
    language("java", "Java", [".java"], { analyzer: ANALYZERS.java, detector: "pmem-override" }),
    language("csharp", "C#", [".cs", ".csx"], { analyzer: ANALYZERS.csharp, detector: "pmem-override" }),
    language("php", "PHP", [".php", ".phtml"], { analyzer: ANALYZERS.php, detector: "pmem-override" }),
    language("ruby", "Ruby", [".rb", ".rake"], { filenames: ["Gemfile", "Rakefile"], detector: "pmem-override" }),
    language("rust", "Rust", [".rs"], { analyzer: ANALYZERS.rust, detector: "pmem-override" }),
    language("c", "C", [".c", ".h"], { analyzer: ANALYZERS.c, detector: "pmem-override" }),
    language("cpp", "C++", [".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx"], { analyzer: ANALYZERS.cpp, detector: "pmem-override" }),
    language("kotlin", "Kotlin", [".kt", ".kts"], { detector: "pmem-override" }),
    language("swift", "Swift", [".swift"], { detector: "pmem-override" }),
    language("shell", "Shell", [".sh", ".bash", ".zsh", ".fish", ".ksh"], { filenames: [".bashrc", ".zshrc"], analyzer: ANALYZERS.shell, detector: "pmem-override" }),
    language("dart", "Dart", [".dart"], { detector: "pmem-override" }),
    language("scala", "Scala", [".scala", ".sc"], { detector: "pmem-override" }),
    language("r", "R", [".r", ".R"], { detector: "pmem-override" }),
    language("lua", "Lua", [".lua"], { analyzer: ANALYZERS.lua, detector: "pmem-override" }),
    language("elixir", "Elixir", [".ex", ".exs"], { detector: "pmem-override" }),
    language("clojure", "Clojure", [".clj", ".cljs", ".cljc", ".edn"], { analyzer: ANALYZERS.clojure, detector: "pmem-override" }),
    language("sql", "SQL", [".sql"], { detector: "pmem-override" }),
    language("html", "HTML", [".html", ".htm"], { analyzer: ANALYZERS.html, detector: "pmem-override" }),
    language("css", "CSS", [".css", ".scss", ".sass", ".less"], { analyzer: ANALYZERS.css, detector: "pmem-override" })
];
const LANGUAGES = buildLanguageRegistry();
const EXTENSION_INDEX = new Map();
const FILENAME_INDEX = new Map();
const ID_INDEX = new Map();
for (const item of LANGUAGES) {
    ID_INDEX.set(item.id, item);
    for (const extension of item.extensions) {
        if (EXCLUDED_EXTENSIONS.has(extension.toLowerCase()))
            continue;
        if (!EXTENSION_INDEX.has(extension.toLowerCase())) {
            EXTENSION_INDEX.set(extension.toLowerCase(), item);
        }
    }
    for (const filename of item.filenames ?? []) {
        if (!FILENAME_INDEX.has(filename.toLowerCase())) {
            FILENAME_INDEX.set(filename.toLowerCase(), item);
        }
    }
}
export function classifyLanguage(filePath) {
    return detectLanguage(filePath)?.id ?? null;
}
export function detectLanguage(filePath) {
    const normalized = filePath.replaceAll("\\", "/");
    const fileName = normalized.split("/").at(-1) ?? normalized;
    const byName = FILENAME_INDEX.get(fileName.toLowerCase());
    if (byName)
        return byName;
    const extension = extensionOf(fileName);
    return extension ? EXTENSION_INDEX.get(extension.toLowerCase()) ?? null : null;
}
export function getLanguageMetadata(filePathOrLanguage) {
    const byId = ID_INDEX.get(filePathOrLanguage.toLowerCase());
    if (byId)
        return byId;
    return detectLanguage(filePathOrLanguage);
}
export function listKnownLanguages() {
    return [...LANGUAGES].sort((a, b) => a.id.localeCompare(b.id));
}
export function isLanguageEnabled(language, config) {
    if (!language)
        return false;
    const enabled = new Set(config.scan.languages.map((item) => item.toLowerCase()));
    return enabled.has("*") || enabled.has(language.toLowerCase());
}
export function buildLanguageCapability(language, options) {
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
export function isTopLanguage(language) {
    return Boolean(language && TOP_LANGUAGE_IDS.has(language));
}
export function isTestFile(filePath) {
    const path = filePath.replaceAll("\\", "/");
    return (/(^|\/)(test|tests|__tests__|spec|specs)\//i.test(path) ||
        /\.(spec|test|e2e|integration)\.[^.]+$/i.test(path) ||
        /(_test\.go|Test\.java|Tests?\.cs|_spec\.rb|_test\.rb|Test\.php)$/i.test(path));
}
export function isGeneratedFile(filePath) {
    const path = filePath.replaceAll("\\", "/").toLowerCase();
    const fileName = path.split("/").at(-1) ?? path;
    return (path.includes("/generated/") ||
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
        fileName.endsWith(".d.ts"));
}
function buildLanguageRegistry() {
    const byId = new Map();
    for (const item of MANUAL_OVERRIDES) {
        byId.set(item.id, item);
    }
    for (const item of Object.values(linguistLanguages)) {
        if (!isSourceLanguage(item))
            continue;
        const id = normalizeLanguageId(item.name);
        if (!id || byId.has(id))
            continue;
        byId.set(id, language(id, item.name, [...(item.extensions ?? [])].filter((extension) => !EXCLUDED_EXTENSIONS.has(extension.toLowerCase())), {
            filenames: [...(item.filenames ?? [])],
            analyzer: ANALYZERS[id],
            detector: "linguist-languages"
        }));
    }
    return [...byId.values()];
}
function isSourceLanguage(language) {
    return language.type === "programming" || language.type === "markup" || language.name === "SQL";
}
function normalizeLanguageId(name) {
    const override = ID_OVERRIDES[name];
    if (override)
        return override;
    return name
        .toLowerCase()
        .replace(/\+/g, "p")
        .replace(/#/g, "sharp")
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
function language(id, displayName, extensions, options = {}) {
    return {
        id,
        displayName,
        extensions,
        filenames: options.filenames,
        analyzer: options.analyzer,
        topLanguage: options.topLanguage ?? TOP_LANGUAGE_IDS.has(id),
        detector: options.detector ?? "linguist-languages"
    };
}
function extensionOf(fileName) {
    const match = /\.[^.]+$/.exec(fileName);
    return match?.[0] ?? null;
}
//# sourceMappingURL=language.js.map