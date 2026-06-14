import type { LanguageKind } from "../shared/types.js";
export declare function classifyLanguage(filePath: string): LanguageKind | null;
export declare function isTestFile(filePath: string): boolean;
export declare function isGeneratedFile(filePath: string): boolean;
