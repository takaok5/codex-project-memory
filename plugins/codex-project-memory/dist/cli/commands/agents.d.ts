import type { AgentsInstallOutput, AgentsListOutput, CliResult } from "../../shared/types.js";
export declare function cmdAgentsInstall(options: {
    cwd: string;
    scope?: string;
    force?: boolean;
}): Promise<CliResult<AgentsInstallOutput>>;
export declare function cmdAgentsList(options: {
    cwd: string;
}): Promise<CliResult<AgentsListOutput>>;
