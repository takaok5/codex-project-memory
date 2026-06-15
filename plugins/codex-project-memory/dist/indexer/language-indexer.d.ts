import type { AstIndexOptions, AstIndexResult, LanguageCapability, LanguageId, ScannedFile } from "../shared/types.js";
export interface LanguageIndexer {
    id: string;
    languages: LanguageId[] | "*";
    parser: string;
    tier: LanguageCapability["tier"];
    supports(file: ScannedFile): boolean;
    index(absPath: string, file: ScannedFile, options: AstIndexOptions): AstIndexResult;
}
export declare function supportsLanguage(indexer: LanguageIndexer, language: LanguageId | null): boolean;
