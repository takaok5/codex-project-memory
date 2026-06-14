import type { QueryOutput } from "../../shared/types.js";
import type { McpToolEnv } from "./head.js";
export declare function handleMemoryQuery(input: {
    intent: string;
    maxFiles?: number;
    maxSymbols?: number;
    maxWarnings?: number;
    includeVisualFrame?: boolean;
}, env: McpToolEnv): Promise<QueryOutput>;
