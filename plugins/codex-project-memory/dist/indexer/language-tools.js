import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { getLanguageMetadata } from "./language.js";
const NPM_ANALYZERS = {
    python: { packageName: "pyright", binary: "pyright" },
    typescript: { packageName: "typescript-language-server", binary: "typescript-language-server" },
    javascript: { packageName: "typescript-language-server", binary: "typescript-language-server" },
    html: { packageName: "vscode-langservers-extracted", binary: "vscode-html-language-server" },
    css: { packageName: "vscode-langservers-extracted", binary: "vscode-css-language-server" },
    shell: { packageName: "bash-language-server", binary: "bash-language-server" },
    dockerfile: { packageName: "dockerfile-language-server-nodejs", binary: "docker-langserver" },
    php: { packageName: "intelephense", binary: "intelephense" }
};
export function resolveLanguageToolCapability(ctx, language, capability) {
    const metadata = language ? getLanguageMetadata(language) : null;
    if (!metadata?.analyzer) {
        return { ...capability, tool: null, toolStatus: "unsupported" };
    }
    if (capability.toolStatus === "available" && capability.diagnostics) {
        return capability;
    }
    if (process.env.VITEST || process.env.PMEM_LANGUAGE_TOOLS === "off") {
        return {
            ...capability,
            tool: metadata.analyzer,
            toolStatus: "disabled",
            degradedReason: capability.degradedReason ?? "language_tool_install_disabled"
        };
    }
    if (commandExists(metadata.analyzer)) {
        return { ...capability, tool: metadata.analyzer, toolStatus: "available", diagnostics: true };
    }
    const installer = NPM_ANALYZERS[metadata.id];
    if (!installer || !ctx.config.languageTools?.autoInstall) {
        return {
            ...capability,
            tool: metadata.analyzer,
            toolStatus: "missing",
            degradedReason: capability.degradedReason ?? "no_user_space_installer"
        };
    }
    const cachePath = join(ctx.projectRoot, ctx.config.languageTools.cachePath);
    const cachedBinary = cachedBinaryPath(cachePath, installer.binary);
    if (existsSync(cachedBinary) || existsSync(`${cachedBinary}.cmd`)) {
        return { ...capability, tool: metadata.analyzer, toolStatus: "available", diagnostics: true };
    }
    mkdirSync(cachePath, { recursive: true });
    const result = spawnSync("npm", ["install", "--prefix", cachePath, "--no-save", "--omit=dev", "--no-audit", "--no-fund", installer.packageName], {
        encoding: "utf8",
        timeout: ctx.config.languageTools.installTimeoutMs,
        windowsHide: true
    });
    if (result.status === 0 && (existsSync(cachedBinary) || existsSync(`${cachedBinary}.cmd`))) {
        return { ...capability, tool: metadata.analyzer, toolStatus: "available", diagnostics: true };
    }
    return {
        ...capability,
        tool: metadata.analyzer,
        toolStatus: "failed",
        degradedReason: "language_tool_install_failed"
    };
}
function commandExists(command) {
    const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 5000, windowsHide: true });
    return result.status === 0;
}
function cachedBinaryPath(cachePath, binary) {
    return join(cachePath, "node_modules", ".bin", binary);
}
//# sourceMappingURL=language-tools.js.map