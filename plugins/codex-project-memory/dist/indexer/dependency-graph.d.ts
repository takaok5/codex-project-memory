import type { ImportExportEdgeInput, ResolvedSymbolEdgeInput, WarningRecordInput } from "../shared/types.js";
import type { MemoryDb } from "../store/sqlite.js";
export declare function resolveSymbolEdges(db: MemoryDb, imports: ImportExportEdgeInput[]): {
    edges: ResolvedSymbolEdgeInput[];
    warnings: WarningRecordInput[];
};
