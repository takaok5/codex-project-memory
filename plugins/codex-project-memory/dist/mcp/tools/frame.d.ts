import type { FrameName } from "../../shared/types.js";
import type { McpToolEnv } from "./head.js";
export interface MemoryFrameOutput {
    frame: FrameName;
    svg: string;
    png: string | null;
    map: string;
    summary: string;
    warnings: string[];
}
export declare function handleMemoryFrame(input: {
    frame: FrameName;
}, env: McpToolEnv): Promise<MemoryFrameOutput>;
