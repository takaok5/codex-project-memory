import { findProjectRoot } from "../../runtime/project-locator.js";
import { installAgentTemplates, listAgentTemplates } from "../../agents/templates.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
import type { AgentsInstallOutput, AgentsListOutput, CliResult } from "../../shared/types.js";

export async function cmdAgentsInstall(options: { cwd: string; scope?: string; force?: boolean }): Promise<CliResult<AgentsInstallOutput>> {
  try {
    if ((options.scope ?? "project") !== "project") throw new PmemError("VALIDATION_ERROR", "Only project scope is supported.");
    const root = findProjectRoot(options.cwd).root;
    return { ok: true, data: installAgentTemplates(root, { force: options.force }), warnings: [] };
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

export async function cmdAgentsList(options: { cwd: string }): Promise<CliResult<AgentsListOutput>> {
  try {
    const root = findProjectRoot(options.cwd).root;
    return { ok: true, data: listAgentTemplates(root), warnings: [] };
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}
