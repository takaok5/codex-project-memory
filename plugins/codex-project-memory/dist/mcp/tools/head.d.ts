import type { FrameRef, MemoryStatus } from "../../shared/types.js";
export interface McpToolEnv {
    cwd: string;
}
export interface MemoryHeadOutput {
    project: string | null;
    branch: string | null;
    status: MemoryStatus;
    memoryRoot: ".codex/memory";
    visualFrame: FrameRef | null;
    lastIndexedAt: string | null;
    lastRenderedAt: string | null;
    topModules: Array<{
        id: string;
        name: string;
        riskLevel?: "normal" | "high";
    }>;
    criticalRules: string[];
    warnings: string[];
    nextCommands: string[];
}
export declare function handleMemoryHead(_input: unknown, env: McpToolEnv): Promise<MemoryHeadOutput>;
