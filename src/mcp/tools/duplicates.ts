import { cmdDuplicates } from "../../cli/commands/duplicates.js";
import { PmemError } from "../../shared/errors.js";
import type { DuplicateCandidate, DuplicateVerdict, RiskLevel } from "../../shared/types.js";
import type { McpToolEnv } from "./head.js";

export interface MemoryDuplicatesOutput {
  risk: RiskLevel;
  verdict: DuplicateVerdict;
  matches: DuplicateCandidate[];
  recommendation: string;
}

export async function handleMemoryDuplicates(input: { kind: string; intent: string; moduleId?: string; proposedName?: string }, env: McpToolEnv): Promise<MemoryDuplicatesOutput> {
  const result = await cmdDuplicates({ cwd: env.cwd, intent: input.intent, kind: input.kind, moduleId: input.moduleId, proposedName: input.proposedName });
  if (!result.ok || !result.data) throw new PmemError(result.error?.code ?? "AGENT_ERROR", result.error?.message ?? "Memory duplicate check failed.", { details: result.error?.details });
  return { risk: result.data.risk, verdict: result.data.verdict, matches: result.data.matches, recommendation: result.data.recommendation };
}
