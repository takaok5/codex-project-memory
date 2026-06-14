import { renderCurrentFrame } from "../../renderer/render-current.js";
import { renderNamedFrame } from "../../renderer/render-frames.js";
import { resolveRuntimeContext } from "../../runtime/context.js";
import { createMemorySnapshot } from "../../runtime/snapshots.js";
import { PmemError, toErrorPayload } from "../../shared/errors.js";
import type { CliResult, FrameName, RenderOutput } from "../../shared/types.js";
import type { MemoryDb } from "../../store/sqlite.js";

export interface RenderCliOptions {
  cwd: string;
  png?: boolean;
  frame?: string;
}

const FRAMES: FrameName[] = ["current", "overview", "modules", "duplicates", "risks"];

export async function cmdRender(options: RenderCliOptions): Promise<CliResult<RenderOutput>> {
  try {
    if (options.frame && !FRAMES.includes(options.frame as FrameName)) {
      throw new PmemError("FRAME_NOT_FOUND", "Requested memory frame was not found.");
    }
    const ctx = resolveRuntimeContext({ cwd: options.cwd, openDb: true });
    const db = ctx.db as MemoryDb;
    try {
      const results = options.frame
        ? [options.frame === "current" ? await renderCurrentFrame(ctx, { png: options.png }) : await renderNamedFrame(ctx, options.frame as FrameName, { png: options.png })]
        : await renderAllFrames(ctx, options.png);
      const result = results[0]!;
      return {
        ok: true,
        data: {
          frames: results.map((item) => ({ frame: item.frame, svg: item.svg, png: item.png, map: item.map, sourceHash: item.sourceHash })),
          generatedJson: result.generatedJson,
          pngExported: results.some((item) => item.png !== null),
          sourceHash: result.sourceHash
        },
        warnings: [...new Set(results.flatMap((item) => item.warnings))]
      };
    } finally {
      db.close();
    }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

async function renderAllFrames(ctx: Parameters<typeof renderCurrentFrame>[0], png?: boolean) {
  const results = [];
  results.push(await renderCurrentFrame(ctx, { png, writeSnapshot: false }));
  for (const frame of FRAMES.filter((item) => item !== "current")) {
    results.push(await renderNamedFrame(ctx, frame, { png, writeSnapshot: false }));
  }
  createMemorySnapshot(ctx, { ref: "latest", write: true });
  return results;
}
