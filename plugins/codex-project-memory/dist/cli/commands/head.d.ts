import type { CliResult, HeadOutput } from "../../shared/types.js";
export interface HeadOptions {
    cwd: string;
}
export declare function cmdHead(options: HeadOptions): Promise<CliResult<HeadOutput>>;
export declare function notInitializedHead(): HeadOutput;
