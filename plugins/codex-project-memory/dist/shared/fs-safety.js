import path from "node:path";
import { PmemError } from "./errors.js";
export function assertInsideProjectRoot(absPath, projectRoot) {
    assertInside(absPath, projectRoot, "Path is outside project root.");
}
export function assertInsideMemoryRoot(absPath, paths) {
    assertInside(absPath, paths.memoryRootAbs, "Path is outside memory root.");
}
function assertInside(absPath, root, message) {
    const relative = path.relative(path.resolve(root), path.resolve(absPath));
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new PmemError("SAFETY_ERROR", message);
    }
}
//# sourceMappingURL=fs-safety.js.map