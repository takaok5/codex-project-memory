import type { FrameMap, JsonObject, LayoutResult } from "../shared/types.js";
export declare function buildFrameMap(layout: LayoutResult, paths: {
    svg: string;
    png: string | null;
}, sourceHash: string, languageCapabilities: JsonObject[]): FrameMap;
export declare function writeFrameMap(absPath: string, map: FrameMap): void;
export declare function frameMapPath(memoryRootAbs: string, frame: string): string;
