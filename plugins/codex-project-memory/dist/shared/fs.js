import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PmemError } from "./errors.js";
export function ensureParentDirectory(targetPath) {
    try {
        mkdirSync(dirname(targetPath), { recursive: true });
    }
    catch (error) {
        throw new PmemError("FS_ERROR", "Failed to create parent directory.", {
            details: { cause: error instanceof Error ? error.message : "unknown" }
        });
    }
}
export function writeFileAtomic(targetPath, content) {
    const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
    try {
        ensureParentDirectory(targetPath);
        writeFileSync(tempPath, content);
        renameSync(tempPath, targetPath);
    }
    catch (error) {
        if (existsSync(tempPath)) {
            rmSync(tempPath, { force: true });
        }
        throw new PmemError("FS_ERROR", "Failed to write file atomically.", {
            details: { cause: error instanceof Error ? error.message : "unknown" }
        });
    }
}
//# sourceMappingURL=fs.js.map