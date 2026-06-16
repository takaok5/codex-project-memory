import { resolveRuntimeContext } from "../../runtime/context.js";
import { getArchitectureDecision, listArchitectureDecisions, setArchitectureDecisionStatus, upsertArchitectureDecision } from "../../store/evidence-repository.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
export async function cmdDecisionAdd(options) {
    try {
        if (!options.title || !options.summary)
            throw new PmemError("VALIDATION_ERROR", "Decision title and summary are required.");
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            const id = upsertArchitectureDecision(db, {
                title: options.title,
                summary: options.summary,
                rationale: options.rationale ?? options.summary,
                moduleId: options.moduleId,
                filePath: options.filePath,
                symbolFqName: options.symbolFqName
            });
            return { ok: true, data: { id }, warnings: [] };
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
export async function cmdDecisionList(options) {
    try {
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            return { ok: true, data: { decisions: listArchitectureDecisions(db, { status: normalizeStatus(options.status), limit: 50 }) }, warnings: [] };
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
export async function cmdDecisionGet(options) {
    try {
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            const id = Number(options.idOrTitle);
            return { ok: true, data: { decision: getArchitectureDecision(db, Number.isFinite(id) ? id : options.idOrTitle) }, warnings: [] };
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
export async function cmdDecisionStatus(options) {
    try {
        const status = normalizeStatus(options.status);
        if (!status)
            throw new PmemError("VALIDATION_ERROR", "Decision status must be active, stale or contradicted.");
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            return { ok: true, data: { evidenceId: setArchitectureDecisionStatus(db, options.id, status, options.reason ?? `decision ${status}`) }, warnings: [] };
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
function normalizeStatus(value) {
    if (!value)
        return undefined;
    if (value === "active" || value === "stale" || value === "contradicted")
        return value;
    throw new PmemError("VALIDATION_ERROR", "Decision status must be active, stale or contradicted.");
}
//# sourceMappingURL=decisions.js.map