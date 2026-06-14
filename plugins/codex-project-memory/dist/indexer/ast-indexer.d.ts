import { type SourceFile } from "ts-morph";
import type { AstIndexOptions, AstIndexResult, ImportExportEdgeInput, ScannedFile, SymbolRecord } from "../shared/types.js";
export declare function indexFileAst(absPath: string, file: ScannedFile, options: AstIndexOptions): AstIndexResult;
export declare function extractSymbolsFromSourceFile(sourceFile: SourceFile, fileIdHint?: number): SymbolRecord[];
export declare function extractImportExportEdges(sourceFile: SourceFile): ImportExportEdgeInput[];
