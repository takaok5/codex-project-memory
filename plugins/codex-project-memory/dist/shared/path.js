import path from "node:path";
import { PmemError } from "./errors.js";
export function normalizePathSeparators(value) {
    return value.replaceAll("\\", "/");
}
export function toProjectRelativePosix(absPath, projectRoot) {
    const relative = path.relative(path.resolve(projectRoot), path.resolve(absPath));
    if (relative === "") {
        return "";
    }
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new PmemError("SAFETY_ERROR", "Path is outside project root.");
    }
    return assertRelativePosix(normalizePathSeparators(relative));
}
export function toMemoryRelativePosix(absPath, paths) {
    const relative = path.relative(paths.memoryRootAbs, path.resolve(absPath));
    if (relative === "") {
        return paths.memoryRootRel;
    }
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new PmemError("SAFETY_ERROR", "Path is outside memory root.");
    }
    return assertRelativePosix(`${paths.memoryRootRel}/${normalizePathSeparators(relative)}`);
}
export function assertRelativePosix(value) {
    if (value.includes("\\") || path.isAbsolute(value) || value.split("/").includes("..")) {
        throw new PmemError("SAFETY_ERROR", "Path safety check failed.");
    }
    return value;
}
//# sourceMappingURL=path.js.map