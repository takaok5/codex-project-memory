import { runProjectAgent } from "../../agents/project-agent.js";
import type { AgentRunInput, AgentRunOutput } from "../../shared/types.js";
import type { McpToolEnv } from "./head.js";

export async function handleMemoryAgent(input: AgentRunInput, env: McpToolEnv): Promise<AgentRunOutput> {
  return runProjectAgent(input, { cwd: env.cwd });
}
