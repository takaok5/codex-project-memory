import type { DuplicateAgentInput, DuplicateCandidate, DuplicateOutput, DuplicateVerdict, RiskLevel, RuntimeContext } from "../shared/types.js";
export declare function runDuplicateAgent(ctx: RuntimeContext, input: DuplicateAgentInput): DuplicateOutput;
export declare function scoreDuplicateRisk(_input: DuplicateAgentInput, candidates: DuplicateCandidate[]): {
    risk: RiskLevel;
    verdict: DuplicateVerdict;
    score: number;
};
