import type { FrameName, FrameRef } from "../../shared/types.js";
import type { McpToolEnv } from "./head.js";
export interface MemoryRefreshOutput {
    status: "updated" | "no_changes" | "stale";
    changedOnly: boolean;
    changedFiles: number;
    indexedFiles: number;
    deletedFiles: number;
    updatedTables: string[];
    updatedFrames: FrameName[];
    visualFrame: FrameRef | null;
    warnings: string[];
}
export declare function handleMemoryRefresh(input: {
    changedOnly?: boolean;
    render?: boolean;
    reason?: string;
}, env: McpToolEnv): Promise<MemoryRefreshOutput>;
