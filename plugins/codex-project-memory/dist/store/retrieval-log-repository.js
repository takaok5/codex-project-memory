import { writeJson } from "../shared/json.js";
import { nowIso } from "../shared/time.js";
export function insertRetrievalLog(db, log) {
    const result = db.prepare("INSERT INTO retrieval_logs(intent, agent, output_json, created_at) VALUES (?, ?, ?, ?)").run(log.intent, log.agent, writeJson(log.output), nowIso());
    return Number(result.lastInsertRowid);
}
export function addRetrievalLog(db, log) {
    return insertRetrievalLog(db, log);
}
export function listRecentRetrievalLogs(db, limit = 20) {
    return db.prepare("SELECT id, intent, agent, output_json, created_at FROM retrieval_logs ORDER BY created_at DESC, id DESC LIMIT ?").all(Math.max(1, limit)).map((row) => ({ id: row.id, intent: row.intent, agent: row.agent, outputJson: row.output_json, createdAt: row.created_at }));
}
//# sourceMappingURL=retrieval-log-repository.js.map