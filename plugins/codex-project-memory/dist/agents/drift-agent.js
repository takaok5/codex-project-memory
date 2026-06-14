import { getProjectState } from "../store/project-state-repository.js";
export function runDriftAgent(ctx) {
    const state = getProjectState(ctx.db);
    const warnings = state.status === "fresh" ? [] : [`Memory is ${state.status}.`];
    const nextCommands = state.status === "fresh" ? [] : ["pmem refresh --json"];
    return { status: state.status, warnings, nextCommands };
}
//# sourceMappingURL=drift-agent.js.map