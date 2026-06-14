import type { RuntimeContext } from "../shared/types.js";

export function runArchitectureAgent(ctx: RuntimeContext): { constraints: string[]; warnings: string[]; recommendations: string[] } {
  return { constraints: ctx.config.criticalRules, warnings: [], recommendations: [] };
}
