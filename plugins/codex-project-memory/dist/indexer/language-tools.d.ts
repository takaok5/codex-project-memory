import type { LanguageCapability, LanguageId, LanguageToolStatus, RuntimeContext } from "../shared/types.js";
export type ToolInstaller = "npm" | "external" | "builtin";
export type DiagnosticRunStrategy = "tsc" | "pyright" | "go-test" | "cargo-check" | "dotnet-build" | "generic-stderr" | "unsupported";
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
    tools: Record<string, {
        packageName: string;
        version: string;
        binary: string;
        installedAt: string;
    }>;
}
export declare function listToolDefinitions(): ToolDefinition[];
export declare function getLanguageToolDefinition(language: LanguageId | null): ToolDefinition | null;
export declare function resolveLanguageTool(ctx: RuntimeContext, language: LanguageId | null, options?: {
    allowInstall?: boolean;
}): ResolvedLanguageTool | null;
export declare function resolveLanguageToolCapability(ctx: RuntimeContext, language: LanguageId | null, capability: LanguageCapability): LanguageCapability;
export declare function languageToolLockPath(ctx: RuntimeContext): string;
export declare function readLanguageToolLock(ctx: RuntimeContext): LanguageToolLock;
export {};
