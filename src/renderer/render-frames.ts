import { renderFrame } from "./render-current.js";
import type { FrameName, RenderOptions, RenderResult, RuntimeContext } from "../shared/types.js";

export async function renderNamedFrame(ctx: RuntimeContext, frame: FrameName, options: RenderOptions = {}): Promise<RenderResult> {
  return renderFrame(ctx, frame, options);
}
