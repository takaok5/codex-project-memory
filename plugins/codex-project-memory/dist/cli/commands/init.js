import { existsSync } from "node:fs";
import { findProjectRoot } from "../../runtime/project-locator.js";
import { ensureMemoryDirectories, getMemoryPaths } from "../../runtime/memory-paths.js";
import { computeConfigHash, writeDefaultProjectConfig } from "../../runtime/config-loader.js";
import { openMemoryDb, ensureSchema } from "../../store/sqlite.js";
import { setProjectStateValue } from "../../store/project-state-repository.js";
import { toErrorPayload } from "../../shared/errors.js";
export async function cmdInit(options) {
    try {
        const root = findProjectRoot(options.cwd).root;
        const paths = getMemoryPaths(root);
        const trackedPaths = [
            paths.memoryRootRel,
            paths.framesDirRel,
            paths.generatedDirRel,
            paths.snapshotsDirRel,
            paths.cacheDirRel,
            paths.logsDirRel,
            paths.configRel,
            paths.dbRel
        ];
        const existed = new Set();
        for (const rel of trackedPaths) {
            const abs = relToAbs(paths, rel);
            if (existsSync(abs)) {
                existed.add(rel);
            }
        }
        ensureMemoryDirectories(paths);
        const config = writeDefaultProjectConfig(paths, { force: options.force });
        const db = openMemoryDb(paths);
        try {
            ensureSchema(db);
            setProjectStateValue(db, "project_name", config.projectName);
            setProjectStateValue(db, "config_hash", computeConfigHash(config));
            setProjectStateValue(db, "memory_status", "fresh");
            setProjectStateValue(db, "memory_dirty", "false");
            setProjectStateValue(db, "dirty_reason", "");
            setProjectStateValue(db, "last_error", "");
        }
        finally {
            db.close();
        }
        const created = trackedPaths.filter((rel) => !existed.has(rel));
        const skipped = trackedPaths.filter((rel) => existed.has(rel));
        return {
            ok: true,
            data: {
                status: "fresh",
                memoryRoot: paths.memoryRootRel,
                config: paths.configRel,
                db: paths.dbRel,
                schemaVersion: 4,
                created,
                skipped
            },
            warnings: []
        };
    }
    catch (error) {
        return { ok: false, error: toErrorPayload(error), warnings: [] };
    }
}
function relToAbs(paths, rel) {
    const map = {
        [paths.memoryRootRel]: paths.memoryRootAbs,
        [paths.framesDirRel]: paths.framesDirAbs,
        [paths.generatedDirRel]: paths.generatedDirAbs,
        [paths.snapshotsDirRel]: paths.snapshotsDirAbs,
        [paths.cacheDirRel]: paths.cacheDirAbs,
        [paths.logsDirRel]: paths.logsDirAbs,
        [paths.configRel]: paths.configAbs,
        [paths.dbRel]: paths.dbAbs
    };
    return map[rel] ?? paths.memoryRootAbs;
}
//# sourceMappingURL=init.js.map