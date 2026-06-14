import type { AgentName, JsonValue } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";
export interface RetrievalLogInput {
    intent: string;
    agent: AgentName;
    output: JsonValue;
}
export declare function insertRetrievalLog(db: MemoryDb, log: RetrievalLogInput): number;
export declare function addRetrievalLog(db: MemoryDb, log: RetrievalLogInput): number;
export declare function listRecentRetrievalLogs(db: MemoryDb, limit?: number): Array<{
    id: number;
    intent: string;
    agent: AgentName;
    outputJson: string;
    createdAt: string;
}>;
