import type { CliResult, RuntimeEvidenceOutput } from "../../shared/types.js";
export interface EvidenceRunCliOptions {
    cwd: string;
    kind?: string;
    all?: boolean;
}
export declare function cmdEvidenceRun(options: EvidenceRunCliOptions): Promise<CliResult<RuntimeEvidenceOutput>>;
export declare function cmdEvidenceList(options: {
    cwd: string;
}): Promise<CliResult<RuntimeEvidenceOutput>>;
