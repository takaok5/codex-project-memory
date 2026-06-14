import { cmdRefresh } from "../../cli/commands/refresh.js";
import { PmemError } from "../../shared/errors.js";
import type { FrameName, FrameRef } from "../../shared/types.js";
import type { McpToolEnv } from "./head.js";

export interface MemoryRefreshOutput {
  status: "updated" | "no_changes" | "stale";
  changedOnly: boolean;
  changedFiles: number;
  indexedFiles: number;
  deletedFiles: number;
  updatedTables: string[];
  updatedFrames: FrameName[];
  visualFrame: FrameRef | null;
  warnings: string[];
}

export async function handleMemoryRefresh(input: { changedOnly?: boolean; render?: boolean; reason?: string }, env: McpToolEnv): Promise<MemoryRefreshOutput> {
  const result = await cmdRefresh({ cwd: env.cwd, render: input.render, reason: input.reason });
  if (!result.ok || !result.data) throw new PmemError(result.error?.code ?? "INDEX_ERROR", result.error?.message ?? "Memory refresh failed.", { details: result.error?.details });
  const frame = result.data.render.frames[0];
  const changedFiles = result.data.index.filesIndexed + result.data.index.filesDeleted;
  return {
    status: result.data.render.skipped ? "stale" : changedFiles > 0 ? "updated" : "no_changes",
    changedOnly: true,
    changedFiles,
    indexedFiles: result.data.index.filesIndexed,
    deletedFiles: result.data.index.filesDeleted,
    updatedTables: ["files", "symbols", "routes", "warnings", ...(result.data.render.skipped ? [] : ["frames"])],
    updatedFrames: result.data.render.frames.map((item) => item.frame),
    visualFrame: frame ? { frame: frame.frame, svg: frame.svg, png: frame.png, map: frame.map } : null,
    warnings: result.warnings
  };
}
