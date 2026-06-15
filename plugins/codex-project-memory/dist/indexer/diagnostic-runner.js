import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveLanguageTool } from "./language-tools.js";
import { getFileByPath, listFiles } from "../store/file-repository.js";
import { listDiagnostics, replaceDiagnosticsForFile, replaceDiagnosticsForLanguages } from "../store/diagnostic-repository.js";
import { addWarning, resolveWarningsForFile } from "../store/warning-repository.js";
export function runDiagnosticAnalysis(ctx, options = {}) {
    const db = ctx.db;
    const requestedLanguages = new Set(options.languages?.map((item) => item.toLowerCase()));
    const requestedFiles = new Set(options.filePaths?.map((item) => item.replaceAll("\\", "/")));
    if (options.filePaths && requestedFiles.size === 0) {
        return diagnosticsOutput([], listDiagnostics(db, { limit: 500 }).filter((diagnostic) => !requestedLanguages.size || requestedLanguages.has(diagnostic.language)), new Set(), new Set());
    }
    const files = listFiles(db).filter((file) => {
        if (!file.language)
            return false;
        if (requestedLanguages.size && !requestedLanguages.has(file.language))
            return false;
        if (requestedFiles.size && !requestedFiles.has(file.path))
            return false;
        return !file.isGenerated;
    });
    const byLanguage = groupByLanguage(files);
    const diagnostics = [];
    const failedTools = new Set();
    const degradedLanguages = new Set();
    for (const [language, languageFiles] of byLanguage) {
        const resolved = resolveLanguageTool(ctx, language, { allowInstall: options.allowInstall });
        const firstPath = languageFiles[0]?.path ?? `${language}/diagnostics`;
        if (!resolved) {
            diagnostics.push(degradedDiagnostic(language, firstPath, "pmem-diagnostics", "unsupported_language", "No diagnostic tool registered for this language."));
            degradedLanguages.add(language);
            continue;
        }
        if (resolved.status !== "available" || !resolved.executable) {
            diagnostics.push(degradedDiagnostic(language, firstPath, resolved.definition.tool, resolved.status, resolved.degradedReason ?? `language_tool_${resolved.status}`));
            if (resolved.status === "failed")
                failedTools.add(resolved.definition.tool);
            degradedLanguages.add(language);
            continue;
        }
        if (resolved.definition.runStrategy === "unsupported") {
            diagnostics.push(degradedDiagnostic(language, firstPath, resolved.definition.tool, "unsupported_runner", "Diagnostic runner is not implemented for this language/tool pair yet."));
            degradedLanguages.add(language);
            continue;
        }
        const run = runToolDiagnostics({
            ctx,
            language,
            files: languageFiles,
            executable: resolved.executable,
            toolName: resolved.definition.tool,
            timeoutMs: resolved.definition.timeoutMs ?? ctx.config.languageTools?.runTimeoutMs ?? 30000
        }, resolved.definition.runStrategy);
        diagnostics.push(...run);
        if (run.some((item) => item.code === "tool_run_failed" || item.code === "tool_timeout")) {
            failedTools.add(resolved.definition.tool);
            degradedLanguages.add(language);
        }
    }
    if (requestedFiles.size) {
        for (const file of files) {
            replaceDiagnosticsForFile(db, file.path, diagnostics.filter((diagnostic) => diagnostic.filePath === file.path));
            resolveWarningsForFile(db, file.id, "diagnostic");
        }
    }
    else {
        const languages = [...byLanguage.keys()];
        replaceDiagnosticsForLanguages(db, languages, diagnostics);
        for (const file of files) {
            if (file.id)
                resolveWarningsForFile(db, file.id, "diagnostic");
        }
    }
    for (const diagnostic of diagnostics.filter((item) => item.severity === "error")) {
        const file = getFileByPath(db, diagnostic.filePath);
        if (!file?.id)
            continue;
        addWarning(db, {
            warningType: "compiler_diagnostic",
            severity: "critical",
            fileId: file.id,
            moduleId: file.moduleId ?? undefined,
            message: `${diagnostic.tool}${diagnostic.code ? ` ${diagnostic.code}` : ""}: ${diagnostic.message}`,
            source: "diagnostic",
            confidence: diagnostic.confidence
        });
    }
    const stored = listDiagnostics(db, { limit: 500 });
    const filtered = stored.filter((diagnostic) => !requestedLanguages.size || requestedLanguages.has(diagnostic.language));
    return diagnosticsOutput([...byLanguage.keys()].sort(), filtered, failedTools, degradedLanguages);
}
function diagnosticsOutput(languages, diagnostics, failedTools, degradedLanguages) {
    return {
        languages,
        diagnostics: diagnostics.map((diagnostic) => ({
            language: diagnostic.language,
            filePath: diagnostic.filePath,
            severity: diagnostic.severity,
            code: diagnostic.code,
            message: diagnostic.message,
            startLine: diagnostic.startLine,
            endLine: diagnostic.endLine,
            source: diagnostic.source,
            tool: diagnostic.tool,
            confidence: diagnostic.confidence
        })),
        summary: {
            total: diagnostics.length,
            errors: diagnostics.filter((item) => item.severity === "error").length,
            warnings: diagnostics.filter((item) => item.severity === "warning").length,
            info: diagnostics.filter((item) => item.severity === "info").length,
            failedTools: [...failedTools].sort(),
            degradedLanguages: [...degradedLanguages].sort()
        }
    };
}
export function parseTypeScriptDiagnostics(output, root, language = "typescript") {
    const diagnostics = [];
    const patterns = [
        /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/,
        /^(.+?):(\d+):(\d+)\s+-\s+(error|warning)\s+(TS\d+):\s+(.+)$/
    ];
    for (const line of output.split(/\r?\n/)) {
        for (const pattern of patterns) {
            const match = pattern.exec(line.trim());
            if (!match)
                continue;
            diagnostics.push({
                language,
                filePath: toRelativeToolPath(root, match[1], `${language}/unknown`),
                severity: match[4] === "error" ? "error" : "warning",
                code: match[5],
                message: match[6],
                startLine: Number(match[2]),
                endLine: Number(match[2]),
                source: "compiler",
                tool: "tsc",
                confidence: 0.95
            });
            break;
        }
    }
    return diagnostics;
}
export function parsePyrightDiagnostics(output, root) {
    try {
        const parsed = JSON.parse(output);
        return (parsed.generalDiagnostics ?? []).map((item) => {
            const range = item.range;
            return {
                language: "python",
                filePath: toRelativeToolPath(root, String(item.file ?? "python/unknown"), "python/unknown"),
                severity: pyrightSeverity(String(item.severity ?? "information")),
                code: item.rule ? String(item.rule) : null,
                message: String(item.message ?? "Pyright diagnostic"),
                startLine: typeof range?.start?.line === "number" ? range.start.line + 1 : null,
                endLine: typeof range?.end?.line === "number" ? range.end.line + 1 : null,
                source: "compiler",
                tool: "pyright",
                confidence: 0.95
            };
        });
    }
    catch {
        return [];
    }
}
export function parseGoDiagnostics(output, root) {
    return parseColonDiagnostics(output, root, "go", "go", /(.+\.go):(\d+):(?:(\d+):)?\s*(.+)/);
}
export function parseRustDiagnostics(output, root) {
    const diagnostics = [];
    for (const line of output.split(/\r?\n/)) {
        if (!line.trim().startsWith("{"))
            continue;
        try {
            const parsed = JSON.parse(line);
            if (parsed.reason !== "compiler-message" || !parsed.message)
                continue;
            const span = parsed.message.spans?.find((item) => item.is_primary) ?? parsed.message.spans?.[0];
            diagnostics.push({
                language: "rust",
                filePath: toRelativeToolPath(root, span?.file_name ?? "rust/unknown", "rust/unknown"),
                severity: parsed.message.level === "error" ? "error" : parsed.message.level === "warning" ? "warning" : "info",
                code: parsed.message.code?.code ?? null,
                message: parsed.message.message ?? "Rust diagnostic",
                startLine: span?.line_start ?? null,
                endLine: span?.line_end ?? null,
                source: "compiler",
                tool: "cargo",
                confidence: 0.95
            });
        }
        catch {
            continue;
        }
    }
    return diagnostics;
}
export function parseGenericDiagnostics(output, root, language, tool) {
    return parseColonDiagnostics(output, root, language, tool, /(.+\.[A-Za-z0-9]+):(\d+):(?:(\d+):)?\s*(?:error|warning)?\s*(.+)/i);
}
function runToolDiagnostics(context, strategy) {
    switch (strategy) {
        case "tsc":
            return runTypeScriptDiagnostics(context);
        case "pyright":
            return runPyrightDiagnostics(context);
        case "go-test":
            return runGoDiagnostics(context);
        case "cargo-check":
            return runRustDiagnostics(context);
        case "dotnet-build":
            return runDotnetDiagnostics(context);
        case "generic-stderr":
            return runGenericDiagnostics(context);
        default:
            return [degradedDiagnostic(context.language, context.files[0]?.path ?? `${context.language}/diagnostics`, "pmem-diagnostics", "unsupported_runner", "Diagnostic runner is not implemented.")];
    }
}
function runTypeScriptDiagnostics(context) {
    const tsc = localBinary(context.ctx.projectRoot, "tsc") ?? (commandExists("tsc") ? "tsc" : null);
    if (!tsc)
        return [degradedDiagnostic(context.language, context.files[0]?.path ?? "src/index.ts", "tsc", "missing_tsc", "TypeScript compiler was not found in the project or PATH.")];
    const result = spawnSync(tsc, ["--noEmit", "--pretty", "false"], { cwd: context.ctx.projectRoot, encoding: "utf8", timeout: context.timeoutMs, windowsHide: true });
    return diagnosticsFromResult(result, context, "tsc", () => parseTypeScriptDiagnostics(`${result.stdout}\n${result.stderr}`, context.ctx.projectRoot, context.language));
}
function runPyrightDiagnostics(context) {
    const args = ["--outputjson", ...context.files.map((file) => file.path)];
    const result = spawnSync(context.executable, args, { cwd: context.ctx.projectRoot, encoding: "utf8", timeout: context.timeoutMs, windowsHide: true });
    return diagnosticsFromResult(result, context, "pyright", () => parsePyrightDiagnostics(result.stdout, context.ctx.projectRoot));
}
function runGoDiagnostics(context) {
    if (!commandExists("go"))
        return [degradedDiagnostic("go", context.files[0]?.path ?? "main.go", "go", "missing_go_runtime", "Go runtime was not found on PATH.")];
    const result = spawnSync("go", ["test", "./..."], { cwd: context.ctx.projectRoot, encoding: "utf8", timeout: context.timeoutMs, windowsHide: true });
    return diagnosticsFromResult(result, context, "go", () => parseGoDiagnostics(`${result.stdout}\n${result.stderr}`, context.ctx.projectRoot));
}
function runRustDiagnostics(context) {
    if (!existsSync(path.join(context.ctx.projectRoot, "Cargo.toml"))) {
        return [degradedDiagnostic("rust", context.files[0]?.path ?? "src/main.rs", "cargo", "missing_cargo_project", "Cargo.toml was not found.")];
    }
    if (!commandExists("cargo"))
        return [degradedDiagnostic("rust", context.files[0]?.path ?? "src/main.rs", "cargo", "missing_cargo_runtime", "Cargo was not found on PATH.")];
    const result = spawnSync("cargo", ["check", "--message-format=json"], { cwd: context.ctx.projectRoot, encoding: "utf8", timeout: context.timeoutMs, windowsHide: true });
    return diagnosticsFromResult(result, context, "cargo", () => parseRustDiagnostics(result.stdout, context.ctx.projectRoot));
}
function runDotnetDiagnostics(context) {
    if (!commandExists("dotnet"))
        return [degradedDiagnostic("csharp", context.files[0]?.path ?? "Program.cs", "dotnet", "missing_dotnet_runtime", "dotnet was not found on PATH.")];
    const result = spawnSync("dotnet", ["build", "--no-restore", "--nologo"], { cwd: context.ctx.projectRoot, encoding: "utf8", timeout: context.timeoutMs, windowsHide: true });
    return diagnosticsFromResult(result, context, "dotnet", () => parseGenericDiagnostics(`${result.stdout}\n${result.stderr}`, context.ctx.projectRoot, "csharp", "dotnet"));
}
function runGenericDiagnostics(context) {
    const result = spawnSync(context.executable, ["--version"], { cwd: context.ctx.projectRoot, encoding: "utf8", timeout: context.timeoutMs, windowsHide: true });
    return diagnosticsFromResult(result, context, context.toolName, () => []);
}
function diagnosticsFromResult(result, context, tool, parse) {
    if (result.error && `${result.error.message}`.includes("ETIMEDOUT")) {
        return [degradedDiagnostic(context.language, context.files[0]?.path ?? `${context.language}/diagnostics`, tool, "tool_timeout", "Diagnostic tool timed out.")];
    }
    if (result.error) {
        return [degradedDiagnostic(context.language, context.files[0]?.path ?? `${context.language}/diagnostics`, tool, "tool_run_failed", result.error.message)];
    }
    const parsed = parse();
    if (parsed.length > 0)
        return parsed;
    if (result.status && result.status !== 0) {
        return [degradedDiagnostic(context.language, context.files[0]?.path ?? `${context.language}/diagnostics`, tool, "tool_run_failed", "Diagnostic tool exited without parseable diagnostics.")];
    }
    return [];
}
function parseColonDiagnostics(output, root, language, tool, pattern) {
    const diagnostics = [];
    for (const line of output.split(/\r?\n/)) {
        const trimmed = line.trim();
        const match = pattern.exec(trimmed);
        if (!match)
            continue;
        diagnostics.push({
            language,
            filePath: toRelativeToolPath(root, match[1], `${language}/unknown`),
            severity: /warning/i.test(trimmed) ? "warning" : /info/i.test(trimmed) ? "info" : "error",
            code: null,
            message: match[4],
            startLine: Number(match[2]),
            endLine: Number(match[2]),
            source: "compiler",
            tool,
            confidence: 0.8
        });
    }
    return diagnostics;
}
function degradedDiagnostic(language, filePath, tool, code, message) {
    return {
        language,
        filePath,
        severity: "info",
        code,
        message,
        startLine: null,
        endLine: null,
        source: "fallback",
        tool,
        confidence: 0.5
    };
}
function groupByLanguage(files) {
    const result = new Map();
    for (const file of files) {
        if (!file.language)
            continue;
        result.set(file.language, [...(result.get(file.language) ?? []), file]);
    }
    return new Map([...result.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}
function pyrightSeverity(value) {
    if (value === "error")
        return "error";
    if (value === "warning")
        return "warning";
    return "info";
}
function toRelativeToolPath(root, value, fallback) {
    const normalized = value.replaceAll("\\", "/");
    const candidate = path.isAbsolute(value) ? value : path.join(root, normalized);
    const relative = path.relative(root, candidate).replaceAll("\\", "/");
    if (!relative || relative.startsWith("../") || relative === ".." || path.isAbsolute(relative)) {
        return fallback.replaceAll("\\", "/").replace(/^\/+/, "");
    }
    return relative;
}
function localBinary(root, binary) {
    const unix = path.join(root, "node_modules", ".bin", binary);
    const windows = `${unix}.cmd`;
    if (existsSync(windows))
        return windows;
    if (existsSync(unix))
        return unix;
    return null;
}
function commandExists(command) {
    const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 5000, windowsHide: true });
    return result.status === 0;
}
//# sourceMappingURL=diagnostic-runner.js.map