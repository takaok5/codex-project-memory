import type { FileFilter, IndexedFileRecord } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function upsertFileRecord(db: MemoryDb, file: IndexedFileRecord): number;
export declare function listFiles(db: MemoryDb, filter?: FileFilter): IndexedFileRecord[];
export declare function getFileByPath(db: MemoryDb, path: string): IndexedFileRecord | null;
export declare function removeFileRecordCascade(db: MemoryDb, path: string): void;
