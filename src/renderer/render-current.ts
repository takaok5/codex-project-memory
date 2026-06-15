import { join } from "node:path";
import { writeFileAtomic } from "../shared/fs.js";
import { nowIso } from "../shared/time.js";
import { buildNormalizedGraph } from "./graph-builder.js";
import { computeGraphSourceHash } from "./hash.js";
import { writeGeneratedJson } from "./generated-json.js";
import { layoutGraph } from "./layout.js";
import { renderSvg } from "./svg-renderer.js";
import { buildFrameMap, writeFrameMap } from "./map-writer.js";
import { exportSvgToPng } from "./svg-to-png.js";
import { upsertFrame } from "../store/frame-repository.js";
import { setProjectStateValue } from "../store/project-state-repository.js";
import { createMemorySnapshot } from "../runtime/snapshots.js";
import type { FrameName, FrameRecord, RenderOptions, RenderResult, RuntimeContext } from "../shared/types.js";
import type { MemoryDb } from "../store/sqlite.js";

export async function renderCurrentFrame(ctx: RuntimeContext, options: RenderOptions = {}): Promise<RenderResult> {
  return renderFrame(ctx, "current", options);
}

export async function renderFrame(ctx: RuntimeContext, frame: FrameName, options: RenderOptions = {}): Promise<RenderResult> {
  const graph = buildNormalizedGraph(ctx);
  const sourceHash = computeGraphSourceHash(graph);
  const generated = writeGeneratedJson(ctx, graph);
  const layout = layoutGraph(graph, { frame });
  const svg = renderSvg(graph, layout, sourceHash);
  const isCurrent = frame === "current";
  const svgRel = isCurrent ? ctx.memoryPaths.currentSvgRel : `${ctx.memoryPaths.framesDirRel}/${frame}.svg`;
  const mapRel = isCurrent ? ctx.memoryPaths.currentMapRel : `${ctx.memoryPaths.framesDirRel}/${frame}.map.json`;
  const pngRel = isCurrent ? ctx.memoryPaths.currentPngRel : `${ctx.memoryPaths.framesDirRel}/${frame}.png`;
  const svgAbs = isCurrent ? ctx.memoryPaths.currentSvgAbs : join(ctx.memoryPaths.framesDirAbs, `${frame}.svg`);
  const mapAbs = isCurrent ? ctx.memoryPaths.currentMapAbs : join(ctx.memoryPaths.framesDirAbs, `${frame}.map.json`);
  const pngAbs = isCurrent ? ctx.memoryPaths.currentPngAbs : join(ctx.memoryPaths.framesDirAbs, `${frame}.png`);
  const warnings: string[] = [];
  writeFileAtomic(svgAbs, svg);
  const png = await exportSvgToPng(svg, pngAbs, options.png ?? ctx.config.render.png);
  if (!png.ok && png.warning) {
    warnings.push(png.warning);
  }
  const pngPath = png.ok ? pngRel : null;
  const map = buildFrameMap(layout, { svg: svgRel, png: pngPath }, sourceHash);
  writeFrameMap(mapAbs, map);
  const generatedAt = nowIso();
  const record: FrameRecord = {
    id: frame,
    frameType: frameType(frame),
    title: `Codex Project Memory ${frame}`,
    svgPath: svgRel,
    pngPath,
    mapPath: mapRel,
    sourceHash,
    generatedAt
  };
  const db = ctx.db as MemoryDb;
  upsertFrame(db, record);
  setProjectStateValue(db, "last_rendered_at", generatedAt);
  setProjectStateValue(db, "renderer_version", "0.3.0");
  setProjectStateValue(db, "memory_status", "fresh");
  if (options.writeSnapshot !== false) {
    createMemorySnapshot(ctx, { ref: "latest", write: true });
  }
  return {
    frame,
    svg: svgRel,
    png: pngPath,
    map: mapRel,
    generatedJson: generated.paths,
    sourceHash,
    warnings
  };
}

function frameType(frame: FrameName): FrameRecord["frameType"] {
  if (frame === "modules") return "module_map";
  if (frame === "duplicates") return "duplicate_map";
  if (frame === "risks") return "risk_map";
  return frame;
}
