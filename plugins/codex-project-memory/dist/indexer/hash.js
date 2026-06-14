import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PmemError } from "../shared/errors.js";
export function hashFile(absPath) {
    try {
        return hashContent(readFileSync(absPath));
    }
    catch (error) {
        throw new PmemError("FS_ERROR", "Failed to hash file.", {
            details: { cause: error instanceof Error ? error.message : "unknown" }
        });
    }
}
export function hashContent(content) {
    return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
//# sourceMappingURL=hash.js.map