import type { CliResult, DuplicateOutput } from "../../shared/types.js";
export interface DuplicatesCliOptions {
    cwd: string;
    intent: string;
    kind?: string;
    moduleId?: string;
    proposedName?: string;
}
export declare function cmdDuplicates(options: DuplicatesCliOptions): Promise<CliResult<DuplicateOutput>>;
