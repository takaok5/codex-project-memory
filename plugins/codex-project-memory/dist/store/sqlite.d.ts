import Database from "better-sqlite3";
import type { MemoryPaths } from "../shared/types.js";
export type MemoryDb = Database.Database;
export declare function openMemoryDb(paths: MemoryPaths): MemoryDb;
export declare function ensureSchema(db: MemoryDb): void;
export declare function withTransaction<T>(db: MemoryDb, fn: () => T): T;
export declare const REQUIRED_TABLES: string[];
export declare const FORBIDDEN_TABLES: string[];
