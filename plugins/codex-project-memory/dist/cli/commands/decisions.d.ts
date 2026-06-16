import type { ArchitectureDecisionRecord, CliResult } from "../../shared/types.js";
export interface DecisionAddCliOptions {
    cwd: string;
    title?: string;
    summary?: string;
    rationale?: string;
    moduleId?: string;
    filePath?: string;
    symbolFqName?: string;
}
export declare function cmdDecisionAdd(options: DecisionAddCliOptions): Promise<CliResult<{
    id: number;
}>>;
export declare function cmdDecisionList(options: {
    cwd: string;
    status?: string;
}): Promise<CliResult<{
    decisions: ArchitectureDecisionRecord[];
}>>;
export declare function cmdDecisionGet(options: {
    cwd: string;
    idOrTitle: string;
}): Promise<CliResult<{
    decision: ArchitectureDecisionRecord | null;
}>>;
export declare function cmdDecisionStatus(options: {
    cwd: string;
    id: number;
    status: string;
    reason?: string;
}): Promise<CliResult<{
    evidenceId: number;
}>>;
