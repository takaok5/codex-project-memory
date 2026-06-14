import type { AgentRunInput, AgentRunOutput } from "../../shared/types.js";
import type { McpToolEnv } from "./head.js";
export declare function handleMemoryAgent(input: AgentRunInput, env: McpToolEnv): Promise<AgentRunOutput>;
