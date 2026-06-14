import type { ErrorPayload, ProjectState } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function getProjectState(db: MemoryDb): ProjectState;
export declare function setProjectStateValue(db: MemoryDb, key: string, value: string): void;
export declare function markMemoryDirty(db: MemoryDb, reason: string): void;
export declare function markMemoryFresh(db: MemoryDb, indexedAt?: string): void;
export declare function markMemoryError(db: MemoryDb, error: ErrorPayload): void;
