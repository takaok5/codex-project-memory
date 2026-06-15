import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { getLanguageMetadata, isTopLanguage } from "./language.js";
import { safeJsonParse, writeJsonFileAtomic } from "../shared/json.js";
import type { JsonObject, LanguageCapability, LanguageId, LanguageToolStatus, RuntimeContext } from "../shared/types.js";

export type ToolInstaller = "npm" | "external" | "builtin";
export type DiagnosticRunStrategy =
  | "tsc"
  | "pyright"
  | "go-test"
  | "cargo-check"
  | "dotnet-build"
  | "generic-stderr"
  | "unsupported";

export interface ToolDefinition {
  tool: string;
  installer: ToolInstaller;
  packageName?: string;
  version?: string;
  binary: string;
  runStrategy: DiagnosticRunStrategy;
  languages: string[];
  timeoutMs?: number;
}

export interface ResolvedLanguageTool {
  definition: ToolDefinition;
  status: LanguageToolStatus;
  executable: string | null;
  degradedReason: string | null;
}

interface LanguageToolLock {
  version: 1;
  tools: Record<
    string,
    {
      packageName: string;
      version: string;
      binary: string;
      installedAt: string;
    }
  >;
}

const BUILTIN_UNSUPPORTED: ToolDefinition = {
  tool: "pmem-diagnostics",
  installer: "builtin",
  binary: "pmem-diagnostics",
  runStrategy: "unsupported",
  languages: []
};

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  "typescript-language-server": {
    tool: "typescript-language-server",
    installer: "npm",
    packageName: "typescript-language-server",
    version: "5.3.0",
    binary: "typescript-language-server",
    runStrategy: "tsc",
    languages: ["typescript", "javascript"]
  },
  pyright: {
    tool: "pyright",
    installer: "npm",
    packageName: "pyright",
    version: "1.1.410",
    binary: "pyright",
    runStrategy: "pyright",
    languages: ["python"]
  },
  "vscode-html-language-server": {
    tool: "vscode-html-language-server",
    installer: "npm",
    packageName: "vscode-langservers-extracted",
    version: "4.10.0",
    binary: "vscode-html-language-server",
    runStrategy: "unsupported",
    languages: ["html"]
  },
  "vscode-css-language-server": {
    tool: "vscode-css-language-server",
    installer: "npm",
    packageName: "vscode-langservers-extracted",
    version: "4.10.0",
    binary: "vscode-css-language-server",
    runStrategy: "unsupported",
    languages: ["css"]
  },
  "bash-language-server": {
    tool: "bash-language-server",
    installer: "npm",
    packageName: "bash-language-server",
    version: "5.6.0",
    binary: "bash-language-server",
    runStrategy: "unsupported",
    languages: ["shell"]
  },
  "docker-langserver": {
    tool: "docker-langserver",
    installer: "npm",
    packageName: "dockerfile-language-server-nodejs",
    version: "0.15.0",
    binary: "docker-langserver",
    runStrategy: "unsupported",
    languages: ["dockerfile"]
  },
  intelephense: {
    tool: "intelephense",
    installer: "npm",
    packageName: "intelephense",
    version: "1.18.4",
    binary: "intelephense",
    runStrategy: "generic-stderr",
    languages: ["php"]
  },
  gopls: { tool: "gopls", installer: "external", binary: "gopls", runStrategy: "go-test", languages: ["go"] },
  jdtls: { tool: "jdtls", installer: "external", binary: "jdtls", runStrategy: "unsupported", languages: ["java"] },
  omnisharp: { tool: "omnisharp", installer: "external", binary: "omnisharp", runStrategy: "dotnet-build", languages: ["csharp"] },
  "rust-analyzer": { tool: "rust-analyzer", installer: "external", binary: "rust-analyzer", runStrategy: "cargo-check", languages: ["rust"] },
  clangd: { tool: "clangd", installer: "external", binary: "clangd", runStrategy: "unsupported", languages: ["c", "cpp"] },
  "lua-language-server": { tool: "lua-language-server", installer: "external", binary: "lua-language-server", runStrategy: "unsupported", languages: ["lua"] },
  "clojure-lsp": { tool: "clojure-lsp", installer: "external", binary: "clojure-lsp", runStrategy: "unsupported", languages: ["clojure"] }
};

export function listToolDefinitions(): ToolDefinition[] {
  return Object.values(TOOL_DEFINITIONS).sort((a, b) => a.tool.localeCompare(b.tool));
}

export function getLanguageToolDefinition(language: LanguageId | null): ToolDefinition | null {
  const metadata = language ? getLanguageMetadata(language) : null;
  if (metadata?.analyzer && TOOL_DEFINITIONS[metadata.analyzer]) {
    return TOOL_DEFINITIONS[metadata.analyzer]!;
  }
  if (isTopLanguage(language)) {
    return { ...BUILTIN_UNSUPPORTED, languages: language ? [language] : [] };
  }
  return null;
}

export function resolveLanguageTool(ctx: RuntimeContext, language: LanguageId | null, options: { allowInstall?: boolean } = {}): ResolvedLanguageTool | null {
  const definition = getLanguageToolDefinition(language);
  if (!definition) return null;
  if (definition.installer === "builtin") {
    return { definition, status: "unsupported", executable: null, degradedReason: "unsupported_runner" };
  }
  if ((process.env.VITEST && process.env.PMEM_LANGUAGE_TOOLS !== "test-install") || process.env.PMEM_LANGUAGE_TOOLS === "off") {
    logToolEvent(ctx, "language tool install disabled", { language, tool: definition.tool });
    return { definition, status: "disabled", executable: null, degradedReason: "language_tool_install_disabled" };
  }
  if (process.env.PMEM_LANGUAGE_TOOLS_IGNORE_PATH !== "1" && commandExists(definition.binary)) {
    logToolEvent(ctx, "language tool available on PATH", { language, tool: definition.tool });
    return { definition, status: "available", executable: definition.binary, degradedReason: null };
  }
  const cachePath = join(ctx.projectRoot, ctx.config.languageTools?.cachePath ?? ".codex/memory/cache/language-tools");
  const cachedBinary = cachedBinaryPath(cachePath, definition.binary);
  const cachedExecutable = existsSync(cachedBinary) ? cachedBinary : existsSync(`${cachedBinary}.cmd`) ? `${cachedBinary}.cmd` : null;
  if (cachedExecutable) {
    writeToolLock(cachePath, definition);
    logToolEvent(ctx, "language tool available in project cache", { language, tool: definition.tool });
    return { definition, status: "available", executable: cachedExecutable, degradedReason: null };
  }
  if (definition.installer !== "npm") {
    logToolEvent(ctx, "language tool has no user-space installer", { language, tool: definition.tool });
    return { definition, status: "missing", executable: null, degradedReason: "no_user_space_installer" };
  }
  if (options.allowInstall === false || !ctx.config.languageTools?.autoInstall) {
    logToolEvent(ctx, "language tool auto-install disabled", { language, tool: definition.tool });
    return { definition, status: "missing", executable: null, degradedReason: "language_tool_auto_install_disabled" };
  }
  mkdirSync(cachePath, { recursive: true });
  const packageSpec = `${definition.packageName}@${definition.version}`;
  const npmCommand = process.env.PMEM_LANGUAGE_TOOLS_NPM ?? "npm";
  logToolEvent(ctx, "installing language tool", { language, tool: definition.tool, packageSpec });
  const result = spawnSync(npmCommand, ["install", "--prefix", cachePath, "--no-save", "--omit=dev", "--no-audit", "--no-fund", packageSpec], {
    encoding: "utf8",
    timeout: ctx.config.languageTools?.installTimeoutMs ?? 120000,
    windowsHide: true
  });
  const installedExecutable = existsSync(cachedBinary) ? cachedBinary : existsSync(`${cachedBinary}.cmd`) ? `${cachedBinary}.cmd` : null;
  if (result.status === 0 && installedExecutable) {
    writeToolLock(cachePath, definition);
    logToolEvent(ctx, "installed language tool", { language, tool: definition.tool, packageSpec });
    return { definition, status: "available", executable: installedExecutable, degradedReason: null };
  }
  logToolEvent(ctx, "language tool install failed", {
    language,
    tool: definition.tool,
    packageSpec,
    status: result.status ?? -1,
    signal: result.signal ?? ""
  });
  return { definition, status: "failed", executable: null, degradedReason: "language_tool_install_failed" };
}

export function resolveLanguageToolCapability(ctx: RuntimeContext, language: LanguageId | null, capability: LanguageCapability): LanguageCapability {
  const resolved = resolveLanguageTool(ctx, language);
  if (!resolved) {
    return { ...capability, tool: null, toolStatus: "unsupported" };
  }
  return {
    ...capability,
    tool: resolved.definition.tool,
    toolStatus: resolved.status,
    diagnostics: resolved.status === "available" && resolved.definition.runStrategy !== "unsupported",
    degradedReason: capability.degradedReason ?? resolved.degradedReason
  };
}

export function languageToolLockPath(ctx: RuntimeContext): string {
  return lockPath(join(ctx.projectRoot, ctx.config.languageTools?.cachePath ?? ".codex/memory/cache/language-tools"));
}

export function readLanguageToolLock(ctx: RuntimeContext): LanguageToolLock {
  return readToolLock(join(ctx.projectRoot, ctx.config.languageTools?.cachePath ?? ".codex/memory/cache/language-tools"));
}

function commandExists(command: string): boolean {
  const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 5000, windowsHide: true });
  return result.status === 0;
}

function cachedBinaryPath(cachePath: string, binary: string): string {
  return join(cachePath, "node_modules", ".bin", binary);
}

function lockPath(cachePath: string): string {
  return join(cachePath, "pmem-language-tools.lock.json");
}

function writeToolLock(cachePath: string, definition: ToolDefinition): void {
  if (!definition.packageName || !definition.version) return;
  const existing = readToolLock(cachePath);
  const next: LanguageToolLock = {
    version: 1,
    tools: {
      ...existing.tools,
      [definition.tool]: {
        packageName: definition.packageName,
        version: definition.version,
        binary: definition.binary,
        installedAt: new Date().toISOString()
      }
    }
  };
  writeJsonFileAtomic(lockPath(cachePath), next);
}

function readToolLock(cachePath: string): LanguageToolLock {
  const file = lockPath(cachePath);
  if (!existsSync(file)) {
    return { version: 1, tools: {} };
  }
  const parsed = safeJsonParse<LanguageToolLock>(readFileSync(file, "utf8"));
  return parsed.ok && parsed.value?.version === 1 ? parsed.value : { version: 1, tools: {} };
}

function logToolEvent(ctx: RuntimeContext, message: string, details: JsonObject): void {
  const line = JSON.stringify({ at: new Date().toISOString(), message, ...details });
  try {
    mkdirSync(ctx.memoryPaths.logsDirAbs, { recursive: true });
    appendFileSync(join(ctx.memoryPaths.logsDirAbs, "language-tools.log"), `${line}\n`);
  } catch {
    process.stderr.write(`[codex-project-memory] ${message}\n`);
  }
}
