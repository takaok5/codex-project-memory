import type { WarningRecord, WarningRecordInput, WarningSource } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function replaceWarningsForFile(db: MemoryDb, fileId: number, source: WarningSource, warnings: WarningRecordInput[]): void;
export declare function resolveWarningsForFile(db: MemoryDb, fileId: number, source?: WarningSource): void;
export declare function addWarning(db: MemoryDb, warning: WarningRecordInput): number;
export declare function listActiveWarnings(db: MemoryDb, limit?: number): WarningRecord[];
export declare function warningFingerprint(warning: WarningRecordInput): string;
