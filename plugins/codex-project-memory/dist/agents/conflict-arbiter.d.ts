import type { ConflictOutput, DiffOutput, DuplicateOutput, ImpactOutput, MemoryCurationOutput, QueryOutput } from "../shared/types.js";
export interface ConflictArbiterInput {
    query?: QueryOutput;
    duplicates?: DuplicateOutput;
    impact?: ImpactOutput;
    curation?: MemoryCurationOutput;
    diff?: DiffOutput;
}
export declare function runConflictArbiter(input: ConflictArbiterInput): ConflictOutput;
