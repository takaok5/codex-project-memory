import type { MemoryDiff } from "../../shared/types.js";
import type { McpToolEnv } from "./head.js";
export declare function handleMemoryDiff(input: {
    from?: string;
    to?: string;
}, env: McpToolEnv): Promise<MemoryDiff>;
