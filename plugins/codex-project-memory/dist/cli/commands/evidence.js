import { listRuntimeEvidence, runRuntimeEvidence } from "../../runtime/runtime-evidence.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
export async function cmdEvidenceRun(options) {
    try {
        const kinds = normalizeKinds(options.kind, Boolean(options.all));
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            return { ok: true, data: runRuntimeEvidence(ctx, { kinds }), warnings: [] };
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
export async function cmdEvidenceList(options) {
    try {
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            return { ok: true, data: listRuntimeEvidence(ctx), warnings: [] };
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
function normalizeKinds(kind, all) {
    const allowed = ["build", "test", "lint", "typecheck"];
    if (all)
        return allowed;
    const value = (kind ?? "test").trim();
    if (!allowed.includes(value)) {
        throw new PmemError("VALIDATION_ERROR", "Evidence kind must be build, test, lint or typecheck.");
    }
    return [value];
}
//# sourceMappingURL=evidence.js.map