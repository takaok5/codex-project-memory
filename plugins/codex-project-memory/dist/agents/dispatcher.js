import { PmemError } from "../shared/errors.js";
import { runArchitectureAgent } from "./architecture-agent.js";
import { runDriftAgent } from "./drift-agent.js";
import { runDuplicateAgent } from "./duplicate-agent.js";
import { runRenderAgent } from "./render-agent.js";
import { runRetrievalAgent } from "./retrieval-agent.js";
export async function dispatchAgent(ctx, name, input) {
    if (name === "retrieval")
        return runRetrievalAgent(ctx, input);
    if (name === "duplicate")
        return runDuplicateAgent(ctx, input);
    if (name === "drift")
        return runDriftAgent(ctx);
    if (name === "architecture")
        return runArchitectureAgent(ctx);
    if (name === "render")
        return runRenderAgent(ctx);
    throw new PmemError("VALIDATION_ERROR", "Unknown agent.");
}
//# sourceMappingURL=dispatcher.js.map