import type { DiffOutput, DuplicateOutput, ImpactOutput, QueryOutput, RuntimeContext } from "../shared/types.js";
export interface ImpactAgentInput {
    intent: string;
    query?: QueryOutput;
    duplicates?: DuplicateOutput;
    diff?: DiffOutput;
}
export declare function runImpactAgent(ctx: RuntimeContext, input: ImpactAgentInput): ImpactOutput;
