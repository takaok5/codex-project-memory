import { runProjectAgent } from "../../agents/project-agent.js";
import { toErrorPayload } from "../../shared/errors.js";
export async function cmdAgentRun(options) {
    try {
        const input = {
            intent: options.intent,
            phase: options.phase,
            ...(options.kind
                ? {
                    artifact: {
                        kind: options.kind,
                        moduleId: options.moduleId,
                        proposedName: options.proposedName
                    }
                }
                : {}),
            allowInit: options.init,
            allowRefresh: options.refresh,
            render: options.render
        };
        const output = await runProjectAgent(input, { cwd: options.cwd });
        return { ok: true, data: output, warnings: output.warnings };
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
//# sourceMappingURL=agent.js.map