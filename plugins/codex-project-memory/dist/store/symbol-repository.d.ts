import type { SymbolRecord, SymbolSearchQuery } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function replaceSymbolsForFile(db: MemoryDb, fileId: number, symbols: SymbolRecord[]): void;
export declare function searchSymbols(db: MemoryDb, query: SymbolSearchQuery): SymbolRecord[];
export declare function getSymbolById(db: MemoryDb, id: number): SymbolRecord | null;
export declare function getSymbolByFileAndName(db: MemoryDb, fileId: number, name: string): SymbolRecord | null;
