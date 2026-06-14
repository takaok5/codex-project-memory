import { runProjectAgent } from "../../agents/project-agent.js";
export async function handleMemoryAgent(input, env) {
    return runProjectAgent(input, { cwd: env.cwd });
}
//# sourceMappingURL=agent.js.map