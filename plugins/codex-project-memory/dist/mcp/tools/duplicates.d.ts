import type { DuplicateCandidate, DuplicateVerdict, RiskLevel } from "../../shared/types.js";
import type { McpToolEnv } from "./head.js";
export interface MemoryDuplicatesOutput {
    risk: RiskLevel;
    verdict: DuplicateVerdict;
    matches: DuplicateCandidate[];
    recommendation: string;
}
export declare function handleMemoryDuplicates(input: {
    kind: string;
    intent: string;
    moduleId?: string;
    proposedName?: string;
}, env: McpToolEnv): Promise<MemoryDuplicatesOutput>;
