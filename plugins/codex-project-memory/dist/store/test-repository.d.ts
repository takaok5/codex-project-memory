import type { TestLinkRecord } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function replaceTestLinksForFile(db: MemoryDb, fileId: number, links: TestLinkRecord[]): void;
export declare function listTestLinksForSymbol(db: MemoryDb, symbolId: number): TestLinkRecord[];
