import { findProjectRoot } from "./project-locator.js";
import { getMemoryPaths } from "./memory-paths.js";
import { loadProjectConfig } from "./config-loader.js";
import { openMemoryDb } from "../store/sqlite.js";
export function resolveRuntimeContext(options = {}) {
    const root = findProjectRoot(options.cwd);
    const memoryPaths = getMemoryPaths(root.root);
    const config = loadProjectConfig(memoryPaths, { allowMissing: options.allowMissingConfig });
    const ctx = {
        projectRoot: root.root,
        memoryPaths,
        config
    };
    if (options.openDb) {
        ctx.db = openMemoryDb(memoryPaths);
    }
    return ctx;
}
//# sourceMappingURL=context.js.map