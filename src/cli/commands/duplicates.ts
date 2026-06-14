import { runDuplicateAgent } from "../../agents/duplicate-agent.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
import { ARTIFACT_KINDS } from "../../shared/types.js";
import type { ArtifactKind, CliResult, DuplicateOutput } from "../../shared/types.js";
import type { MemoryDb } from "../../store/sqlite.js";

export interface DuplicatesCliOptions {
  cwd: string;
  intent: string;
  kind?: string;
  moduleId?: string;
  proposedName?: string;
}

const ARTIFACT_KIND_SET = new Set<string>(ARTIFACT_KINDS);

export async function cmdDuplicates(options: DuplicatesCliOptions): Promise<CliResult<DuplicateOutput>> {
  try {
    const intent = validateIntent(options.intent);
    if (!options.kind || !ARTIFACT_KIND_SET.has(options.kind)) {
      throw new PmemError("VALIDATION_ERROR", "Duplicate kind is invalid.");
    }
    const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
    const db = ctx.db as MemoryDb;
    try {
      const output = runDuplicateAgent(ctx, { intent, kind: options.kind as ArtifactKind, moduleId: options.moduleId, proposedName: options.proposedName });
      return { ok: true, data: output, warnings: [] };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

function validateIntent(value: string): string {
  const intent = value.trim();
  if (intent.length < 3 || intent.length > 500) {
    throw new PmemError("VALIDATION_ERROR", "Intent must be between 3 and 500 characters.");
  }
  return intent;
}
