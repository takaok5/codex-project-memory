import type { RuntimeContext } from "../shared/types.js";
export declare function runArchitectureAgent(ctx: RuntimeContext): {
    constraints: string[];
    warnings: string[];
    recommendations: string[];
};
