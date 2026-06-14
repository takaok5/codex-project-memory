import { runProjectAgent } from "../../agents/project-agent.js";
import { toErrorPayload } from "../../shared/errors.js";
import type { AgentRunInput, AgentRunPhase, ArtifactKind, CliResult, AgentRunOutput } from "../../shared/types.js";

export interface AgentRunCliOptions {
  cwd: string;
  intent: string;
  phase?: string;
  kind?: string;
  moduleId?: string;
  proposedName?: string;
  init?: boolean;
  refresh?: boolean;
  render?: boolean;
}

export async function cmdAgentRun(options: AgentRunCliOptions): Promise<CliResult<AgentRunOutput>> {
  try {
    const input: AgentRunInput = {
      intent: options.intent,
      phase: options.phase as AgentRunPhase | undefined,
      ...(options.kind
        ? {
            artifact: {
              kind: options.kind as ArtifactKind,
              moduleId: options.moduleId,
              proposedName: options.proposedName
            }
          }
        : {}),
      allowInit: options.init,
      allowRefresh: options.refresh,
      render: options.render
    };
    const output = await runProjectAgent(input, { cwd: options.cwd });
    return { ok: true, data: output, warnings: output.warnings };
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}
