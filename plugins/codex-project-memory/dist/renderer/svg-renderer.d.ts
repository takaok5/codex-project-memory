import type { LayoutResult, NormalizedGraph } from "../shared/types.js";
export declare function renderSvg(graph: NormalizedGraph, layout: LayoutResult, sourceHash: string): string;
export declare function escapeSvgText(value: string): string;
export declare function truncateLabel(value: string, maxChars?: number): string;
