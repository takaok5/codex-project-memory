import { writeJson } from "../shared/json.js";
import { nowIso } from "../shared/time.js";
export function upsertModule(db, module) {
    db.prepare(`INSERT INTO modules(id, name, root_path, summary, owns_json, must_not_json, dependencies_json, risk_level, updated_at)
     VALUES (@id, @name, @rootPath, @summary, @ownsJson, @mustNotJson, @dependenciesJson, @riskLevel, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       root_path=excluded.root_path,
       summary=excluded.summary,
       owns_json=excluded.owns_json,
       must_not_json=excluded.must_not_json,
       dependencies_json=excluded.dependencies_json,
       risk_level=excluded.risk_level,
       updated_at=excluded.updated_at`).run({
        id: module.id,
        name: module.name,
        rootPath: module.rootPath ?? null,
        summary: module.summary ?? null,
        ownsJson: writeJson(module.owns),
        mustNotJson: writeJson(module.mustNot),
        dependenciesJson: writeJson(module.dependencies),
        riskLevel: module.riskLevel,
        updatedAt: module.updatedAt
    });
}
export function listModules(db) {
    const rows = db.prepare("SELECT * FROM modules ORDER BY id ASC").all();
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        rootPath: row.root_path ?? undefined,
        summary: row.summary ?? undefined,
        owns: JSON.parse(row.owns_json),
        mustNot: JSON.parse(row.must_not_json),
        dependencies: JSON.parse(row.dependencies_json),
        riskLevel: row.risk_level,
        updatedAt: row.updated_at
    }));
}
export function inferModuleForPath(filePath, config) {
    const configured = config.modules.find((module) => module.rootPath && filePath.startsWith(`${module.rootPath.replaceAll("\\", "/").replace(/\/$/, "")}/`));
    if (configured) {
        return configured.id;
    }
    return filePath.split("/")[1] ?? filePath.split("/")[0] ?? "root";
}
export function upsertInferredModule(db, id) {
    upsertModule(db, { id, name: titleCase(id), owns: [], mustNot: [], dependencies: [], riskLevel: "normal", updatedAt: nowIso() });
}
function titleCase(value) {
    return value
        .split(/[-_]/g)
        .filter(Boolean)
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(" ");
}
//# sourceMappingURL=module-repository.js.map