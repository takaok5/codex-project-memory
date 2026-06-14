import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PmemError } from "../shared/errors.js";
export const PLACEHOLDER_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
export function ensureAssetPlaceholders(paths, options = {}) {
    for (const target of [paths.iconPng, paths.logoPng]) {
        if (existsSync(target) && !options.force) {
            continue;
        }
        try {
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, Buffer.from(PLACEHOLDER_PNG_BASE64, "base64"));
        }
        catch (error) {
            throw new PmemError("FS_ERROR", "Failed to write placeholder asset.", {
                details: { cause: error instanceof Error ? error.message : "unknown" }
            });
        }
    }
}
//# sourceMappingURL=assets.js.map