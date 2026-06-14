import type { CliResult, InitOutput } from "../../shared/types.js";
export interface InitOptions {
    cwd: string;
    force?: boolean;
}
export declare function cmdInit(options: InitOptions): Promise<CliResult<InitOutput>>;
