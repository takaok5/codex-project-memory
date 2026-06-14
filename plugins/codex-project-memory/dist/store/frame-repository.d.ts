import type { FrameName, FrameRecord } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function upsertFrame(db: MemoryDb, frame: FrameRecord): void;
export declare function getFrame(db: MemoryDb, id: FrameName): FrameRecord | null;
export declare function listFrames(db: MemoryDb): FrameRecord[];
