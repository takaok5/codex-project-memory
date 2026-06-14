import { runDuplicateAgent } from "../../agents/duplicate-agent.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
import { ARTIFACT_KINDS } from "../../shared/types.js";
const ARTIFACT_KIND_SET = new Set(ARTIFACT_KINDS);
export async function cmdDuplicates(options) {
    try {
        const intent = validateIntent(options.intent);
        if (!options.kind || !ARTIFACT_KIND_SET.has(options.kind)) {
            throw new PmemError("VALIDATION_ERROR", "Duplicate kind is invalid.");
        }
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            const output = runDuplicateAgent(ctx, { intent, kind: options.kind, moduleId: options.moduleId, proposedName: options.proposedName });
            return { ok: true, data: output, warnings: [] };
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
function validateIntent(value) {
    const intent = value.trim();
    if (intent.length < 3 || intent.length > 500) {
        throw new PmemError("VALIDATION_ERROR", "Intent must be between 3 and 500 characters.");
    }
    return intent;
}
//# sourceMappingURL=duplicates.js.map