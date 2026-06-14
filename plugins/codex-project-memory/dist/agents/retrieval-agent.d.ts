import type { RetrievalAgentInput, QueryOutput, RuntimeContext } from "../shared/types.js";
export declare function runRetrievalAgent(ctx: RuntimeContext, input: RetrievalAgentInput): QueryOutput;
export declare function scoreRetrievalCandidates(intent: string, candidates: RetrievalCandidate[]): ScoredRetrievalCandidate[];
export interface RetrievalCandidate {
    id: number;
    name: string;
    path?: string;
    kind?: string;
}
export interface ScoredRetrievalCandidate extends RetrievalCandidate {
    score: number;
}
