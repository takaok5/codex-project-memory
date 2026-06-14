import { cmdFrame } from "../../cli/commands/frame.js";
import { PmemError } from "../../shared/errors.js";
export async function handleMemoryFrame(input, env) {
    const result = await cmdFrame({ cwd: env.cwd, frame: input.frame });
    if (!result.ok || !result.data)
        throw new PmemError(result.error?.code ?? "FRAME_NOT_FOUND", result.error?.message ?? "Requested memory frame was not found.", { details: result.error?.details });
    return {
        frame: result.data.frame,
        svg: result.data.svg,
        png: result.data.png,
        map: result.data.map,
        summary: `${result.data.summary.nodes} nodes, ${result.data.summary.edges} edges, ${result.data.summary.warnings} warnings`,
        warnings: result.data.png ? [] : ["png_missing"]
    };
}
//# sourceMappingURL=frame.js.map