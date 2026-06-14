import type { RuntimeContext } from "../shared/types.js";
export declare function runDriftAgent(ctx: RuntimeContext): {
    status: string;
    warnings: string[];
    nextCommands: string[];
};
