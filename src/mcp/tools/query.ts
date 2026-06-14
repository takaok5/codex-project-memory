import { cmdQuery } from "../../cli/commands/query.js";
import { PmemError } from "../../shared/errors.js";
import type { QueryOutput } from "../../shared/types.js";
import type { McpToolEnv } from "./head.js";

export async function handleMemoryQuery(input: { intent: string; maxFiles?: number; maxSymbols?: number; maxWarnings?: number; includeVisualFrame?: boolean }, env: McpToolEnv): Promise<QueryOutput> {
  const result = await cmdQuery({
    cwd: env.cwd,
    intent: input.intent,
    maxFiles: input.maxFiles,
    maxSymbols: input.maxSymbols,
    maxWarnings: input.maxWarnings,
    visual: input.includeVisualFrame
  });
  if (!result.ok || !result.data) throw new PmemError(result.error?.code ?? "AGENT_ERROR", result.error?.message ?? "Memory query failed.", { details: result.error?.details });
  return result.data;
}
