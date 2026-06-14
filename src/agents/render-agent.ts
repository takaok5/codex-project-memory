import { renderCurrentFrame } from "../renderer/render-current.js";
import type { RuntimeContext } from "../shared/types.js";

export async function runRenderAgent(ctx: RuntimeContext): Promise<{ frame: string; warnings: string[] }> {
  const result = await renderCurrentFrame(ctx);
  return { frame: result.frame, warnings: result.warnings };
}
