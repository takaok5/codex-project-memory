import type { RuntimeContext } from "../shared/types.js";
export declare function runRenderAgent(ctx: RuntimeContext): Promise<{
    frame: string;
    warnings: string[];
}>;
