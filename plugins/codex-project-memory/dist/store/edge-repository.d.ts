import type { ResolvedSymbolEdgeInput, SymbolEdgeRecord } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function replaceEdgesForFile(db: MemoryDb, fileId: number, edges: ResolvedSymbolEdgeInput[]): void;
export declare function listEdgesForGraph(db: MemoryDb): SymbolEdgeRecord[];
