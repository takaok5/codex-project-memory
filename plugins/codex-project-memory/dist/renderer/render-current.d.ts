import type { FrameName, RenderOptions, RenderResult, RuntimeContext } from "../shared/types.js";
export declare function renderCurrentFrame(ctx: RuntimeContext, options?: RenderOptions): Promise<RenderResult>;
export declare function renderFrame(ctx: RuntimeContext, frame: FrameName, options?: RenderOptions): Promise<RenderResult>;
