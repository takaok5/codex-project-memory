import { resolveRuntimeContext } from "../../runtime/context.js";
import { getArchitectureDecision, listArchitectureDecisions, setArchitectureDecisionStatus, upsertArchitectureDecision } from "../../store/evidence-repository.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
import type { ArchitectureDecisionRecord, CliResult, EvidenceRecordStatus } from "../../shared/types.js";
import type { MemoryDb } from "../../store/sqlite.js";

export interface DecisionAddCliOptions {
  cwd: string;
  title?: string;
  summary?: string;
  rationale?: string;
  moduleId?: string;
  filePath?: string;
  symbolFqName?: string;
}

export async function cmdDecisionAdd(options: DecisionAddCliOptions): Promise<CliResult<{ id: number }>> {
  try {
    if (!options.title || !options.summary) throw new PmemError("VALIDATION_ERROR", "Decision title and summary are required.");
    const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
    const db = ctx.db as MemoryDb;
    try {
      const id = upsertArchitectureDecision(db, {
        title: options.title,
        summary: options.summary,
        rationale: options.rationale ?? options.summary,
        moduleId: options.moduleId,
        filePath: options.filePath,
        symbolFqName: options.symbolFqName
      });
      return { ok: true, data: { id }, warnings: [] };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

export async function cmdDecisionList(options: { cwd: string; status?: string }): Promise<CliResult<{ decisions: ArchitectureDecisionRecord[] }>> {
  try {
    const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
    const db = ctx.db as MemoryDb;
    try {
      return { ok: true, data: { decisions: listArchitectureDecisions(db, { status: normalizeStatus(options.status), limit: 50 }) }, warnings: [] };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

export async function cmdDecisionGet(options: { cwd: string; idOrTitle: string }): Promise<CliResult<{ decision: ArchitectureDecisionRecord | null }>> {
  try {
    const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
    const db = ctx.db as MemoryDb;
    try {
      const id = Number(options.idOrTitle);
      return { ok: true, data: { decision: getArchitectureDecision(db, Number.isFinite(id) ? id : options.idOrTitle) }, warnings: [] };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

export async function cmdDecisionStatus(options: { cwd: string; id: number; status: string; reason?: string }): Promise<CliResult<{ evidenceId: number }>> {
  try {
    const status = normalizeStatus(options.status);
    if (!status) throw new PmemError("VALIDATION_ERROR", "Decision status must be active, stale or contradicted.");
    const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
    const db = ctx.db as MemoryDb;
    try {
      return { ok: true, data: { evidenceId: setArchitectureDecisionStatus(db, options.id, status, options.reason ?? `decision ${status}`) }, warnings: [] };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

function normalizeStatus(value?: string): EvidenceRecordStatus | undefined {
  if (!value) return undefined;
  if (value === "active" || value === "stale" || value === "contradicted") return value;
  throw new PmemError("VALIDATION_ERROR", "Decision status must be active, stale or contradicted.");
}
