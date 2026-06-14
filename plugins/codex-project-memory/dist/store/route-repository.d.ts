import type { RouteRecord, RouteRecordInput } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function replaceRoutesForFile(db: MemoryDb, fileId: number, routes: RouteRecordInput[]): void;
export declare function listRoutes(db: MemoryDb): RouteRecord[];
