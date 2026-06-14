import { PmemError } from "../shared/errors.js";
export function inferModuleId(filePath, config) {
    const normalized = filePath.replaceAll("\\", "/");
    const configured = config.modules.find((module) => module.rootPath && normalized.startsWith(`${module.rootPath.replaceAll("\\", "/").replace(/\/$/, "")}/`));
    if (configured) {
        return configured.id;
    }
    const parts = normalized.split("/");
    const candidate = parts[0] === "src" && parts[1] ? parts[1] : parts[0];
    const id = candidate?.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!id) {
        throw new PmemError("VALIDATION_ERROR", "Cannot infer module id.");
    }
    return id;
}
//# sourceMappingURL=module-inference.js.map