import { cmdDiff } from "../../cli/commands/diff.js";
import { PmemError } from "../../shared/errors.js";
export async function handleMemoryDiff(input, env) {
    const result = await cmdDiff({ cwd: env.cwd, from: input.from, to: input.to });
    if (!result.ok || !result.data)
        throw new PmemError(result.error?.code ?? "VALIDATION_ERROR", result.error?.message ?? "Memory diff failed.", { details: result.error?.details });
    return {
        changedFiles: result.data.changedFiles,
        changedModules: result.data.changedModules,
        addedSymbols: result.data.addedSymbols,
        removedSymbols: result.data.removedSymbols,
        newWarnings: result.data.changedWarnings.added,
        resolvedWarnings: result.data.changedWarnings.resolved,
        warnings: result.warnings
    };
}
//# sourceMappingURL=diff.js.map