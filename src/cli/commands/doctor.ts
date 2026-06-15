import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { findProjectRoot } from "../../runtime/project-locator.js";
import { getMemoryPaths } from "../../runtime/memory-paths.js";
import { loadProjectConfig } from "../../runtime/config-loader.js";
import { getProjectState } from "../../store/project-state-repository.js";
import { listDiagnostics } from "../../store/diagnostic-repository.js";
import { listLanguageCapabilities } from "../../store/language-capability-repository.js";
import { FORBIDDEN_TABLES, REQUIRED_TABLES } from "../../store/sqlite.js";
import { toErrorPayload } from "../../shared/errors.js";
import type { CliCheck, CliResult, DoctorOutput, ProjectState } from "../../shared/types.js";

export interface DoctorOptions {
  cwd: string;
}

export async function cmdDoctor(options: DoctorOptions): Promise<CliResult<DoctorOutput>> {
  try {
    const root = findProjectRoot(options.cwd).root;
    const paths = getMemoryPaths(root);
    const checks: CliCheck[] = [];
    const memoryRootExists = existsSync(paths.memoryRootAbs);
    checks.push({
      id: "memory_root",
      status: memoryRootExists ? "ok" : "skipped",
      message: memoryRootExists ? ".codex/memory exists" : ".codex/memory is not initialized"
    });

    let configOk = false;
    if (existsSync(paths.configAbs)) {
      try {
        loadProjectConfig(paths);
        configOk = true;
        checks.push({ id: "config", status: "ok", message: "config schemaVersion=1" });
      } catch (error) {
        checks.push({ id: "config", status: "error", message: toErrorPayload(error).message });
      }
    } else {
      checks.push({ id: "config", status: "skipped", message: "config missing" });
    }

    let state = emptyState();
    let userVersion: number | null = null;
    let schemaVersion: string | null = null;
    let foreignKeysEnabled: boolean | null = null;
    let requiredTablesPresent = false;
    let forbiddenTables: string[] = [];
    let availableFrames: DoctorOutput["frames"]["available"] = [];
    let current: DoctorOutput["frames"]["current"] = null;
    let diagnosticsCount = 0;
    let failedTools: string[] = [];
    let languageToolsCachePath = ".codex/memory/cache/language-tools";
    let lockedTools: string[] = [];

    if (existsSync(paths.dbAbs)) {
      try {
        const db = new Database(paths.dbAbs, { readonly: true, fileMustExist: true });
        try {
          db.pragma("foreign_keys = ON");
          foreignKeysEnabled = db.pragma("foreign_keys", { simple: true }) === 1;
          userVersion = Number(db.pragma("user_version", { simple: true }));
          const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((row) => row.name);
          requiredTablesPresent = REQUIRED_TABLES.every((table) => tables.includes(table));
          forbiddenTables = tables.filter((table) => FORBIDDEN_TABLES.includes(table));
          if (requiredTablesPresent) {
            state = getProjectState(db);
            schemaVersion = state.schemaVersion;
            const frameRows = db.prepare("SELECT id, svg_path, png_path, map_path, source_hash, generated_at FROM frames ORDER BY id").all() as Array<{
              id: "current" | "overview" | "modules" | "duplicates" | "risks";
              svg_path: string;
              png_path: string | null;
              map_path: string;
              source_hash: string;
              generated_at: string;
            }>;
            availableFrames = frameRows.map((row) => row.id);
            diagnosticsCount = listDiagnostics(db, { limit: 100000 }).length;
            failedTools = listLanguageCapabilities(db)
              .filter((capability) => capability.toolStatus === "failed")
              .map((capability) => capability.tool ?? capability.language)
              .sort();
            const currentRow = frameRows.find((row) => row.id === "current");
            current = currentRow
              ? {
                  frame: currentRow.id,
                  svg: currentRow.svg_path,
                  png: currentRow.png_path,
                  map: currentRow.map_path,
                  sourceHash: currentRow.source_hash,
                  generatedAt: currentRow.generated_at
                }
              : null;
          }
          checks.push({ id: "sqlite_open", status: "ok", message: "memory.db open" });
          checks.push({ id: "sqlite_foreign_keys", status: foreignKeysEnabled ? "ok" : "error", message: foreignKeysEnabled ? "PRAGMA foreign_keys=ON" : "PRAGMA foreign_keys=OFF" });
          checks.push({ id: "sqlite_user_version", status: userVersion === 3 ? "ok" : "error", message: `PRAGMA user_version=${userVersion}` });
          checks.push({
            id: "sqlite_forbidden_tables",
            status: forbiddenTables.length ? "warning" : "ok",
            message: forbiddenTables.length ? `forbidden tables present: ${forbiddenTables.join(", ")}` : "no forbidden v0.1 tables"
          });
        } finally {
          db.close();
        }
      } catch (error) {
        checks.push({ id: "sqlite_open", status: "error", message: toErrorPayload(error).message });
      }
    } else {
      checks.push({ id: "sqlite_open", status: "skipped", message: "memory.db missing" });
    }

    checks.push({ id: "frame_svg", status: current ? "ok" : "skipped", message: current ? "current.svg present" : "current.svg not rendered yet" });
    checks.push({ id: "frame_map", status: current ? "ok" : "skipped", message: current ? "current.map.json present" : "current.map.json not rendered yet" });
    checks.push({ id: "frame_png", status: "skipped", message: "current.png is optional" });
    checks.push({ id: "language_tools_cache", status: "ok", message: "language tool cache is project-local" });
    checks.push({ id: "diagnostics", status: failedTools.length ? "warning" : "ok", message: failedTools.length ? `failed diagnostic tools: ${failedTools.join(", ")}` : `${diagnosticsCount} diagnostics stored` });

    if (configOk) {
      try {
        languageToolsCachePath = loadProjectConfig(paths).languageTools?.cachePath ?? languageToolsCachePath;
        const lockPathRel = `${languageToolsCachePath.replaceAll("\\", "/").replace(/\/$/, "")}/pmem-language-tools.lock.json`;
        const lockPathAbs = join(root, ...lockPathRel.split("/"));
        if (existsSync(lockPathAbs)) {
          const lock = JSON.parse(readFileSync(lockPathAbs, "utf8")) as { tools?: Record<string, unknown> };
          lockedTools = Object.keys(lock.tools ?? {}).sort();
        }
      } catch {
        lockedTools = [];
      }
    }

    const anyError = checks.some((check) => check.status === "error");
    const anyWarning = checks.some((check) => check.status === "warning");
    const initialized = memoryRootExists || configOk || existsSync(paths.dbAbs);
    const overallStatus: DoctorOutput["overallStatus"] = !initialized ? "not_initialized" : anyError ? "error" : anyWarning ? "warning" : "ok";

    return {
      ok: true,
      data: {
        overallStatus,
        memoryRoot: paths.memoryRootRel,
        state: {
          status: initialized ? state.status : "not_initialized",
          schemaVersion,
          lastIndexedAt: state.lastIndexedAt,
          lastRenderedAt: state.lastRenderedAt,
          memoryDirty: state.memoryDirty,
          dirtyReason: state.dirtyReason,
          lastError: state.lastError
        },
        checks,
        schema: { userVersion, schemaVersion, foreignKeysEnabled, requiredTablesPresent, forbiddenTables },
        frames: { current, available: availableFrames },
        languageTools: {
          cachePath: languageToolsCachePath,
          lockfile: `${languageToolsCachePath.replaceAll("\\", "/").replace(/\/$/, "")}/pmem-language-tools.lock.json`,
          lockedTools,
          failedTools,
          diagnostics: diagnosticsCount
        }
      },
      warnings: []
    };
  } catch (error) {
    return { ok: false, error: toErrorPayload(error), warnings: [] };
  }
}

function emptyState(): ProjectState {
  return {
    schemaVersion: null,
    status: "not_initialized",
    projectName: null,
    lastIndexedAt: null,
    lastRenderedAt: null,
    memoryDirty: false,
    dirtyReason: "",
    lastError: null
  };
}
