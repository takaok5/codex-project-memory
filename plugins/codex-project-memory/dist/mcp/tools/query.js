import { cmdQuery } from "../../cli/commands/query.js";
import { PmemError } from "../../shared/errors.js";
export async function handleMemoryQuery(input, env) {
    const result = await cmdQuery({
        cwd: env.cwd,
        intent: input.intent,
        maxFiles: input.maxFiles,
        maxSymbols: input.maxSymbols,
        maxWarnings: input.maxWarnings,
        visual: input.includeVisualFrame
    });
    if (!result.ok || !result.data)
        throw new PmemError(result.error?.code ?? "AGENT_ERROR", result.error?.message ?? "Memory query failed.", { details: result.error?.details });
    return result.data;
}
//# sourceMappingURL=query.js.map