import type { RuntimeContext, RuntimeEvidenceKind, RuntimeEvidenceOutput } from "../shared/types.js";
export interface RuntimeEvidenceRunOptions {
    kinds: RuntimeEvidenceKind[];
    timeoutMs?: number;
}
export declare function runRuntimeEvidence(ctx: RuntimeContext, options: RuntimeEvidenceRunOptions): RuntimeEvidenceOutput;
export declare function listRuntimeEvidence(ctx: RuntimeContext): RuntimeEvidenceOutput;
