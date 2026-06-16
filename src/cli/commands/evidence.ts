import { listRuntimeEvidence, runRuntimeEvidence } from "../../runtime/runtime-evidence.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
import type { CliResult, RuntimeEvidenceKind, RuntimeEvidenceOutput } from "../../shared/types.js";
import type { MemoryDb } from "../../store/sqlite.js";

export interface EvidenceRunCliOptions {
  cwd: string;
  kind?: string;
  all?: boolean;
}

export async function cmdEvidenceRun(options: EvidenceRunCliOptions): Promise<CliResult<RuntimeEvidenceOutput>> {
  try {
    const kinds = normalizeKinds(options.kind, Boolean(options.all));
    const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
    const db = ctx.db as MemoryDb;
    try {
      return { ok: true, data: runRuntimeEvidence(ctx, { kinds }), warnings: [] };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

export async function cmdEvidenceList(options: { cwd: string }): Promise<CliResult<RuntimeEvidenceOutput>> {
  try {
    const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
    const db = ctx.db as MemoryDb;
    try {
      return { ok: true, data: listRuntimeEvidence(ctx), warnings: [] };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

function normalizeKinds(kind: string | undefined, all: boolean): RuntimeEvidenceKind[] {
  const allowed: RuntimeEvidenceKind[] = ["build", "test", "lint", "typecheck"];
  if (all) return allowed;
  const value = (kind ?? "test").trim() as RuntimeEvidenceKind;
  if (!allowed.includes(value)) {
    throw new PmemError("VALIDATION_ERROR", "Evidence kind must be build, test, lint or typecheck.");
  }
  return [value];
}
