import type { AgentName, RuntimeContext } from "../shared/types.js";
export declare function dispatchAgent(ctx: RuntimeContext, name: AgentName, input: unknown): Promise<unknown>;
