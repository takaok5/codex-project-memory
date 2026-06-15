import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { getLanguageMetadata } from "./language.js";
import { safeJsonParse, writeJsonFileAtomic } from "../shared/json.js";
import type { JsonObject, LanguageCapability, LanguageId, RuntimeContext } from "../shared/types.js";

interface ToolDefinition {
  tool: string;
  installer: "npm" | "external";
  packageName?: string;
  version?: string;
  binary: string;
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

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  "typescript-language-server": { tool: "typescript-language-server", installer: "npm", packageName: "typescript-language-server", version: "5.3.0", binary: "typescript-language-server" },
  pyright: { tool: "pyright", installer: "npm", packageName: "pyright", version: "1.1.410", binary: "pyright" },
  "vscode-html-language-server": { tool: "vscode-html-language-server", installer: "npm", packageName: "vscode-langservers-extracted", version: "4.10.0", binary: "vscode-html-language-server" },
  "vscode-css-language-server": { tool: "vscode-css-language-server", installer: "npm", packageName: "vscode-langservers-extracted", version: "4.10.0", binary: "vscode-css-language-server" },
  "bash-language-server": { tool: "bash-language-server", installer: "npm", packageName: "bash-language-server", version: "5.6.0", binary: "bash-language-server" },
  "docker-langserver": { tool: "docker-langserver", installer: "npm", packageName: "dockerfile-language-server-nodejs", version: "0.15.0", binary: "docker-langserver" },
  intelephense: { tool: "intelephense", installer: "npm", packageName: "intelephense", version: "1.18.4", binary: "intelephense" },
  gopls: { tool: "gopls", installer: "external", binary: "gopls" },
  jdtls: { tool: "jdtls", installer: "external", binary: "jdtls" },
  omnisharp: { tool: "omnisharp", installer: "external", binary: "omnisharp" },
  "rust-analyzer": { tool: "rust-analyzer", installer: "external", binary: "rust-analyzer" },
  clangd: { tool: "clangd", installer: "external", binary: "clangd" },
  "lua-language-server": { tool: "lua-language-server", installer: "external", binary: "lua-language-server" },
  "clojure-lsp": { tool: "clojure-lsp", installer: "external", binary: "clojure-lsp" }
};

export function resolveLanguageToolCapability(ctx: RuntimeContext, language: LanguageId | null, capability: LanguageCapability): LanguageCapability {
  const metadata = language ? getLanguageMetadata(language) : null;
  if (!metadata?.analyzer) {
    return { ...capability, tool: null, toolStatus: "unsupported" };
  }
  const definition = TOOL_DEFINITIONS[metadata.analyzer];
  if (!definition) {
    return { ...capability, tool: metadata.analyzer, toolStatus: "missing", degradedReason: capability.degradedReason ?? "language_tool_not_registered" };
  }
  if (capability.toolStatus === "available" && capability.diagnostics) {
    return capability;
  }
  if ((process.env.VITEST && process.env.PMEM_LANGUAGE_TOOLS !== "test-install") || process.env.PMEM_LANGUAGE_TOOLS === "off") {
    logToolEvent(ctx, "language tool install disabled", { language, tool: definition.tool });
    return {
      ...capability,
      tool: definition.tool,
      toolStatus: "disabled",
      degradedReason: capability.degradedReason ?? "language_tool_install_disabled"
    };
  }
  if (process.env.PMEM_LANGUAGE_TOOLS_IGNORE_PATH !== "1" && commandExists(definition.binary)) {
    logToolEvent(ctx, "language tool available on PATH", { language, tool: definition.tool });
    return { ...capability, tool: definition.tool, toolStatus: "available", diagnostics: true };
  }
  if (definition.installer !== "npm") {
    logToolEvent(ctx, "language tool has no user-space installer", { language, tool: definition.tool });
    return {
      ...capability,
      tool: definition.tool,
      toolStatus: "missing",
      degradedReason: capability.degradedReason ?? "no_user_space_installer"
    };
  }
  if (!ctx.config.languageTools?.autoInstall) {
    logToolEvent(ctx, "language tool auto-install disabled", { language, tool: definition.tool });
    return {
      ...capability,
      tool: definition.tool,
      toolStatus: "missing",
      degradedReason: capability.degradedReason ?? "language_tool_auto_install_disabled"
    };
  }
  const cachePath = join(ctx.projectRoot, ctx.config.languageTools.cachePath);
  const cachedBinary = cachedBinaryPath(cachePath, definition.binary);
  if (existsSync(cachedBinary) || existsSync(`${cachedBinary}.cmd`)) {
    writeToolLock(cachePath, definition);
    logToolEvent(ctx, "language tool available in project cache", { language, tool: definition.tool });
    return { ...capability, tool: definition.tool, toolStatus: "available", diagnostics: true };
  }
  mkdirSync(cachePath, { recursive: true });
  const packageSpec = `${definition.packageName}@${definition.version}`;
  const npmCommand = process.env.PMEM_LANGUAGE_TOOLS_NPM ?? "npm";
  logToolEvent(ctx, "installing language tool", { language, tool: definition.tool, packageSpec });
  const result = spawnSync(npmCommand, ["install", "--prefix", cachePath, "--no-save", "--omit=dev", "--no-audit", "--no-fund", packageSpec], {
    encoding: "utf8",
    timeout: ctx.config.languageTools.installTimeoutMs,
    windowsHide: true
  });
  if (result.status === 0 && (existsSync(cachedBinary) || existsSync(`${cachedBinary}.cmd`))) {
    writeToolLock(cachePath, definition);
    logToolEvent(ctx, "installed language tool", { language, tool: definition.tool, packageSpec });
    return { ...capability, tool: definition.tool, toolStatus: "available", diagnostics: true };
  }
  logToolEvent(ctx, "language tool install failed", {
    language,
    tool: definition.tool,
    packageSpec,
    status: result.status ?? -1,
    signal: result.signal ?? ""
  });
  return {
    ...capability,
    tool: definition.tool,
    toolStatus: "failed",
    degradedReason: "language_tool_install_failed"
  };
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
