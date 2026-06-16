import type { DiffOutput, DuplicateOutput, ImpactOutput, MemoryCurationOutput, QueryOutput } from "../shared/types.js";
export interface MemoryCuratorInput {
    phase: string;
    query?: QueryOutput;
    duplicates?: DuplicateOutput;
    impact?: ImpactOutput;
    diff?: DiffOutput;
}
export declare function runMemoryCurator(input: MemoryCuratorInput): MemoryCurationOutput;
