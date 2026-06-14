import type { CliResult, IndexOutput } from "../../shared/types.js";
export interface IndexCliOptions {
    cwd: string;
    changedOnly?: boolean;
}
export declare function cmdIndex(options: IndexCliOptions): Promise<CliResult<IndexOutput>>;
