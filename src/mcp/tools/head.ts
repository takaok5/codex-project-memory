import { existsSync } from "node:fs";
import { findProjectRoot } from "../../runtime/project-locator.js";
import { getMemoryPaths } from "../../runtime/memory-paths.js";
import { loadProjectConfig } from "../../runtime/config-loader.js";
import { openMemoryDb } from "../../store/sqlite.js";
import { getProjectState } from "../../store/project-state-repository.js";
import { getFrame } from "../../store/frame-repository.js";
import type { FrameRef, MemoryStatus } from "../../shared/types.js";

export interface McpToolEnv {
  cwd: string;
}

export interface MemoryHeadOutput {
  project: string | null;
  branch: string | null;
  status: MemoryStatus;
  memoryRoot: ".codex/memory";
  visualFrame: FrameRef | null;
  lastIndexedAt: string | null;
  lastRenderedAt: string | null;
  topModules: Array<{ id: string; name: string; riskLevel?: "normal" | "high" }>;
  criticalRules: string[];
  warnings: string[];
  nextCommands: string[];
}

export async function handleMemoryHead(_input: unknown, env: McpToolEnv): Promise<MemoryHeadOutput> {
  const root = findProjectRoot(env.cwd).root;
  const paths = getMemoryPaths(root);
  if (!existsSync(paths.configAbs) || !existsSync(paths.dbAbs)) {
    return {
      project: null,
      branch: null,
      status: "not_initialized",
      memoryRoot: ".codex/memory",
      visualFrame: null,
      lastIndexedAt: null,
      lastRenderedAt: null,
      topModules: [],
      criticalRules: [],
      warnings: ["Project memory is not initialized."],
      nextCommands: ["pmem init --json"]
    };
  }
  const config = loadProjectConfig(paths);
  const db = openMemoryDb(paths);
  try {
    const state = getProjectState(db);
    const current = getFrame(db, "current");
    const topModules = (
      db.prepare("SELECT id, name, risk_level FROM modules ORDER BY id ASC LIMIT 8").all() as Array<{ id: string; name: string; risk_level: "normal" | "high" }>
    ).map((row) => ({ id: row.id, name: row.name, riskLevel: row.risk_level }));
    return {
      project: config.projectName,
      branch: null,
      status: state.status,
      memoryRoot: ".codex/memory",
      visualFrame: current ? { frame: current.id, svg: current.svgPath, png: current.pngPath, map: current.mapPath } : null,
      lastIndexedAt: state.lastIndexedAt,
      lastRenderedAt: state.lastRenderedAt,
      topModules,
      criticalRules: config.criticalRules,
      warnings: state.status === "fresh" ? [] : [`Memory status is ${state.status}.`],
      nextCommands: state.status === "fresh" ? [] : ["pmem refresh --json"]
    };
  } finally {
    db.close();
  }
}
