import type { FrameName, RenderOptions, RenderResult, RuntimeContext } from "../shared/types.js";
export declare function renderNamedFrame(ctx: RuntimeContext, frame: FrameName, options?: RenderOptions): Promise<RenderResult>;
