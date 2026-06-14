import type { CliResult, DiffOutput, SnapshotRef } from "../../shared/types.js";
export interface DiffCliOptions {
    cwd: string;
    from?: SnapshotRef;
    to?: SnapshotRef;
}
export declare function cmdDiff(options: DiffCliOptions): Promise<CliResult<DiffOutput>>;
