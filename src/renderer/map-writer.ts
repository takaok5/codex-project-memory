import { join } from "node:path";
import { writeJsonFileAtomic } from "../shared/json.js";
import type { FrameMap, FrameMapItem, LayoutResult } from "../shared/types.js";

export function buildFrameMap(layout: LayoutResult, paths: { svg: string; png: string | null }, sourceHash: string): FrameMap {
  return {
    version: 1,
    frame: layout.frame,
    svg: paths.svg,
    png: paths.png,
    sourceHash,
    items: layout.nodes.map(toMapItem)
  };
}

export function writeFrameMap(absPath: string, map: FrameMap): void {
  writeJsonFileAtomic(absPath, map);
}

export function frameMapPath(memoryRootAbs: string, frame: string): string {
  return frame === "current" ? join(memoryRootAbs, "current.map.json") : join(memoryRootAbs, "frames", `${frame}.map.json`);
}

function toMapItem(node: LayoutResult["nodes"][number]): FrameMapItem {
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

function mapKind(kind: string): FrameMapItem["kind"] {
  return ["module", "file", "symbol", "route", "warning", "duplicate", "rule"].includes(kind) ? (kind as FrameMapItem["kind"]) : "module";
}
