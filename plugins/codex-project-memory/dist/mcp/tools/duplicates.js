import { cmdDuplicates } from "../../cli/commands/duplicates.js";
import { PmemError } from "../../shared/errors.js";
export async function handleMemoryDuplicates(input, env) {
    const result = await cmdDuplicates({ cwd: env.cwd, intent: input.intent, kind: input.kind, moduleId: input.moduleId, proposedName: input.proposedName });
    if (!result.ok || !result.data)
        throw new PmemError(result.error?.code ?? "AGENT_ERROR", result.error?.message ?? "Memory duplicate check failed.", { details: result.error?.details });
    return { risk: result.data.risk, verdict: result.data.verdict, matches: result.data.matches, recommendation: result.data.recommendation };
}
//# sourceMappingURL=duplicates.js.map