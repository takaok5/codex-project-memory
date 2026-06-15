import type { LanguageIndexer } from "./language-indexer.js";
import type { AstIndexOptions, AstIndexResult, ScannedFile } from "../shared/types.js";
export declare function indexScannedFile(absPath: string, file: ScannedFile, options: AstIndexOptions): AstIndexResult;
export declare const tsMorphLanguageIndexer: LanguageIndexer;
export declare const universalFallbackLanguageIndexer: LanguageIndexer;
export declare function getLanguageIndexer(file: ScannedFile): LanguageIndexer;
export declare const LANGUAGE_INDEXERS: LanguageIndexer[];
