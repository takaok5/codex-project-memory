import type { AgentArtifactInput, AgentRouteOutput, AgentRunPhase } from "../shared/types.js";
export interface IntentRouterInput {
    intent: string;
    phase: AgentRunPhase;
    artifact?: AgentArtifactInput;
}
export declare function routeIntent(input: IntentRouterInput): AgentRouteOutput;
