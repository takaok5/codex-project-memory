import type { ArtifactKind, DuplicateCandidate } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export interface DuplicateCandidateRecord {
    kind: ArtifactKind;
    leftFileId?: number;
    rightFileId?: number;
    leftSymbolId?: number;
    rightSymbolId?: number;
    similarity: number;
    reason: string;
}
export declare function replaceDuplicateCandidates(db: MemoryDb, candidates: DuplicateCandidateRecord[]): void;
export declare function listDuplicateCandidates(db: MemoryDb, limit?: number): DuplicateCandidate[];
