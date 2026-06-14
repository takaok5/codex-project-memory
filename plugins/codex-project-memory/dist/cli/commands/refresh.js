import { indexProject } from "../../indexer/project-indexer.js";
import { renderCurrentFrame } from "../../renderer/render-current.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { createMemorySnapshot, rotateSnapshotsForWrite } from "../../runtime/snapshots.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
import { getProjectState, setProjectStateValue } from "../../store/project-state-repository.js";
export async function cmdRefresh(options) {
    try {
        const reason = validateReason(options.reason ?? "manual");
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            rotateSnapshotsForWrite(ctx);
            const index = await indexProject(ctx, { changedOnly: true, reason });
            const warnings = [];
            let frames = [];
            let pngExported = false;
            if (options.render === false) {
                setProjectStateValue(db, "memory_status", "stale");
                createMemorySnapshot(ctx, { ref: "latest", write: true });
                warnings.push("render_skipped: visual frame may be stale");
            }
            else {
                const frame = await renderCurrentFrame(ctx, { writeSnapshot: true });
                frames = [{ frame: frame.frame, svg: frame.svg, png: frame.png, map: frame.map, sourceHash: frame.sourceHash }];
                pngExported = frame.png !== null;
                warnings.push(...frame.warnings);
            }
            const state = getProjectState(db);
            return {
                ok: true,
                data: {
                    changedOnly: true,
                    reason,
                    index: {
                        filesScanned: index.scannedFiles,
                        filesIndexed: index.indexedFiles,
                        filesDeleted: index.deletedFiles,
                        warningsActive: index.warningCount
                    },
                    render: { skipped: options.render === false, frames, pngExported },
                    state: { status: state.status, memoryDirty: state.memoryDirty }
                },
                warnings
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
function validateReason(value) {
    const reason = value.trim();
    if (reason.length > 200) {
        throw new PmemError("VALIDATION_ERROR", "Refresh reason is too long.");
    }
    return reason || "manual";
}
//# sourceMappingURL=refresh.js.map