import type { LanguageCapability, LanguageId, LanguageToolStatus, ProjectMemoryConfig } from "../shared/types.js";
export interface LanguageMetadata {
    id: LanguageId;
    displayName: string;
    extensions: string[];
    filenames?: string[];
    topLanguage: boolean;
    analyzer?: string;
}
export declare function classifyLanguage(filePath: string): LanguageId | null;
export declare function getLanguageMetadata(filePathOrLanguage: string): LanguageMetadata | null;
export declare function listKnownLanguages(): LanguageMetadata[];
export declare function isLanguageEnabled(language: LanguageId | null, config: ProjectMemoryConfig): boolean;
export declare function buildLanguageCapability(language: LanguageId | null, options: {
    parser: string;
    tier: LanguageCapability["tier"];
    symbols: boolean;
    dependencies: boolean;
    tests: boolean;
    routes: boolean;
    diagnostics?: boolean;
    toolStatus?: LanguageToolStatus;
    degradedReason?: string | null;
}): LanguageCapability;
export declare function isTopLanguage(language: LanguageId | null): boolean;
export declare function isTestFile(filePath: string): boolean;
export declare function isGeneratedFile(filePath: string): boolean;
