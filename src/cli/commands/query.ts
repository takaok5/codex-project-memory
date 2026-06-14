import { runRetrievalAgent } from "../../agents/retrieval-agent.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
import type { CliResult, QueryOutput } from "../../shared/types.js";
import type { MemoryDb } from "../../store/sqlite.js";

export interface QueryCliOptions {
  cwd: string;
  intent: string;
  maxFiles?: number;
  maxSymbols?: number;
  maxWarnings?: number;
  visual?: boolean;
}

export async function cmdQuery(options: QueryCliOptions): Promise<CliResult<QueryOutput>> {
  try {
    const intent = validateIntent(options.intent);
    const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
    const db = ctx.db as MemoryDb;
    try {
      const output = runRetrievalAgent(ctx, {
        intent,
        maxFiles: clampInt(options.maxFiles ?? ctx.config.agents.maxFiles ?? 8, 1, 20),
        maxSymbols: clampInt(options.maxSymbols ?? ctx.config.agents.maxSymbols ?? 12, 1, 40),
        maxWarnings: clampInt(options.maxWarnings ?? ctx.config.agents.maxWarnings ?? 8, 0, 20),
        includeVisualFrame: Boolean(options.visual)
      });
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

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}
