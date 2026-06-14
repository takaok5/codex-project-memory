import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
import { getFrame } from "../../store/frame-repository.js";
import type { CliResult, FrameName, FrameOutput } from "../../shared/types.js";
import type { MemoryDb } from "../../store/sqlite.js";

const FRAMES: FrameName[] = ["current", "overview", "modules", "duplicates", "risks"];

export interface FrameCliOptions {
  cwd: string;
  frame: string;
}

export async function cmdFrame(options: FrameCliOptions): Promise<CliResult<FrameOutput>> {
  try {
    if (!FRAMES.includes(options.frame as FrameName)) {
      throw new PmemError("FRAME_NOT_FOUND", "Requested memory frame was not found.", { details: { nextCommand: "pmem render --json" } });
    }
    const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
    const db = ctx.db as MemoryDb;
    try {
      const record = getFrame(db, options.frame as FrameName);
      if (!record) {
        throw new PmemError("FRAME_NOT_FOUND", "Requested memory frame was not found.", { details: { nextCommand: "pmem render --json" } });
      }
      if (!existsSync(join(ctx.projectRoot, record.svgPath)) || !existsSync(join(ctx.projectRoot, record.mapPath))) {
        throw new PmemError("STATE_ERROR", "Registered memory frame files are missing.");
      }
      const summary = summarizeFrame(db);
      return {
        ok: true,
        data: {
          frame: record.id,
          svg: record.svgPath,
          png: record.pngPath && existsSync(join(ctx.projectRoot, record.pngPath)) ? record.pngPath : null,
          map: record.mapPath,
          sourceHash: record.sourceHash,
          generatedAt: record.generatedAt,
          summary
        },
        warnings: []
      };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

function summarizeFrame(db: MemoryDb): FrameOutput["summary"] {
  return {
    nodes: Number((db.prepare("SELECT COUNT(*) AS count FROM modules").get() as { count: number }).count),
    edges: Number((db.prepare("SELECT COUNT(*) AS count FROM symbol_edges").get() as { count: number }).count),
    warnings: Number((db.prepare("SELECT COUNT(*) AS count FROM warnings WHERE resolved_at IS NULL").get() as { count: number }).count)
  };
}
