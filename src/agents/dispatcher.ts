import { PmemError } from "../shared/errors.js";
import { runArchitectureAgent } from "./architecture-agent.js";
import { runDriftAgent } from "./drift-agent.js";
import { runDuplicateAgent } from "./duplicate-agent.js";
import { runRenderAgent } from "./render-agent.js";
import { runRetrievalAgent } from "./retrieval-agent.js";
import type { AgentName, DuplicateAgentInput, RetrievalAgentInput, RuntimeContext } from "../shared/types.js";

export async function dispatchAgent(ctx: RuntimeContext, name: AgentName, input: unknown): Promise<unknown> {
  if (name === "retrieval") return runRetrievalAgent(ctx, input as RetrievalAgentInput);
  if (name === "duplicate") return runDuplicateAgent(ctx, input as DuplicateAgentInput);
  if (name === "drift") return runDriftAgent(ctx);
  if (name === "architecture") return runArchitectureAgent(ctx);
  if (name === "render") return runRenderAgent(ctx);
  throw new PmemError("VALIDATION_ERROR", "Unknown agent.");
}
