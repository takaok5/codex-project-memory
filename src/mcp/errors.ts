import { toErrorPayload } from "../shared/errors.js";
import type { ErrorPayload } from "../shared/types.js";

export interface McpErrorEnvelope {
  error: ErrorPayload;
}

export function toMcpToolError(error: unknown): McpErrorEnvelope {
  return { error: toErrorPayload(error) };
}
