import { cmdRefresh } from "../../cli/commands/refresh.js";
import { PmemError } from "../../shared/errors.js";
export async function handleMemoryRefresh(input, env) {
    const result = await cmdRefresh({ cwd: env.cwd, render: input.render, reason: input.reason });
    if (!result.ok || !result.data)
        throw new PmemError(result.error?.code ?? "INDEX_ERROR", result.error?.message ?? "Memory refresh failed.", { details: result.error?.details });
    const frame = result.data.render.frames[0];
    const changedFiles = result.data.index.filesIndexed + result.data.index.filesDeleted;
    return {
        status: result.data.render.skipped ? "stale" : changedFiles > 0 ? "updated" : "no_changes",
        changedOnly: true,
        changedFiles,
        indexedFiles: result.data.index.filesIndexed,
        deletedFiles: result.data.index.filesDeleted,
        updatedTables: ["files", "symbols", "routes", "warnings", ...(result.data.render.skipped ? [] : ["frames"])],
        updatedFrames: result.data.render.frames.map((item) => item.frame),
        visualFrame: frame ? { frame: frame.frame, svg: frame.svg, png: frame.png, map: frame.map } : null,
        warnings: result.warnings
    };
}
//# sourceMappingURL=refresh.js.map