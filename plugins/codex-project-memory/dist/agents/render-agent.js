import { renderCurrentFrame } from "../renderer/render-current.js";
export async function runRenderAgent(ctx) {
    const result = await renderCurrentFrame(ctx);
    return { frame: result.frame, warnings: result.warnings };
}
//# sourceMappingURL=render-agent.js.map