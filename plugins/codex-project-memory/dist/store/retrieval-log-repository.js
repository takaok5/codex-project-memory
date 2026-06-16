import { createHash } from "node:crypto";
import { writeJson } from "../shared/json.js";
import { nowIso } from "../shared/time.js";
export function insertRetrievalLog(db, log) {
    const result = db.prepare("INSERT INTO retrieval_logs(intent, agent, output_json, created_at) VALUES (?, ?, ?, ?)").run(intentHash(log.intent), log.agent, writeJson(sanitizeLoggedOutput(log.output)), nowIso());
    return Number(result.lastInsertRowid);
}
export function addRetrievalLog(db, log) {
    return insertRetrievalLog(db, log);
}
export function listRecentRetrievalLogs(db, limit = 20) {
    return db.prepare("SELECT id, intent, agent, output_json, created_at FROM retrieval_logs ORDER BY created_at DESC, id DESC LIMIT ?").all(Math.max(1, limit)).map((row) => ({ id: row.id, intent: row.intent, agent: row.agent, outputJson: row.output_json, createdAt: row.created_at }));
}
function intentHash(intent) {
    return `sha256:${createHash("sha256").update(intent.trim()).digest("hex")}`;
}
function sanitizeLoggedOutput(value) {
    if (Array.isArray(value))
        return value.map((item) => sanitizeLoggedOutput(item));
    if (!value || typeof value !== "object")
        return value;
    const output = {};
    for (const [key, item] of Object.entries(value)) {
        if (key === "intent") {
            output.intentHash = typeof item === "string" ? intentHash(item) : "sha256:unknown";
            continue;
        }
        if (key === "nextCommands") {
            output.nextCommands = [];
            continue;
        }
        output[key] = sanitizeLoggedOutput(item);
    }
    return output;
}
//# sourceMappingURL=retrieval-log-repository.js.map