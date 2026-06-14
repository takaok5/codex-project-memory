import type { SourceFile } from "ts-morph";
import type { RouteRecordInput, SymbolRecord } from "../shared/types.js";
export declare function inferNestRoutes(sourceFile: SourceFile, symbols: SymbolRecord[]): RouteRecordInput[];
