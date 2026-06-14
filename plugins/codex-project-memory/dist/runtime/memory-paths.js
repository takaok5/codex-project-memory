import { mkdirSync } from "node:fs";
import path from "node:path";
import { PmemError } from "../shared/errors.js";
export function getMemoryPaths(projectRoot) {
    const projectRootAbs = path.resolve(projectRoot);
    const memoryRootAbs = path.join(projectRootAbs, ".codex", "memory");
    return {
        projectRootAbs,
        memoryRootAbs,
        memoryRootRel: ".codex/memory",
        configAbs: path.join(memoryRootAbs, "project-memory.config.json"),
        configRel: ".codex/memory/project-memory.config.json",
        dbAbs: path.join(memoryRootAbs, "memory.db"),
        dbRel: ".codex/memory/memory.db",
        currentSvgAbs: path.join(memoryRootAbs, "current.svg"),
        currentSvgRel: ".codex/memory/current.svg",
        currentPngAbs: path.join(memoryRootAbs, "current.png"),
        currentPngRel: ".codex/memory/current.png",
        currentMapAbs: path.join(memoryRootAbs, "current.map.json"),
        currentMapRel: ".codex/memory/current.map.json",
        framesDirAbs: path.join(memoryRootAbs, "frames"),
        framesDirRel: ".codex/memory/frames",
        generatedDirAbs: path.join(memoryRootAbs, "generated"),
        generatedDirRel: ".codex/memory/generated",
        snapshotsDirAbs: path.join(memoryRootAbs, "snapshots"),
        snapshotsDirRel: ".codex/memory/snapshots",
        cacheDirAbs: path.join(memoryRootAbs, "cache"),
        cacheDirRel: ".codex/memory/cache",
        logsDirAbs: path.join(memoryRootAbs, "logs"),
        logsDirRel: ".codex/memory/logs"
    };
}
export function ensureMemoryDirectories(paths) {
    try {
        for (const dir of [
            paths.memoryRootAbs,
            paths.framesDirAbs,
            paths.generatedDirAbs,
            paths.snapshotsDirAbs,
            paths.cacheDirAbs,
            paths.logsDirAbs
        ]) {
            mkdirSync(dir, { recursive: true });
        }
    }
    catch (error) {
        throw new PmemError("FS_ERROR", "Failed to create memory directories.", {
            details: { cause: error instanceof Error ? error.message : "unknown" }
        });
    }
}
//# sourceMappingURL=memory-paths.js.map