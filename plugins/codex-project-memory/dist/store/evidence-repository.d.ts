import type { ArchitectureDecisionInput, ArchitectureDecisionRecord, EvidenceFeedbackInput, EvidenceFeedbackRecord, EvidenceRecord, EvidenceRecordInput, EvidenceRecordStatus, RuntimeEvidenceItemRecord, RuntimeEvidenceRunInput, RuntimeEvidenceRunRecord } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export declare function addRuntimeEvidenceRun(db: MemoryDb, input: RuntimeEvidenceRunInput): {
    runId: number;
    itemIds: number[];
};
export declare function listRuntimeEvidenceRuns(db: MemoryDb, limit?: number): RuntimeEvidenceRunRecord[];
export declare function listRuntimeEvidenceItems(db: MemoryDb, filter?: {
    limit?: number;
    filePath?: string;
}): RuntimeEvidenceItemRecord[];
export declare function addEvidenceRecord(db: MemoryDb, input: EvidenceRecordInput): number;
export declare function addEvidenceRecords(db: MemoryDb, records: EvidenceRecordInput[]): number[];
export declare function listEvidenceRecords(db: MemoryDb, filter?: {
    status?: EvidenceRecordStatus;
    kind?: string;
    limit?: number;
}): EvidenceRecord[];
export declare function markEvidenceStaleForRemovedFiles(db: MemoryDb, filePaths: string[], reason: string): number;
export declare function upsertArchitectureDecision(db: MemoryDb, input: ArchitectureDecisionInput): number;
export declare function listArchitectureDecisions(db: MemoryDb, filter?: {
    status?: EvidenceRecordStatus;
    limit?: number;
}): ArchitectureDecisionRecord[];
export declare function getArchitectureDecision(db: MemoryDb, idOrTitle: number | string): ArchitectureDecisionRecord | null;
export declare function setArchitectureDecisionStatus(db: MemoryDb, id: number, status: EvidenceRecordStatus, reason: string): number;
export declare function addEvidenceFeedback(db: MemoryDb, input: EvidenceFeedbackInput): number;
export declare function listEvidenceFeedback(db: MemoryDb, limit?: number): EvidenceFeedbackRecord[];
export declare function getEvidenceFeedbackScores(db: MemoryDb): Map<string, number>;
export declare function evidenceRecordFingerprint(input: EvidenceRecordInput): string;
