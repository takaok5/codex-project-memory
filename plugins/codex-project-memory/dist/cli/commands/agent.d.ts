import type { CliResult, AgentRunOutput } from "../../shared/types.js";
export interface AgentRunCliOptions {
    cwd: string;
    intent: string;
    phase?: string;
    kind?: string;
    moduleId?: string;
    proposedName?: string;
    init?: boolean;
    refresh?: boolean;
    render?: boolean;
}
export declare function cmdAgentRun(options: AgentRunCliOptions): Promise<CliResult<AgentRunOutput>>;
