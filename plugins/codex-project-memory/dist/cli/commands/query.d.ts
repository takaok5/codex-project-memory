import type { CliResult, QueryOutput } from "../../shared/types.js";
export interface QueryCliOptions {
    cwd: string;
    intent: string;
    maxFiles?: number;
    maxSymbols?: number;
    maxWarnings?: number;
    visual?: boolean;
}
export declare function cmdQuery(options: QueryCliOptions): Promise<CliResult<QueryOutput>>;
