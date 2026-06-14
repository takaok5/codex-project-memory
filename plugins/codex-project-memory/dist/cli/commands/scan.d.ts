import type { CliResult, ScanOutput } from "../../shared/types.js";
export interface ScanOptions {
    cwd: string;
}
export declare function cmdScan(options: ScanOptions): Promise<CliResult<ScanOutput>>;
