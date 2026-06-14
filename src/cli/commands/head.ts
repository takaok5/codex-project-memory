import { existsSync } from "node:fs";
import { findProjectRoot } from "../../runtime/project-locator.js";
import { getMemoryPaths } from "../../runtime/memory-paths.js";
import { getProjectState } from "../../store/project-state-repository.js";
import { openMemoryDb } from "../../store/sqlite.js";
import { toErrorPayload } from "../../shared/errors.js";
import type { CliFramePath, CliResult, HeadOutput } from "../../shared/types.js";

export interface HeadOptions {
  cwd: string;
}

export async function cmdHead(options: HeadOptions): Promise<CliResult<HeadOutput>> {
  try {
    const root = findProjectRoot(options.cwd).root;
    const paths = getMemoryPaths(root);
    if (!existsSync(paths.configAbs) || !existsSync(paths.dbAbs)) {
      return { ok: true, data: notInitializedHead(), warnings: [] };
    }

    const db = openMemoryDb(paths);
    try {
      const state = getProjectState(db);
      const currentFrame = getCurrentFrame(db);
      const activeWarnings = (db.prepare("SELECT COUNT(*) AS count FROM warnings WHERE resolved_at IS NULL").get() as { count: number }).count;
      return {
        ok: true,
        data: {
          status: state.status,
          memoryRoot: paths.memoryRootRel,
          schemaVersion: state.schemaVersion,
          lastIndexedAt: state.lastIndexedAt,
          lastRenderedAt: state.lastRenderedAt,
          memoryDirty: state.memoryDirty,
          dirtyReason: state.dirtyReason,
          lastError: state.lastError,
          currentFrame,
          activeWarnings
        },
        warnings: []
      };
    } finally {
      db.close();
    }
  } catch (error) {
    const payload = toErrorPayload(error);
    return {
      ok: true,
      data: {
        ...notInitializedHead(),
        status: "error",
        lastError: payload
      },
      warnings: [payload.message]
    };
  }
}

export function notInitializedHead(): HeadOutput {
  return {
    status: "not_initialized",
    memoryRoot: ".codex/memory",
    schemaVersion: null,
    lastIndexedAt: null,
    lastRenderedAt: null,
    memoryDirty: false,
    dirtyReason: "",
    lastError: null,
    currentFrame: null,
    activeWarnings: 0
  };
}

function getCurrentFrame(db: ReturnType<typeof openMemoryDb>): CliFramePath | null {
  const row = db.prepare("SELECT id, svg_path, png_path, map_path, source_hash, generated_at FROM frames WHERE id = 'current'").get() as
    | { id: "current"; svg_path: string; png_path: string | null; map_path: string; source_hash: string; generated_at: string }
    | undefined;
  if (!row) {
    return null;
  }
  return {
    frame: row.id,
    svg: row.svg_path,
    png: row.png_path,
    map: row.map_path,
    sourceHash: row.source_hash,
    generatedAt: row.generated_at
  };
}
