import type { ErrorPayload } from "../shared/types.js";
export interface McpErrorEnvelope {
    error: ErrorPayload;
}
export declare function toMcpToolError(error: unknown): McpErrorEnvelope;
