import { resolveRuntimeContext } from "../../runtime/context.js";
import { addEvidenceFeedback } from "../../store/evidence-repository.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
export async function cmdFeedback(options) {
    try {
        const evidenceKey = options.evidenceKey?.trim();
        if (!evidenceKey || evidenceKey.length > 240 || evidenceKey.includes("\\") || /^[A-Za-z]:[\\/]/.test(evidenceKey)) {
            throw new PmemError("VALIDATION_ERROR", "Evidence key is invalid.");
        }
        const signal = normalizeSignal(options.signal);
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            const id = addEvidenceFeedback(db, {
                evidenceKey,
                signal,
                intent: options.intent ?? "manual-feedback",
                source: "cli"
            });
            return { ok: true, data: { feedbackIds: [id], evidenceKey, signal }, warnings: [] };
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
function normalizeSignal(value) {
    if (value === "useful" || value === "not_useful" || value === "accepted" || value === "rejected" || value === "opened")
        return value;
    throw new PmemError("VALIDATION_ERROR", "Feedback signal is invalid.");
}
//# sourceMappingURL=feedback.js.map