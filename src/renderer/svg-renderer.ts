import type { LayoutResult, NormalizedGraph } from "../shared/types.js";

export function renderSvg(graph: NormalizedGraph, layout: LayoutResult, sourceHash: string): string {
  const title = frameTitle(layout.frame);
  const nodes = layout.nodes.map(renderNode).join("");
  const empty = layout.nodes.length === 0 ? `<text x="40" y="180" class="empty">${escapeSvgText(layout.warnings[0] ?? "No data")}</text>` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeSvgText(title)}">`,
    "<style>.bg{fill:#f7f8fa}.header{fill:#132238}.title{font:700 30px system-ui,sans-serif;fill:#fff}.meta{font:400 14px system-ui,sans-serif;fill:#d6dee8}.card{fill:#fff;stroke:#b8c2cc;stroke-width:1}.module{stroke:#2e6f95}.warning{stroke:#b45309}.duplicate{stroke:#7c3aed}.label{font:600 16px system-ui,sans-serif;fill:#16202a}.sub{font:400 12px system-ui,sans-serif;fill:#536170}.empty{font:500 20px system-ui,sans-serif;fill:#536170}.edge{stroke:#8b98a5;stroke-width:2;fill:none}</style>",
    `<rect id="background" x="0" y="0" width="${layout.width}" height="${layout.height}" class="bg"/>`,
    `<rect id="header" x="0" y="0" width="${layout.width}" height="96" class="header"/>`,
    `<text x="40" y="42" class="title">${escapeSvgText(title)}</text>`,
    `<text x="40" y="70" class="meta">${escapeSvgText(graph.project.name)} · ${escapeSvgText(sourceHash)}</text>`,
    renderEdges(layout),
    nodes,
    empty,
    "</svg>"
  ].join("");
}

export function escapeSvgText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function truncateLabel(value: string, maxChars = 42): string {
  return value.length <= maxChars ? value : `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}

function renderNode(node: LayoutResult["nodes"][number]): string {
  const label = escapeSvgText(truncateLabel(node.label));
  const sub = node.path ? escapeSvgText(truncateLabel(node.path, 46)) : escapeSvgText(node.kind);
  return [
    `<g id="${escapeSvgText(node.id)}" data-pmem-id="${escapeSvgText(node.id)}">`,
    `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="8" ry="8" class="card ${escapeSvgText(node.kind)}"/>`,
    `<text x="${node.x + 18}" y="${node.y + 38}" class="label">${label}</text>`,
    `<text x="${node.x + 18}" y="${node.y + 66}" class="sub">${sub}</text>`,
    "</g>"
  ].join("");
}

function renderEdges(layout: LayoutResult): string {
  if (layout.edges.length === 0) return "";
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  return layout.edges
    .map((edge) => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) return "";
      const x1 = from.x + from.width;
      const y1 = from.y + from.height / 2;
      const x2 = to.x;
      const y2 = to.y + to.height / 2;
      return `<path id="${escapeSvgText(edge.id)}" d="M ${x1} ${y1} L ${x2} ${y2}" class="edge"/>`;
    })
    .join("");
}

function frameTitle(frame: string): string {
  return `Codex Project Memory · ${frame}`;
}
