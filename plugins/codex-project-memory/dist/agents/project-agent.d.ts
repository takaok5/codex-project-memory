import type { AgentRunInput, AgentRunOutput } from "../shared/types.js";
export interface ProjectAgentOptions {
    cwd: string;
}
export declare function runProjectAgent(input: AgentRunInput, options: ProjectAgentOptions): Promise<AgentRunOutput>;
