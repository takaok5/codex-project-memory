import { writeJson } from "../shared/json.js";
import { nowIso } from "../shared/time.js";
import type { AgentName, JsonValue } from "../shared/types.js";
import type { MemoryDb } from "./sqlite.js";

export interface RetrievalLogInput {
  intent: string;
  agent: AgentName;
  output: JsonValue;
}

export function insertRetrievalLog(db: MemoryDb, log: RetrievalLogInput): number {
  const result = db.prepare("INSERT INTO retrieval_logs(intent, agent, output_json, created_at) VALUES (?, ?, ?, ?)").run(log.intent, log.agent, writeJson(log.output), nowIso());
  return Number(result.lastInsertRowid);
}

export function addRetrievalLog(db: MemoryDb, log: RetrievalLogInput): number {
  return insertRetrievalLog(db, log);
}

export function listRecentRetrievalLogs(db: MemoryDb, limit = 20): Array<{ id: number; intent: string; agent: AgentName; outputJson: string; createdAt: string }> {
  return (
    db.prepare("SELECT id, intent, agent, output_json, created_at FROM retrieval_logs ORDER BY created_at DESC, id DESC LIMIT ?").all(Math.max(1, limit)) as RetrievalLogRow[]
  ).map((row) => ({ id: row.id, intent: row.intent, agent: row.agent, outputJson: row.output_json, createdAt: row.created_at }));
}

interface RetrievalLogRow {
  id: number;
  intent: string;
  agent: AgentName;
  output_json: string;
  created_at: string;
}
