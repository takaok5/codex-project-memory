import { join } from "node:path";
import { canonicalJsonHash, writeJsonFileAtomic } from "../shared/json.js";
const GENERATED_FILES = [
    "project",
    "language-capabilities",
    "modules",
    "files",
    "symbols",
    "routes",
    "warnings",
    "edges",
    "duplicates",
    "graph"
];
export function writeGeneratedJson(ctx, graph) {
    const values = {
        project: graph.project,
        "language-capabilities": graph.languageCapabilities,
        modules: graph.modules,
        files: graph.files,
        symbols: graph.symbols,
        routes: graph.routes,
        warnings: graph.warnings,
        edges: graph.edges,
        duplicates: graph.duplicateCandidates,
        graph
    };
    const paths = [];
    const hashes = {};
    for (const name of GENERATED_FILES) {
        const rel = `${ctx.memoryPaths.generatedDirRel}/${name}.json`;
        const abs = join(ctx.memoryPaths.generatedDirAbs, `${name}.json`);
        writeJsonFileAtomic(abs, values[name]);
        paths.push(rel);
        hashes[rel] = canonicalJsonHash(values[name]);
    }
    return { paths, hashes };
}
//# sourceMappingURL=generated-json.js.map