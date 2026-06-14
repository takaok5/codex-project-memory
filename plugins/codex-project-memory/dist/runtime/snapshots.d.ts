import type { DiffOutput, MemorySnapshot, RuntimeContext, SnapshotRef } from "../shared/types.js";
export declare function rotateSnapshotsForWrite(ctx: RuntimeContext): void;
export declare function createMemorySnapshot(ctx: RuntimeContext, options?: {
    ref?: "latest" | "previous";
    write?: boolean;
}): MemorySnapshot;
export declare function readMemorySnapshot(ctx: RuntimeContext, ref: SnapshotRef): {
    snapshot: MemorySnapshot | null;
    warning?: string;
};
export declare function diffMemorySnapshots(from: MemorySnapshot | null, to: MemorySnapshot | null): Omit<DiffOutput, "from" | "to">;
