import { join } from "node:path";
import { writeJsonFileAtomic } from "../shared/json.js";
export function buildFrameMap(layout, paths, sourceHash, languageCapabilities) {
    return {
        version: 1,
        frame: layout.frame,
        svg: paths.svg,
        png: paths.png,
        sourceHash,
        languageCapabilities,
        items: layout.nodes.map(toMapItem)
    };
}
export function writeFrameMap(absPath, map) {
    writeJsonFileAtomic(absPath, map);
}
export function frameMapPath(memoryRootAbs, frame) {
    return frame === "current" ? join(memoryRootAbs, "current.map.json") : join(memoryRootAbs, "frames", `${frame}.map.json`);
}
function toMapItem(node) {
    const kind = mapKind(node.kind);
    return {
        id: node.id,
        kind,
        label: node.label,
        bbox: { x: node.x, y: node.y, width: node.width, height: node.height },
        paths: node.path ? [node.path] : [],
        symbols: [],
        commands: [`pmem frame ${node.kind === "module" ? "modules" : "current"} --json`]
    };
}
function mapKind(kind) {
    return ["module", "file", "symbol", "route", "warning", "duplicate", "rule"].includes(kind) ? kind : "module";
}
//# sourceMappingURL=map-writer.js.map