import type { CliResult, RefreshOutput } from "../../shared/types.js";
export interface RefreshCliOptions {
    cwd: string;
    render?: boolean;
    reason?: string;
}
export declare function cmdRefresh(options: RefreshCliOptions): Promise<CliResult<RefreshOutput>>;
