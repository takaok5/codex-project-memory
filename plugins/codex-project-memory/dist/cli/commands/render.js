import { renderCurrentFrame } from "../../renderer/render-current.js";
import { renderNamedFrame } from "../../renderer/render-frames.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { createMemorySnapshot } from "../../runtime/snapshots.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
const FRAMES = ["current", "overview", "modules", "duplicates", "risks"];
export async function cmdRender(options) {
    try {
        if (options.frame && !FRAMES.includes(options.frame)) {
            throw new PmemError("FRAME_NOT_FOUND", "Requested memory frame was not found.");
        }
        const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
        const db = ctx.db;
        try {
            const results = options.frame
                ? [options.frame === "current" ? await renderCurrentFrame(ctx, { png: options.png }) : await renderNamedFrame(ctx, options.frame, { png: options.png })]
                : await renderAllFrames(ctx, options.png);
            const result = results[0];
            return {
                ok: true,
                data: {
                    frames: results.map((item) => ({ frame: item.frame, svg: item.svg, png: item.png, map: item.map, sourceHash: item.sourceHash })),
                    generatedJson: result.generatedJson,
                    pngExported: results.some((item) => item.png !== null),
                    sourceHash: result.sourceHash
                },
                warnings: [...new Set(results.flatMap((item) => item.warnings))]
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
async function renderAllFrames(ctx, png) {
    const results = [];
    results.push(await renderCurrentFrame(ctx, { png, writeSnapshot: false }));
    for (const frame of FRAMES.filter((item) => item !== "current")) {
        results.push(await renderNamedFrame(ctx, frame, { png, writeSnapshot: false }));
    }
    createMemorySnapshot(ctx, { ref: "latest", write: true });
    return results;
}
//# sourceMappingURL=render.js.map