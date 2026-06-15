import { findProjectRoot } from "./project-locator.js";
import { getMemoryPaths } from "./memory-paths.js";
import { loadProjectConfig } from "./config-loader.js";
import { ensureSchema, openMemoryDb } from "../store/sqlite.js";
import type { MemoryDb } from "../store/sqlite.js";
import type { ResolveContextOptions, RuntimeContext } from "../shared/types.js";

export function resolveRuntimeContext(options: ResolveContextOptions = {}): RuntimeContext {
  const root = findProjectRoot(options.cwd);
  const memoryPaths = getMemoryPaths(root.root);
  const config = loadProjectConfig(memoryPaths, { allowMissing: options.allowMissingConfig });
  const ctx: RuntimeContext = {
    projectRoot: root.root,
    memoryPaths,
    config
  };
  if (options.openDb) {
    ctx.db = openMemoryDb(memoryPaths);
    ensureSchema(ctx.db as MemoryDb);
  }
  return ctx;
}
