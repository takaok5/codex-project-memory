import { indexProject } from "../../indexer/project-indexer.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { createMemorySnapshot, rotateSnapshotsForWrite } from "../../runtime/snapshots.js";
import { getProjectState } from "../../store/project-state-repository.js";
import { toErrorPayload } from "../../shared/errors.js";
export async function cmdIndex(options) {
    try {
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            rotateSnapshotsForWrite(ctx);
            const result = await indexProject(ctx, { changedOnly: options.changedOnly });
            createMemorySnapshot(ctx, { ref: "latest", write: true });
            const records = countRecords(db);
            const state = getProjectState(db);
            return {
                ok: true,
                data: {
                    changedOnly: Boolean(options.changedOnly),
                    files: {
                        scanned: result.scannedFiles,
                        indexed: result.indexedFiles,
                        skippedUnchanged: result.skippedFiles,
                        deleted: result.deletedFiles,
                        failed: 0
                    },
                    records,
                    state: {
                        status: state.status,
                        memoryDirty: state.memoryDirty
                    }
                },
                warnings: []
            };
        }
        finally {
            db.close();
        }
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
function countRecords(db) {
    return {
        modules: count(db, "modules"),
        symbols: count(db, "symbols"),
        symbolEdges: count(db, "symbol_edges"),
        routes: count(db, "routes"),
        tests: count(db, "tests"),
        warningsActive: Number(db.prepare("SELECT COUNT(*) AS count FROM warnings WHERE resolved_at IS NULL").get().count),
        warningsAdded: count(db, "warnings"),
        warningsResolved: Number(db.prepare("SELECT COUNT(*) AS count FROM warnings WHERE resolved_at IS NOT NULL").get().count)
    };
}
function count(db, table) {
    return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
}
//# sourceMappingURL=index.js.map