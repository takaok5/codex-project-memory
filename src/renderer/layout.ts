import type { FrameName, GraphEdgeLayout, GraphNodeLayout, JsonObject, LayoutOptions, LayoutResult, NormalizedGraph } from "../shared/types.js";

const WIDTH = 1600;
const HEADER = 96;
const MARGIN = 40;
const CARD_W = 280;
const CARD_H = 120;
const GAP_X = 32;
const GAP_Y = 32;

const EMPTY_BY_FRAME: Record<FrameName, string> = {
  current: "No indexed modules yet",
  overview: "No indexed modules yet",
  modules: "No module dependencies yet",
  duplicates: "No duplicate candidates",
  risks: "No active risks"
};

export function layoutGraph(graph: NormalizedGraph, options: LayoutOptions = {}): LayoutResult {
  const frame = options.frame ?? "current";
  const nodes = selectNodes(graph, frame);
  const edges = selectEdges(graph, frame, nodes);
  const columns = Math.max(1, Math.floor((WIDTH - MARGIN * 2 + GAP_X) / (CARD_W + GAP_X)));
  const layoutNodes = nodes.map((node, index) => ({
    ...node,
    x: MARGIN + (index % columns) * (CARD_W + GAP_X),
    y: HEADER + MARGIN + Math.floor(index / columns) * (CARD_H + GAP_Y),
    width: CARD_W,
    height: CARD_H
  }));
  const rows = Math.max(1, Math.ceil(Math.max(layoutNodes.length, 1) / columns));
  const height = Math.max(1000, HEADER + MARGIN * 2 + rows * CARD_H + Math.max(0, rows - 1) * GAP_Y);
  return {
    frame,
    width: WIDTH,
    height,
    nodes: layoutNodes,
    edges,
    warnings: layoutNodes.length === 0 ? [EMPTY_BY_FRAME[frame]] : []
  };
}

function selectNodes(graph: NormalizedGraph, frame: FrameName): GraphNodeLayout[] {
  if (frame === "duplicates") {
    return graph.duplicateCandidates.map((candidate) => ({
      id: `duplicate:${candidate.id}`,
      kind: "duplicate",
      label: `${candidate.kind ?? "duplicate"} ${candidate.similarity ?? ""}`.trim(),
      x: 0,
      y: 0,
      width: 0,
      height: 0
    }));
  }
  if (frame === "risks") {
    return [...graph.warnings]
      .filter((warning) => warning.severity === "critical" || warning.severity === "warning")
      .map((warning) => warningNode(warning));
  }
  if (frame === "modules" && graph.edges.length > 0) {
    const moduleIds = new Set(graph.modules.map((module) => String(module.id)));
    return [...moduleIds].sort().map((id) => moduleNode(graph.modules.find((module) => module.id === id) ?? { id, name: id }));
  }
  const moduleNodes = graph.modules.map(moduleNode);
  const warningNodes = graph.warnings.slice(0, 20).map(warningNode);
  return [...moduleNodes, ...warningNodes];
}

function selectEdges(graph: NormalizedGraph, frame: FrameName, nodes: GraphNodeLayout[]): GraphEdgeLayout[] {
  if (frame !== "modules") {
    return [];
  }
  const nodeIds = new Set(nodes.map((node) => node.id));
  const symbolToModule = new Map(graph.symbols.map((symbol) => [String(symbol.fqName), String(symbol.moduleId ?? "")]));
  const seen = new Set<string>();
  const edges: GraphEdgeLayout[] = [];
  for (const edge of graph.edges) {
    const fromModule = symbolToModule.get(String(edge.from)) ?? "";
    const toModule = symbolToModule.get(String(edge.to)) ?? "";
    if (!fromModule || !toModule || fromModule === toModule) continue;
    const from = `module:${fromModule}`;
    const to = `module:${toModule}`;
    const id = `${from}->${to}:dependency`;
    if (!nodeIds.has(from) || !nodeIds.has(to) || seen.has(id)) continue;
    seen.add(id);
    edges.push({ id, from, to, kind: "dependency" });
  }
  return edges.sort((a, b) => [a.from, a.to, a.kind].join("\0").localeCompare([b.from, b.to, b.kind].join("\0")));
}

function moduleNode(module: JsonObject): GraphNodeLayout {
  const id = String(module.id ?? "unknown");
  return {
    id: `module:${id}`,
    kind: "module",
    label: String(module.name ?? id),
    path: module.rootPath ? String(module.rootPath) : undefined,
    x: 0,
    y: 0,
    width: 0,
    height: 0
  };
}

function warningNode(warning: JsonObject): GraphNodeLayout {
  const id = String(warning.id ?? warning.fingerprint ?? "unknown");
  return {
    id: `warning:${id}`,
    kind: "warning",
    label: `${warning.severity ?? "warning"}: ${warning.warningType ?? "warning"}`,
    path: warning.filePath ? String(warning.filePath) : undefined,
    x: 0,
    y: 0,
    width: 0,
    height: 0
  };
}
